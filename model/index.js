import sequelize from '../db.js';
import Usuario from './Usuario.js';
import Wallet from './Wallet.js';
import Asset from './Asset.js';

// Usuario tiene muchas Wallets
Usuario.hasMany(Wallet, { as: 'wallets' });
Wallet.belongsTo(Usuario);

// Relación de favoritos: muchos a muchos
Usuario.belongsToMany(Asset, { through: 'Favoritos', as: 'favoritos' });
Asset.belongsToMany(Usuario, { through: 'Favoritos' });

// Relación de Wallet con Asset
Wallet.hasMany(Asset, { as: 'assets' });
Asset.belongsTo(Wallet);


export {
  sequelize,
  Usuario,
  Wallet,
  Asset
};
