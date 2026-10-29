const { Candidate, Ballot, AuditLog } = require('../models');

// Posts definitions
const POSTS = [
  { key: 'president', title: 'President' },
  { key: 'vpBoy', title: 'Vice President (Boy)' },
  { key: 'vpGirl', title: 'Vice President (Girl)' }
];

// List All Candidates
const getCandidates = async (req, res, next) => {
  try {
    const candidates = await Candidate.findAll({
      order: [['post_key', 'ASC'], ['name', 'ASC']]
    });
    res.json({ success: true, posts: POSTS, candidates });
  } catch (error) {
    next(error);
  }
};

// Add Candidate (Admin only, locked once voting begins)
const createCandidate = async (req, res, next) => {
  try {
    const ballotCount = await Ballot.count();
    if (ballotCount > 0) {
      return res.status(403).json({
        success: false,
        message: 'Candidate roster is locked because voting has already commenced.'
      });
    }

    const { post_key, name, department, slogan, photo } = req.body;

    if (!post_key || !name || !department || !slogan) {
      return res.status(400).json({ success: false, message: 'All candidate fields are required.' });
    }

    const matchedPost = POSTS.find(p => p.key === post_key);
    const post_title = matchedPost ? matchedPost.title : post_key;

    const candidate = await Candidate.create({
      post_key,
      post_title,
      name: name.trim(),
      department: department.trim(),
      slogan: slogan.trim(),
      photo: photo || null
    });

    await AuditLog.create({
      admin_id: req.user.id,
      admin_name: req.user.name,
      action: 'CANDIDATE_ADDED',
      target_type: 'CANDIDATE',
      target_id: String(candidate.id),
      details: { name: candidate.name, post: candidate.post_title, dept: candidate.department },
      ip_address: req.ip
    });

    res.status(201).json({ success: true, message: 'Candidate added successfully.', candidate });
  } catch (error) {
    next(error);
  }
};

// Remove Candidate (Admin only, locked once voting begins)
const deleteCandidate = async (req, res, next) => {
  try {
    const ballotCount = await Ballot.count();
    if (ballotCount > 0) {
      return res.status(403).json({
        success: false,
        message: 'Candidate cannot be removed because voting has already commenced.'
      });
    }

    const { id } = req.params;
    const candidate = await Candidate.findByPk(id);
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found.' });
    }

    const candidateDetails = { name: candidate.name, post: candidate.post_title };
    await candidate.destroy();

    await AuditLog.create({
      admin_id: req.user.id,
      admin_name: req.user.name,
      action: 'CANDIDATE_DELETED',
      target_type: 'CANDIDATE',
      target_id: String(id),
      details: candidateDetails,
      ip_address: req.ip
    });

    res.json({ success: true, message: 'Candidate removed successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  POSTS,
  getCandidates,
  createCandidate,
  deleteCandidate
};
