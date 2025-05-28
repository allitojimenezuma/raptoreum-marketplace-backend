import { sequelize, Usuario, Wallet, Asset } from './model/index.js';
import { Provider } from 'rtnft-client';

async function getUsuario() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión establecida');

    //obtener usuario por id
    const usuarioId = 3; // Cambia esto al ID del usuario que deseas obtener
    const usuario = await Usuario.findByPk(usuarioId);
    if (!usuario) {
      console.log('❌ Usuario no encontrado');
      return;
    }
    console.log('✅ Usuario encontrado:', usuario.toJSON());

    //Obtener wallets del usuario
    const wallets = await usuario.getWallets();
    if (wallets.length === 0) {
      console.log('❌ No se encontraron wallets para este usuario');
      return;
    }
    console.log('✅ Wallets encontradas:', wallets.map(wallet => wallet.toJSON()));

  } catch (error) {
    console.error('❌ Error al crear usuario o wallet:', error);
  } finally {
    await sequelize.close();
  }
}

async function getAsset() {
  try {
    // //obtener usuario por id
    // const asset_id = "32fc9cbf85d2254cfea3f2a2ea009b8717d0980d5a0934c52da2fbc89b6b4bab"; // Cambia esto al ID del usuario que deseas obtener
    // const asset = await Asset.findOne({ where: { asset_id: asset_id } });
    // console.log('✅ Asset encontrado:', asset.toJSON());


    // const provider = new Provider();
    // provider.getassetdetailsbyid(asset_id)
    //   .then(details => {
    //     console.log('Detalles del asset:', details);
    //   })
    //   .catch(err => {
    //     console.error('Error al obtener detalles:', err);
    //   });

    const provider = new Provider();
    provider.getBlockchainInfo()
      .then(details => {
        console.log(details);
      })
      .catch(err => {
        console.error('Error al obtener detalles:', err);
      });





  } catch (error) {
    console.error('❌ Error al crear usuario o wallet:', error);
  } finally {
    await sequelize.close();
  }
}

getAsset();