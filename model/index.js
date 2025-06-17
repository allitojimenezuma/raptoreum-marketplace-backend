import sequelize from '../db.js';
import Usuario from './Usuario.js';
import Wallet from './Wallet.js';
import Asset from './Asset.js';
import TransactionHistory from './TransactionHistory.js';

// Usuario tiene muchas Wallets
Usuario.hasMany(Wallet, { as: 'wallets' });
Wallet.belongsTo(Usuario);

// Relación de favoritos: muchos a muchos
Usuario.belongsToMany(Asset, { through: 'Favoritos', as: 'favoritos' });
Asset.belongsToMany(Usuario, { through: 'Favoritos' });

// Relación de Wallet con Asset
Wallet.hasMany(Asset, { as: 'assets' });
Asset.belongsTo(Wallet);

// --- Asociaciones para TransactionHistory ---

// Un Asset puede estar en muchas transacciones
Asset.hasMany(TransactionHistory, {
  foreignKey: 'AssetId',
  as: 'transactionHistory'
});
TransactionHistory.belongsTo(Asset, {
  foreignKey: 'AssetId',
  as: 'asset'
});

// Un Usuario puede ser vendedor en muchas transacciones
Usuario.hasMany(TransactionHistory, {
  foreignKey: 'SellerUserId',
  as: 'soldTransactions'
});
TransactionHistory.belongsTo(Usuario, {
  foreignKey: 'SellerUserId',
  as: 'seller'
});

// Un Usuario puede ser comprador en muchas transacciones
Usuario.hasMany(TransactionHistory, {
  foreignKey: 'BuyerUserId',
  as: 'boughtTransactions'
});
TransactionHistory.belongsTo(Usuario, {
  foreignKey: 'BuyerUserId',
  as: 'buyer'
});



export {
  sequelize,
  Usuario,
  Wallet,
  Asset,
  TransactionHistory
};
