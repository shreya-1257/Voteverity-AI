const { User, Ballot, Election, AuditLog, sequelize } = require('../models');
const { Op } = require('sequelize');

// List Students with filtering, search, and counts
const getStudents = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 100 } = req.query;

    const where = { role: 'student' };
    if (status && status !== 'all') {
      where.approval_status = status;
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      where[Op.or] = [
        { name: { [Op.like]: q } },
        { roll_number: { [Op.like]: q } },
        { department: { [Op.like]: q } },
        { email: { [Op.like]: q } }
      ];
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [students, totalCount, allCount, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      User.findAll({
        where,
        order: [['created_at', 'DESC']],
        attributes: { exclude: ['password_hash'] },
        limit: parseInt(limit, 10),
        offset
      }),
      User.count({ where }),
      User.count({ where: { role: 'student' } }),
      User.count({ where: { role: 'student', approval_status: 'pending' } }),
      User.count({ where: { role: 'student', approval_status: 'approved' } }),
      User.count({ where: { role: 'student', approval_status: 'rejected' } })
    ]);

    res.json({
      success: true,
      students,
      pagination: {
        total: totalCount,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(totalCount / parseInt(limit, 10))
      },
      counts: {
        all: allCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update Single Student Approval Status
const updateStudentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value. Must be approved, rejected, or pending.' });
    }

    const student = await User.findOne({
      where: {
        [Op.or]: [{ id: isNaN(id) ? null : parseInt(id, 10) }, { roll_number: id }],
        role: 'student'
      }
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const previousStatus = student.approval_status;
    student.approval_status = status;
    await student.save();

    await AuditLog.create({
      admin_id: req.user.id,
      admin_name: req.user.name,
      action: status === 'approved' ? 'STUDENT_APPROVED' : 'STUDENT_REJECTED',
      target_type: 'USER',
      target_id: String(student.roll_number),
      details: {
        student_name: student.name,
        roll_number: student.roll_number,
        from_status: previousStatus,
        to_status: status
      },
      ip_address: req.ip
    });

    res.json({
      success: true,
      message: `${student.name} (${student.roll_number}) is now ${status}.`,
      student: student.toSafeJSON()
    });
  } catch (error) {
    next(error);
  }
};

// Bulk Update Student Status (Approve / Reject Selected Students)
const bulkUpdateStudentStatus = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { roll_numbers, status } = req.body;

    if (!Array.isArray(roll_numbers) || roll_numbers.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Please provide an array of student roll numbers.' });
    }

    if (!['approved', 'rejected'].includes(status)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Status must be either approved or rejected.' });
    }

    const [updatedCount] = await User.update(
      { approval_status: status },
      {
        where: {
          role: 'student',
          roll_number: { [Op.in]: roll_numbers }
        },
        transaction
      }
    );

    await AuditLog.create({
      admin_id: req.user.id,
      admin_name: req.user.name,
      action: status === 'approved' ? 'BULK_APPROVED' : 'BULK_REJECTED',
      target_type: 'USER_BATCH',
      target_id: `${updatedCount} students`,
      details: {
        affected_count: updatedCount,
        status,
        roll_numbers
      },
      ip_address: req.ip
    }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: `Successfully marked ${updatedCount} student(s) as ${status}.`,
      count: updatedCount
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// Admin Photo Update for Student or Admin
const updatePhoto = async (req, res, next) => {
  try {
    const { target, id } = req.body; // target: 'admin' or 'student'
    const photo = req.body.photo || null;

    if (target === 'admin') {
      req.user.photo = photo;
      await req.user.save();
      return res.json({ success: true, message: photo ? 'Admin photo updated.' : 'Admin photo removed.', photo });
    }

    const student = await User.findOne({
      where: {
        [Op.or]: [{ id: isNaN(id) ? null : parseInt(id, 10) }, { roll_number: id }],
        role: 'student'
      }
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    student.photo = photo;
    await student.save();

    res.json({ success: true, message: photo ? 'Student photo updated.' : 'Student photo removed.', photo });
  } catch (error) {
    next(error);
  }
};

// Get Audit Logs
const getAuditLogs = async (req, res, next) => {
  try {
    const logs = await AuditLog.findAll({
      order: [['created_at', 'DESC']],
      limit: 100
    });
    res.json({ success: true, logs });
  } catch (error) {
    next(error);
  }
};

// Reset Election (Safeguarded)
const resetElection = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { confirmation } = req.body;
    if (confirmation !== 'RESET_ALL_BALLOTS') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Safeguard triggered: Please confirm reset by providing confirmation: "RESET_ALL_BALLOTS".'
      });
    }

    // Delete all ballots
    const deletedBallots = await Ballot.destroy({ where: {}, truncate: true, transaction });

    // Reset has_voted flag for all students
    await User.update({ has_voted: false }, { where: { role: 'student' }, transaction });

    // Set election status to upcoming
    await Election.update({ status: 'upcoming' }, { where: {}, transaction });

    await AuditLog.create({
      admin_id: req.user.id,
      admin_name: req.user.name,
      action: 'ELECTION_RESET',
      target_type: 'ELECTION',
      target_id: 'ALL',
      details: { deleted_ballots: deletedBallots, reset_at: new Date() },
      ip_address: req.ip
    }, { transaction });

    await transaction.commit();

    res.json({ success: true, message: 'Election reset successfully. All ballots purged and voter flags cleared.' });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

module.exports = {
  getStudents,
  updateStudentStatus,
  bulkUpdateStudentStatus,
  updatePhoto,
  getAuditLogs,
  resetElection
};
