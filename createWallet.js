import { sequelize, Usuario, Wallet } from './model/index.js';
import { encrypt } from './utils/encryption.js';

async function crearUsuario() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión establecida');

    // Crear usuario
    const nuevoUsuario = await Usuario.create({
      nombre: 'Bob',
      email: 'bob@example.com',
      password: '1234segura',
    });

    console.log('✅ Usuario creado:', nuevoUsuario.toJSON());

    // Crear wallet de prueba
    const { pubKey, wif } = {pubKey: "12345678", wif: "12345678765432345678"}; 
    const encryptedWif = encrypt(wif);

    const nuevaWallet = await Wallet.create({
      direccion: pubKey,
      wif: encryptedWif,
      UsuarioId: nuevoUsuario.id
    });

    console.log('✅ Wallet asociada:', {
      direccion: pubKey,
      wif: '[CIFRADO]',
    });

  } catch (error) {
    console.error('❌ Error al crear usuario o wallet:', error);
  } finally {
    await sequelize.close();
  }
}

crearUsuario();
