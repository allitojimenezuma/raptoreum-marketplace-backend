import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const Wallet = sequelize.define('Wallet', {
  direccion: {
    type: DataTypes.STRING,
    allowNull: false
  },
  wif: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

export default Wallet;
