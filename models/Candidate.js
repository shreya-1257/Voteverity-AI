const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Candidate = sequelize.define('Candidate', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  post_key: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  post_title: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  department: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  slogan: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  photo: {
    type: DataTypes.TEXT('medium'),
    allowNull: true
  }
}, {
  tableName: 'candidates',
  indexes: [
    { fields: ['post_key'] }
  ]
});

module.exports = Candidate;
