import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const Asset = sequelize.define('Asset', {
  asset_id: {
    type: DataTypes.STRING
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: true
  },
  referenceHash: {
    type: DataTypes.STRING,
    allowNull: true
  },

  
});

export default Asset;
