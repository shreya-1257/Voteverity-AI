const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Election = sequelize.define('Election', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING(150),
    allowNull: false,
    defaultValue: 'Campus Student Council Election'
  },
  status: {
    type: DataTypes.ENUM('upcoming', 'open', 'closed'),
    defaultValue: 'open',
    allowNull: false
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'elections'
});

module.exports = Election;
