const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validator');
const { authLimiter } = require('../middleware/rateLimiter');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const authController = require('../controllers/authController');

// Validation rules for registration
const registerValidation = [
  body('name').trim().isLength({ min: 2 }).withMessage('Full name must be at least 2 characters long.'),
  body('roll_number').trim().notEmpty().withMessage('Roll number is required.'),
  body('email').trim().isEmail().withMessage('Please provide a valid college email address.'),
  body('phone').trim().matches(/^[6-9]\d{9}$/).withMessage('Enter a valid 10-digit mobile number starting with 6-9.'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
  body('department').trim().notEmpty().withMessage('Department is required.')
];

// Validation rules for login
const loginValidation = [
  body('role').isIn(['student', 'admin']).withMessage('Role must be either student or admin.'),
  body('identifier').trim().notEmpty().withMessage('Roll number or username is required.'),
  body('password').notEmpty().withMessage('Password is required.')
];

// Routes
router.post('/register', authLimiter, registerValidation, validateRequest, authController.studentRegister);
router.post('/login', authLimiter, loginValidation, validateRequest, authController.login);
router.get('/me', verifyToken, authController.getMe);
router.post('/admin/change-password', verifyToken, requireAdmin, authController.changeAdminPassword);

module.exports = router;
