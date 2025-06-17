import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const Asset = sequelize.define('Asset', {
  asset_id: {
    type: DataTypes.STRING
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  },
  price: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  referenceHash: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isListed: { 
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true 
  }

  
});

export default Asset;
