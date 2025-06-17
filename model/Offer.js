import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const Offer = sequelize.define('Offer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  offerPrice: { // Precio ofrecido por el asset
    type: DataTypes.DECIMAL(20, 8), // Ajusta la precisión según tus necesidades para RTM
    allowNull: false
  },
  status: { // 'pending', 'accepted', 'rejected', 'cancelled_by_offerer', 'expired'
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending'
  },
  expiresAt: { // Fecha y hora en la que la oferta expira (opcional)
    type: DataTypes.DATE,
    allowNull: true
  },
  txid: {
    type: DataTypes.STRING,
    allowNull: true
  }
  // Los campos AssetId, OffererUserId (quien hace la oferta), y OwnerUserId (dueño del asset en el momento de la oferta)
  // se añadirán a través de las asociaciones.
  // Sequelize añadirá automáticamente los campos createdAt y updatedAt.
});

export default Offer;