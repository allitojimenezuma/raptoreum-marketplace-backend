import { Sequelize } from 'sequelize';

const sequelize = new Sequelize('RaptoreumAssetTracking', 'admin', 'adminpassword', {
  host: '96.44.169.147', // o 'localhost' si corres en la misma máquina
  dialect: 'mysql'
});

export default sequelize;
