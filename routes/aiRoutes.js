const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/auth');
const aiController = require('../controllers/aiController');

// AI anomaly & suspicious voting activity detection (Admin only)
router.get('/anomalies', verifyToken, requireAdmin, aiController.getSuspiciousActivity);

// AI voter turnout and election analytics (Admin only)
router.get('/analytics', verifyToken, requireAdmin, aiController.getAnalytics);

module.exports = router;
