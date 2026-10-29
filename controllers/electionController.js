const { Election, Ballot, Candidate, User, AuditLog } = require('../models');
const crypto = require('crypto');
const { POSTS } = require('./candidateController');

// Helper to get or create active election
const getActiveElection = async () => {
  let election = await Election.findOne({ order: [['id', 'DESC']] });
  if (!election) {
    election = await Election.create({
      title: 'Campus Student Council Election',
      status: 'open'
    });
  }
  return election;
};

// Get Election Status and Overview
const getElectionStatus = async (req, res, next) => {
  try {
    const election = await getActiveElection();
    const [totalBallots, approvedVoters, totalStudents] = await Promise.all([
      Ballot.count({ where: { election_id: election.id } }),
      User.count({ where: { role: 'student', approval_status: 'approved' } }),
      User.count({ where: { role: 'student' } })
    ]);

    res.json({
      success: true,
      election: {
        id: election.id,
        title: election.title,
        status: election.status,
        start_time: election.start_time,
        end_time: election.end_time,
        totalBallots,
        approvedVoters,
        totalStudents,
        turnoutPercentage: approvedVoters > 0 ? Math.round((totalBallots / approvedVoters) * 100) : 0
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update Election Status & Scheduling (Admin Only)
const updateElectionStatus = async (req, res, next) => {
  try {
    const { status, start_time, end_time, title } = req.body;

    if (status && !['upcoming', 'open', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Must be upcoming, open, or closed.' });
    }

    const election = await getActiveElection();
    const previousStatus = election.status;

    if (status) election.status = status;
    if (title) election.title = title;
    if (start_time !== undefined) election.start_time = start_time ? new Date(start_time) : null;
    if (end_time !== undefined) election.end_time = end_time ? new Date(end_time) : null;

    await election.save();

    await AuditLog.create({
      admin_id: req.user.id,
      admin_name: req.user.name,
      action: 'ELECTION_STATUS_CHANGED',
      target_type: 'ELECTION',
      target_id: String(election.id),
      details: { from_status: previousStatus, to_status: election.status, schedule: { start_time, end_time } },
      ip_address: req.ip
    });

    res.json({
      success: true,
      message: `Election status updated to "${election.status}".`,
      election
    });
  } catch (error) {
    next(error);
  }
};

// Get Election Results (Protected: Available ONLY after election is closed)
const getResults = async (req, res, next) => {
  try {
    const election = await getActiveElection();

    if (election.status !== 'closed') {
      return res.status(403).json({
        success: false,
        published: false,
        status: election.status,
        message: 'Results not published yet. They appear after the election is closed.'
      });
    }

    // Tally all ballots
    const [ballots, candidates, approvedVoters] = await Promise.all([
      Ballot.findAll({ where: { election_id: election.id } }),
      Candidate.findAll(),
      User.count({ where: { role: 'student', approval_status: 'approved' } })
    ]);

    const totalVotes = ballots.length;
    const candidateMap = new Map();
    candidates.forEach(c => candidateMap.set(String(c.id), c));

    const results = POSTS.map(post => {
      const postCandidates = candidates.filter(c => c.post_key === post.key);
      const tallies = postCandidates.map(c => {
        const count = ballots.filter(b => {
          const selObj = typeof b.selections === 'string' ? JSON.parse(b.selections) : b.selections;
          return String(selObj[post.key]) === String(c.id);
        }).length;
        const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        return {
          id: c.id,
          name: c.name,
          department: c.department,
          votes: count,
          percentage
        };
      });

      const notaCount = ballots.filter(b => {
        const selObj = typeof b.selections === 'string' ? JSON.parse(b.selections) : b.selections;
        return selObj[post.key] === 'nota';
      }).length;
      const notaPercentage = totalVotes > 0 ? Math.round((notaCount / totalVotes) * 100) : 0;

      // Determine winner (highest votes, must be > 0)
      const maxVotes = Math.max(0, ...tallies.map(t => t.votes));
      const winners = maxVotes > 0 ? tallies.filter(t => t.votes === maxVotes).map(w => w.id) : [];

      return {
        postKey: post.key,
        postTitle: post.title,
        candidates: tallies.map(t => ({
          ...t,
          isWinner: winners.includes(t.id)
        })),
        nota: {
          votes: notaCount,
          percentage: notaPercentage
        }
      };
    });

    res.json({
      success: true,
      published: true,
      status: 'closed',
      totalVotes,
      approvedVoters,
      turnoutRate: approvedVoters > 0 ? Math.round((totalVotes / approvedVoters) * 100) : 0,
      results
    });
  } catch (error) {
    next(error);
  }
};

// Cryptographic Ballot Chain Integrity Verification
const verifyChain = async (req, res, next) => {
  try {
    const election = await getActiveElection();
    const ballots = await Ballot.findAll({
      where: { election_id: election.id },
      order: [['id', 'ASC']]
    });

    if (ballots.length === 0) {
      return res.json({
        success: true,
        chainValid: true,
        totalBallots: 0,
        message: 'Chain is intact: No ballots cast yet (Genesis state).'
      });
    }

    let prev = 'GENESIS';
    for (let i = 0; i < ballots.length; i++) {
      const b = ballots[i];
      if (b.prev_hash !== prev) {
        return res.status(409).json({
          success: false,
          chainValid: false,
          brokenAtBallotId: b.id,
          message: `WARNING: Hash chain mismatch at ballot #${b.id}. Expected prev_hash: ${prev}, found: ${b.prev_hash}`
        });
      }

      // Recompute SHA-256 hash using raw string if already serialized
      const rawSelections = typeof b.selections === 'string' ? b.selections : JSON.stringify(b.selections);
      const computedHash = crypto
        .createHash('sha256')
        .update(prev + rawSelections + b.nonce)
        .digest('hex');

      if (computedHash !== b.ballot_hash) {
        return res.status(409).json({
          success: false,
          chainValid: false,
          brokenAtBallotId: b.id,
          message: `WARNING: Tamper detected at ballot #${b.id}. Hash does not match data.`
        });
      }

      prev = b.ballot_hash;
    }

    res.json({
      success: true,
      chainValid: true,
      totalBallots: ballots.length,
      message: `Integrity OK: ${ballots.length} ballots verified in an unbroken cryptographic chain.`
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getElectionStatus,
  updateElectionStatus,
  getResults,
  verifyChain
};
