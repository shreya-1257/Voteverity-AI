const { User } = require('../models');
const { Op } = require('sequelize');

// Get Logged-in Student Profile
const getProfile = async (req, res, next) => {
  try {
    const student = await User.findByPk(req.user.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }
    res.json({ success: true, profile: student.toSafeJSON() });
  } catch (error) {
    next(error);
  }
};

// Edit Profile (Permitted fields: name, phone, department, student_class, gender, photo)
// Strictly protects restricted fields (roll_number, approval_status, role, has_voted)
const updateProfile = async (req, res, next) => {
  try {
    const student = await User.findByPk(req.user.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    const { name, phone, department, student_class, gender, photo } = req.body;

    // Validate name
    if (name !== undefined) {
      if (!name || name.trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Name must be at least 2 characters long.' });
      }
      student.name = name.trim();
    }

    // Validate phone number
    if (phone !== undefined) {
      const cleanPhone = phone.trim();
      if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit mobile number starting with 6-9.' });
      }

      student.phone = cleanPhone;
    }

    // Update department and class
    if (department !== undefined) {
      student.department = department.trim();
    }
    if (student_class !== undefined) {
      student.student_class = student_class.trim();
    }
    if (gender !== undefined && ['M', 'F', 'Other'].includes(gender)) {
      student.gender = gender;
    }
    if (photo !== undefined) {
      student.photo = photo;
    }

    // Notice: roll_number, approval_status, has_voted, role are intentionally omitted
    // to strictly protect sensitive and unauthorized fields.

    await student.save();

    res.json({
      success: true,
      message: 'Profile updated successfully!',
      profile: student.toSafeJSON()
    });
  } catch (error) {
    next(error);
  }
};

// Update profile photo
const updatePhoto = async (req, res, next) => {
  try {
    const student = await User.findByPk(req.user.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    student.photo = req.body.photo || null;
    await student.save();

    res.json({
      success: true,
      message: student.photo ? 'Photo updated successfully!' : 'Photo removed successfully!',
      photo: student.photo
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updatePhoto
};
