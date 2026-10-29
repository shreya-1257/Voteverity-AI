const express = require('express');
const router = express.Router();
const { verifyToken, requireApprovedStudent } = require('../middleware/auth');
const { voteLimiter } = require('../middleware/rateLimiter');
const voteController = require('../controllers/voteController');

// Cast vote (Only approved students can vote, rate-limited, concurrency protected)
router.post('/', verifyToken, requireApprovedStudent, voteLimiter, voteController.castVote);

// Verify receipt (public/authenticated)
router.get('/verify/:receipt', voteController.verifyReceipt);

module.exports = router;
