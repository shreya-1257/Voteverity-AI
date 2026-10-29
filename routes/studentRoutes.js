const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validator');
const { verifyToken, requireStudent } = require('../middleware/auth');
const studentController = require('../controllers/studentController');

// Validation for updating student profile
const profileUpdateValidation = [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters.'),
  body('phone').optional().trim().matches(/^[6-9]\d{9}$/).withMessage('Enter a valid 10-digit mobile number starting with 6-9.'),
  body('department').optional().trim().notEmpty().withMessage('Department cannot be empty.'),
  body('student_class').optional().trim(),
  body('gender').optional().isIn(['M', 'F', 'Other']).withMessage('Gender must be M, F, or Other.')
];

// Student profile routes
router.get('/profile', verifyToken, requireStudent, studentController.getProfile);
router.put('/profile', verifyToken, requireStudent, profileUpdateValidation, validateRequest, studentController.updateProfile);
router.put('/photo', verifyToken, requireStudent, studentController.updatePhoto);

module.exports = router;
