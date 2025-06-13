import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Usuario, Wallet } from '../model/index.js';
// import createWallet from '../utils/createWallet.js'; 
import { Wallet as RTWallet } from '../../rptClient_NPM/wallet.js';
import dotenv from 'dotenv';
import { encrypt } from '../utils/encryption.js';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
dotenv.config();

const router = express.Router();

// Temporal: almacena usuarios pendientes de verificación
const pendingUsers = {};

// Configura tu transporte de correo (ajusta con tus credenciales)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'raptoreummarketplace@gmail.com',
    pass: 'ifzvtlpyflxvdzzc'
    // Pendiente de quitar contraseña hardcodeada
  },
  tls: {
    rejectUnauthorized: false
  }
});

const createWallet = async () => {
  // Crear wallet real de Raptoreum usando rtnft-client
  const wallet = RTWallet.createRandom();
  return {
    pubKey: wallet.getAddress(),
    wif: wallet.getWIF()
  };
};

// Ruta de registro con verificación por email
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Faltan campos' });
    }

    // Verificar si el usuario ya existe
    const existing = await Usuario.findOne({ where: { email: email } });
    if (existing) {
      console.log('El usuario ya existe');
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    // Hashear la contraseña
    const hashed = await bcrypt.hash(password, 10);
    pendingUsers[token] = { name, email, password: hashed, createdAt: Date.now() };

    const verificationLink = `http://localhost:3000/auth/verify?token=${token}`;

    // Enviar correo de verificación
    await transporter.sendMail({
      to: email,
      subject: 'Verificación de correo - Registro en Raptoreum Asset Marketplace',
      html: `${name} haz clic en el siguiente enlace para verificar tu correo: <a href="${verificationLink}">${verificationLink}</a>`
    });

    res.status(200).json({ message: 'Registro correcto. Verifica tu correo para continuar.' });
  } catch (err) {
    console.error('Error en /signup:', err);
    res.status(500).json({ error: 'Error interno en el registro' });
  }
});

// Ruta de verificación
router.get('/verify', async (req, res) => {
  const { token } = req.query;
  const user = pendingUsers[token];
  if (!user) return res.status(400).send('Token inválido o expirado');

  // Crear wallet para el usuario
  const walletData = await createWallet();
  // Crear usuario en la base de datos
  const usuario = await Usuario.create({
    name: user.name,
    email: user.email,
    password: user.password
  });
  // Asociar wallet
  await Wallet.create({
    direccion: walletData.pubKey, // Cambiado de pubKey a direccion
    wif: encrypt(walletData.wif),
    UsuarioId: usuario.id
  });

  delete pendingUsers[token];
  res.send('Correo verificado, usuario registrado.');
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
