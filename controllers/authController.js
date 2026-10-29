const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, AuditLog } = require('../models');

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      roll_number: user.roll_number,
      name: user.name,
      email: user.email
    },
    process.env.JWT_SECRET || 'voteverity_secure_jwt_secret_key_88493021',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// Student Registration (direct, no OTP)
const studentRegister = async (req, res, next) => {
  try {
    const { name, roll_number, email, phone, password, department, student_class, gender, photo } = req.body;

    const normalizedRoll = roll_number.trim().toUpperCase();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();

    // Check unique constraints (roll number and email)
    const existingStudent = await User.findOne({
      where: {
        [require('sequelize').Op.or]: [
          { roll_number: normalizedRoll },
          { email: normalizedEmail }
        ]
      }
    });

    if (existingStudent) {
      if (existingStudent.roll_number === normalizedRoll) {
        return res.status(409).json({ success: false, message: 'This roll number is already registered.' });
      }
      if (existingStudent.email === normalizedEmail) {
        return res.status(409).json({ success: false, message: 'This email is already associated with an account.' });
      }
    }

    // Hash password with bcrypt
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    const newStudent = await User.create({
      roll_number: normalizedRoll,
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      password_hash,
      role: 'student',
      department: department ? department.trim() : null,
      student_class: student_class ? student_class.trim() : null,
      gender: gender || 'F',
      photo: photo || null,
      approval_status: 'pending',
      has_voted: false,
      email_verified: true,
      mobile_verified: true
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful! Wait for the administrator to approve you as a voter, then sign in.',
      student: newStudent.toSafeJSON()
    });
  } catch (error) {
    next(error);
  }
};

// Unified Login for Students and Admins
const login = async (req, res, next) => {
  try {
    const { role, identifier, password } = req.body;

    if (!role || !identifier || !password) {
      return res.status(400).json({ success: false, message: 'Please provide role, credentials, and password.' });
    }

    let user;
    if (role === 'admin') {
      user = await User.findOne({
        where: {
          role: 'admin',
          username: identifier.trim().toLowerCase()
        }
      });
    } else {
      user = await User.findOne({
        where: {
          role: 'student',
          roll_number: identifier.trim().toUpperCase()
        }
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: role === 'admin' ? 'Invalid admin credentials.' : 'Roll number not found. Please register first.'
      });
    }

    // Check account lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const waitMinutes = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(403).json({
        success: false,
        message: `Account is locked due to too many failed attempts. Try again in ${waitMinutes} minute(s).`
      });
    }

    // Verify password with bcrypt
    const isMatch = await user.isValidPassword(password);
    if (!isMatch) {
      user.failed_login_attempts = (user.failed_login_attempts || 0) + 1;
      if (user.failed_login_attempts >= 5) {
        user.locked_until = new Date(Date.now() + 5 * 60 * 1000);
        user.failed_login_attempts = 0;
        await user.save();
        return res.status(403).json({
          success: false,
          message: 'Account locked for 5 minutes due to 5 consecutive failed login attempts.'
        });
      }
      await user.save();
      return res.status(401).json({
        success: false,
        message: 'Invalid password. Please check your credentials.'
      });
    }

    // Successful login: reset failed attempts
    user.failed_login_attempts = 0;
    user.locked_until = null;
    await user.save();

    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Sign in successful',
      token,
      user: user.toSafeJSON()
    });
  } catch (error) {
    next(error);
  }
};

// Get Current Authenticated Profile
const getMe = async (req, res, next) => {
  try {
    res.json({
      success: true,
      user: req.user.toSafeJSON()
    });
  } catch (error) {
    next(error);
  }
};

// Admin Password Change
const changeAdminPassword = async (req, res, next) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
    }

    const salt = await bcrypt.genSalt(12);
    req.user.password_hash = await bcrypt.hash(new_password, salt);
    await req.user.save();

    await AuditLog.create({
      admin_id: req.user.id,
      admin_name: req.user.name,
      action: 'ADMIN_PASSWORD_CHANGED',
      target_type: 'USER',
      target_id: String(req.user.id),
      details: { timestamp: new Date() },
      ip_address: req.ip
    });

    res.json({ success: true, message: 'Admin password updated successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  studentRegister,
  login,
  getMe,
  changeAdminPassword
};
