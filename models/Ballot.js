const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Ballot = sequelize.define('Ballot', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  election_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  selections: {
    type: DataTypes.JSON,
    allowNull: false
  },
  nonce: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  prev_hash: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  ballot_hash: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true
  },
  receipt_code: {
    type: DataTypes.STRING(32),
    allowNull: false
  }
}, {
  tableName: 'ballots',
  indexes: [
    { fields: ['election_id'] },
    { fields: ['ballot_hash'], unique: true },
    { fields: ['receipt_code'] }
  ]
});

module.exports = Ballot;
