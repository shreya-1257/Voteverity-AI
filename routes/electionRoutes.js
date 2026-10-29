const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/auth');
const electionController = require('../controllers/electionController');

// Status & schedule (public/authenticated)
router.get('/status', electionController.getElectionStatus);

// Update status & schedule (admin only)
router.put('/status', verifyToken, requireAdmin, electionController.updateElectionStatus);

// Tally & results (protected: only published when election is closed)
router.get('/results', electionController.getResults);

// Cryptographic hash chain verification
router.get('/verify-chain', electionController.verifyChain);

module.exports = router;
