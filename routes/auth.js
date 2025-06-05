import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Usuario, Wallet } from '../model/index.js';
// import createWallet from '../utils/createWallet.js'; 
import { Wallet as RTWallet } from '../../rptClient_NPM/wallet.js';

import dotenv from 'dotenv';
import { encrypt } from '../utils/encryption.js';
dotenv.config();

const router = express.Router();

const createWallet = async () => {
  // Crear wallet real de Raptoreum usando rtnft-client
  const wallet = RTWallet.createRandom();
  return {
    pubKey: wallet.getAddress(),
    wif: wallet.getWIF()
  };
};


// Registro
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    console.log('Datos de registro:', req.body);

    // Validación básica
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Faltan campos' });
    }

    // Verificar si el usuario ya existe
    const existing = await Usuario.findOne({ where: { email: email } });
    if (existing) {
      console.log('El usuario ya existe');
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    // Hashear la contraseña
    const hashed = await bcrypt.hash(password, 10);

    // Crear usuario
    const usuario = await Usuario.create({ name, email, password: hashed });

    // Crear wallet usando tu función
    const { pubKey, wif } = await createWallet();
    const encryptedWif = encrypt(wif);


    // Guardar wallet asociada al usuario
    await Wallet.create({
      direccion: pubKey,
      wif: encryptedWif,
      UsuarioId: usuario.id
    });

    res.status(201).json({ message: 'Usuario registrado', wallet: { pubKey, wif } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en el registro' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const usuario = await Usuario.findOne({ where: { email }, include: 'wallets' });
    if (!usuario) return res.status(401).json({ error: 'Credenciales inválidas' });

    const match = await bcrypt.compare(password, usuario.password);
    if (!match) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = jwt.sign({ email: usuario.email }, process.env.JWT_SECRET, {
      expiresIn: '1d'
    });

    await Usuario.update({ token }, { where: { id: usuario.id } });

    res.json({
      message: 'Login exitoso',
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        name: usuario.name,
        wallets: usuario.wallets
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en el login' });
  }
});

export default router;
