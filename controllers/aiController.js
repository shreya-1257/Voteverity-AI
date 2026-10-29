const aiService = require('../services/aiService');

// Get AI Election Anomaly Detection Report
const getSuspiciousActivity = async (req, res, next) => {
  try {
    const report = await aiService.detectSuspiciousActivity();
    res.json({ success: true, ...report });
  } catch (error) {
    next(error);
  }
};

// Get AI Election Participation & Analytics
const getAnalytics = async (req, res, next) => {
  try {
    const analytics = await aiService.getElectionAnalytics();
    res.json({ success: true, analytics });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSuspiciousActivity,
  getAnalytics
};
