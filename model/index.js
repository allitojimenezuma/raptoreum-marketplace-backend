import sequelize from '../db.js';
import Usuario from './Usuario.js';
import Wallet from './Wallet.js';
import Asset from './Asset.js';
import TransactionHistory from './TransactionHistory.js';
import Offer from './Offer.js'; 


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



// --- Asociaciones para Offer ---

// Un Asset puede tener muchas ofertas
Asset.hasMany(Offer, {
  foreignKey: 'AssetId',
  as: 'offersReceived' // Un asset recibe ofertas
});
Offer.belongsTo(Asset, {
  foreignKey: 'AssetId',
  as: 'asset' // La oferta es por un asset específico
});

// Un Usuario (como oferente) puede hacer muchas ofertas
Usuario.hasMany(Offer, {
  foreignKey: 'OffererUserId',
  as: 'madeOffers' // Un usuario hace ofertas
});
Offer.belongsTo(Usuario, {
  foreignKey: 'OffererUserId',
  as: 'offerer' // La oferta es hecha por un usuario (oferente)
});

// Un Usuario (como propietario del asset en el momento de la oferta) puede recibir muchas ofertas (en sus assets)
// Esta FK 'OwnerUserId' en Offer registrará quién era el dueño cuando se hizo la oferta.
Usuario.hasMany(Offer, {
  foreignKey: 'OwnerUserId',
  as: 'offersToConsider' // Un usuario (dueño) tiene ofertas a considerar en sus assets
});
Offer.belongsTo(Usuario, {
  foreignKey: 'OwnerUserId',
  as: 'assetOwnerAtTimeOfOffer' // La oferta fue hecha al dueño del asset en ese momento
});



export {
  sequelize,
  Usuario,
  Wallet,
  Asset,
  TransactionHistory,
  Offer
};
