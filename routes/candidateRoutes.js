const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validator');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const candidateController = require('../controllers/candidateController');

// Public route to view candidates
router.get('/', candidateController.getCandidates);

// Admin-only candidate management
router.post(
  '/',
  verifyToken,
  requireAdmin,
  [
    body('post_key').notEmpty().withMessage('Post key is required.'),
    body('name').trim().isLength({ min: 2 }).withMessage('Candidate name must be at least 2 characters.'),
    body('department').trim().notEmpty().withMessage('Department is required.'),
    body('slogan').trim().notEmpty().withMessage('Slogan is required.')
  ],
  validateRequest,
  candidateController.createCandidate
);

router.delete('/:id', verifyToken, requireAdmin, candidateController.deleteCandidate);

module.exports = router;
