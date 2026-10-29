const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validator');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// All admin routes require valid admin authentication
router.use(verifyToken, requireAdmin);

router.get('/students', adminController.getStudents);
router.put('/students/:id/status', adminController.updateStudentStatus);
router.post(
  '/students/bulk-status',
  [
    body('roll_numbers').isArray({ min: 1 }).withMessage('roll_numbers must be a non-empty array.'),
    body('status').isIn(['approved', 'rejected']).withMessage('status must be either approved or rejected.')
  ],
  validateRequest,
  adminController.bulkUpdateStudentStatus
);
router.put('/photo', adminController.updatePhoto);
router.get('/audit-logs', adminController.getAuditLogs);
router.post('/reset-election', adminController.resetElection);

module.exports = router;
