const crypto = require('crypto');
const { User, Election, Ballot, Candidate, sequelize } = require('../models');
const { POSTS } = require('./candidateController');

// Cast Secret Ballot with Atomic Transaction and Row-Level Concurrency Lock
const castVote = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const studentId = req.user.id;

    // Lock student record with FOR UPDATE to prevent concurrent / duplicate voting attempts
    const student = await User.findByPk(studentId, {
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!student) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Student voter record not found.' });
    }

    if (student.role !== 'student') {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Only students can cast votes.' });
    }

    if (student.approval_status !== 'approved') {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Only admin-approved voters are eligible to vote.' });
    }

    if (student.has_voted) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'You have already voted. One student, one vote.' });
    }

    // Check active election status
    let election = await Election.findOne({ order: [['id', 'DESC']], transaction });
    if (!election || election.status !== 'open') {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: `Voting is currently ${election ? election.status : 'not open'}. Ballots cannot be accepted.`
      });
    }

    // Validate selections
    const { selections } = req.body;
    if (!selections || typeof selections !== 'object') {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Invalid ballot structure provided.' });
    }

    // Ensure all required posts have a vote
    for (const post of POSTS) {
      const choice = selections[post.key];
      if (!choice) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: `Missing selection for post: ${post.title}.` });
      }

      if (choice !== 'nota') {
        const candidate = await Candidate.findOne({
          where: { id: choice, post_key: post.key },
          transaction
        });
        if (!candidate) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: `Invalid candidate selected for post: ${post.title}.`
          });
        }
      }
    }

    // Retrieve the previous ballot in the cryptographic chain
    const lastBallot = await Ballot.findOne({
      where: { election_id: election.id },
      order: [['id', 'DESC']],
      transaction
    });

    const prev_hash = lastBallot ? lastBallot.ballot_hash : 'GENESIS';
    const nonce = crypto.randomBytes(16).toString('hex');

    // SHA-256 hash of chain
    const ballot_hash = crypto
      .createHash('sha256')
      .update(prev_hash + JSON.stringify(selections) + nonce)
      .digest('hex');

    const receipt_code = ballot_hash.slice(0, 16).toUpperCase();

    // 1. Record the anonymous ballot (without user identifier)
    await Ballot.create(
      {
        election_id: election.id,
        selections,
        nonce,
        prev_hash,
        ballot_hash,
        receipt_code
      },
      { transaction }
    );

    // 2. Atomically mark voter as having voted (without recording their choice)
    student.has_voted = true;
    await student.save({ transaction });

    // Commit both operations together
    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Vote submitted and safely recorded in the tamper-evident ballot chain!',
      receipt: receipt_code
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// Verify Ballot Receipt
const verifyReceipt = async (req, res, next) => {
  try {
    const { receipt } = req.params;
    if (!receipt || receipt.trim().length < 6) {
      return res.status(400).json({ success: false, message: 'Please provide a valid receipt ID.' });
    }

    const cleanReceipt = receipt.trim().toUpperCase();

    const ballot = await Ballot.findOne({
      where: {
        receipt_code: cleanReceipt
      }
    });

    if (ballot) {
      return res.json({
        success: true,
        verified: true,
        receipt: ballot.receipt_code,
        timestamp: ballot.created_at,
        message: 'Receipt verified! Your ballot is safely and anonymously recorded in the database.'
      });
    }

    // Partial search if applicable
    const partialMatch = await Ballot.findOne({
      where: {
        ballot_hash: {
          [require('sequelize').Op.like]: `${cleanReceipt.toLowerCase()}%`
        }
      }
    });

    if (partialMatch) {
      return res.json({
        success: true,
        verified: true,
        receipt: partialMatch.receipt_code,
        timestamp: partialMatch.created_at,
        message: 'Receipt verified! Your ballot is safely and anonymously recorded in the database.'
      });
    }

    res.status(404).json({
      success: false,
      verified: false,
      message: 'Receipt ID not found. Please double-check the ID or verify with the election office.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  castVote,
  verifyReceipt
};
