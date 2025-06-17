import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const TransactionHistory = sequelize.define('TransactionHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  transactionType: { 
    type: DataTypes.STRING,
    allowNull: false
  },
  priceAtTransaction: {
    type: DataTypes.DECIMAL(20, 8), // Permite hasta 20 dígitos en total, 8 de ellos decimales para RTM
    allowNull: true
  },
  blockchainAssetTxId: { // TXID de la transferencia del asset en la blockchain
    type: DataTypes.STRING,
    allowNull: false
  },
  blockchainPaymentTxId: { // TXID del pago en RTM (si aplica, para compras)
    type: DataTypes.STRING,
    allowNull: true
  },
  notes: { // Campo opcional para notas adicionales
    type: DataTypes.TEXT,
    allowNull: true
  }
  // Los campos AssetId, SellerUserId, BuyerUserId se añadirán a través de las asociaciones.
  // Sequelize añadirá automáticamente los campos createdAt y updatedAt.
});

export default TransactionHistory;