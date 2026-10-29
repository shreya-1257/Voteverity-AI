const { sequelize } = require('../config/database');
const User = require('./User');
const Election = require('./Election');
const Candidate = require('./Candidate');
const Ballot = require('./Ballot');
const AuditLog = require('./AuditLog');
const SuspiciousActivity = require('./SuspiciousActivity');

// Relationships
Election.hasMany(Ballot, { foreignKey: 'election_id', as: 'ballots' });
Ballot.belongsTo(Election, { foreignKey: 'election_id', as: 'election' });

User.hasMany(AuditLog, { foreignKey: 'admin_id', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'admin_id', as: 'admin' });

module.exports = {
  sequelize,
  User,
  Election,
  Candidate,
  Ballot,
  AuditLog,
  SuspiciousActivity
};
