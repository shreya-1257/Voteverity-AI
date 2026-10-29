const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SuspiciousActivity = sequelize.define('SuspiciousActivity', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  anomaly_type: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  severity: {
    type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
    defaultValue: 'MEDIUM',
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  metrics: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'suspicious_activities',
  indexes: [
    { fields: ['severity'] },
    { fields: ['anomaly_type'] },
    { fields: ['created_at'] }
  ]
});

module.exports = SuspiciousActivity;
