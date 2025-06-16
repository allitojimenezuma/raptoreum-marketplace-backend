import express from 'express';
import { Asset, Usuario, Wallet } from '../model/index.js';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { Provider } from 'rtnft-client';
import bcrypt from 'bcrypt';

const router = express.Router();

// Obtener token user por email
router.post('/token', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email es requerido' });
  }

  try {
    const user = await Usuario.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ token: user.token });
  } catch (error) {
    console.error('Error fetching user token:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

//Obtener info user, wallets y assets por email
router.post('/info', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    console.error('Email is required');
    return res.status(400).json({ error: 'Email es requerido' });
  }

  try {
    const user = await Usuario.findOne({
      where: { email },
      include: [
        {
          model: Wallet, // Asegúrate que este modelo está importado y relacionado
          as: 'wallets',
          attributes: ['direccion'],
          include: [
            {
              model: Asset,
              as: 'assets'
            }
          ]
        }
      ]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        name: user.name,
        id: user.id,
        email: user.email,
        token: user.token
      },
      wallets: user.wallets // Aquí cada wallet tendrá su array de assets
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }


});

router.post('/request-password-change', async (req, res) => {
  console.log('Petición recibida de /request-password-change'); // Log inicial
  const { email } = req.body;
  console.log('Email recibido:', email); // Log email

  if (!email) {
    console.log('Email is missing');
    return res.status(400).json({ error: 'Email es requerido' });
  }

  try {
    console.log('Buscando usuario...');
    const user = await Usuario.findOne({ where: { email } });

    if (!user) {
      console.log('Usuario no encontrado por email:', email);
      return res.status(200).json({ message: 'Si tu email está registrado, recibirás un enlace para cambiar tu contraseña.' });
    }
    console.log('Usuario encontrado:', user.id);

    // Generate a reset token
    console.log('Generando reset token...');
    const resetToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const hashedResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    console.log('Reset token generado y hasheado.');

    // Save the hashed token and expiry date to the user
    user.passwordResetToken = hashedResetToken;
    user.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();
    console.log('Usuario guardado con reset token.');

    // Send the email
    console.log('Configurando transportador de email...');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASS  // Your email password or app password
      },
      tls: {
        rejectUnauthorized: false // Add this to handle self-signed certificate issues
      }
    });
    console.log('Email transporter configurado.');

    const resetUrl = `http://localhost:3001/reset-password/${resetToken}`;
    console.log('Reset URL creada:', resetUrl);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Petición de cambio de contraseña',
      text: `Estás recibiendo este correo porque has solicitado el restablecimiento de la contraseña de tu cuenta.\n\n` +
            `Por favor, haz clic en el siguiente enlace, o pégalo en tu navegador para completar el proceso dentro de los quince minutos posteriores a su recepción:\n\n` +
            `${resetUrl}\n\n` +
            `Si no solicitaste esto, por favor ignora este correo y tu contraseña permanecerá sin cambios.\n`
    };

    console.log('Enviando email...');
    await transporter.sendMail(mailOptions);
    console.log('Email enviado correctamente a:', user.email);

    res.status(200).json({ message: 'Si tu email está registrado, recibirás un enlace para cambiar tu contraseña.' });

  } catch (error) {
    console.error('Error en la ruta /request-password-change:', error); // Log de error detallado
    // Es importante enviar un mensaje genérico aquí también por seguridad
    res.status(200).json({ message: 'Ocurrió un error. Si tu email está registrado, recibirás un enlace para cambiar tu contraseña en breve.' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body;
  console.log('Petición recibida para /reset-password');
  console.log('Token:', token, 'Nueva Contraseña: (Mínimo 8 caracteres)', newPassword, 'Confirmar Contraseña:', confirmPassword);

  if (!token || !newPassword || !confirmPassword) {
    console.log('Faltan token, newPassword o confirmPassword');
    return res.status(400).json({ error: 'Token, nueva contraseña y confirmación de contraseña son requeridos.' });
  }

  if (newPassword !== confirmPassword) {
    console.log('Las contraseñas no coinciden');
    return res.status(400).json({ error: 'Las contraseñas no coinciden.' });
  }

  // Optionally, add password complexity requirements here
  // if (newPassword.length < 8) {
  //   return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  // }

  try {
    // Verify the JWT token first (this is the raw token from the email link)
    let decodedJwt;
    try {
      decodedJwt = jwt.verify(token, process.env.JWT_SECRET);
      console.log('JWT token es válido, userId:', decodedJwt.userId);
    } catch (jwtError) {
      console.log('JWT token inválido o expirado:', jwtError.message);
      return res.status(400).json({ error: 'Enlace de restablecimiento de contraseña expirado.' });
    }

    // Hash the token received from the URL to compare with the one stored in DB
    const hashedTokenFromUrl = crypto.createHash('sha256').update(token).digest('hex');
    console.log('Hashed token from URL:', hashedTokenFromUrl);

    const user = await Usuario.findOne({
      where: {
        passwordResetToken: hashedTokenFromUrl,
        // passwordResetExpires: { [Op.gt]: Date.now() } // Sequelize Op needed for this
      }
    });

    if (!user) {
      console.log('No se encontró ningún usuario con este token de restablecimiento (ya utilizado o inválido después de la verificación de JWT).');
      return res.status(400).json({ error: 'Enlace de restablecimiento de contraseña inválido o expirado.' });
    }
    console.log('Usuario encontrado para el token de restablecimiento:', user.id);

    // Check expiry manually if not using Op.gt
    if (user.passwordResetExpires < Date.now()) {
      console.log('El enlace de restablecimiento de contraseña ha expirado para el usuario:', user.id);
      // Clear the expired token fields
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      await user.save();
      return res.status(400).json({ error: 'Enlace de restablecimiento de contraseña ha expirado.' });
    }
    console.log('El enlace de restablecimiento de contraseña no ha expirado.');

    // Hash the new password
    console.log('Hasheando nueva contraseña...');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log('Nueva contraseña hasheada.');

    // Update password and clear reset token fields
    user.password = hashedPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    console.log('Actualizando la contraseña del usuario y limpiando los campos del token de restablecimiento...');
    await user.save();
    console.log('Contraseña del usuario actualizada correctamente.');

    res.status(200).json({ message: 'La contraseña ha sido restablecida correctamente.' });

  } catch (error) {
    console.error('Error en la ruta /reset-password:', error);
    res.status(500).json({ error: 'Ocurrió un error interno al restablecer tu contraseña.' });
  }
});

// Obtener el balance de la wallet del usuario autenticado
router.get('/balance', async (req, res) => {
    try {
        console.log('--- INICIO OBTENER BALANCE ---');
        // 1. Extract and verify token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Token de autorización requerido.' });
        }
        const token = authHeader.split(' ')[1];

        let decodedToken;
        try {
            decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ message: 'Token inválido o expirado.' });
        }

        const userEmail = decodedToken.email;
        if (!userEmail) {
            return res.status(401).json({ message: 'Email no encontrado en el token.' });
        }

        // 2. Fetch user and their primary wallet
        const usuario = await Usuario.findOne({
            where: { email: userEmail },
            include: [{ model: Wallet, as: 'wallets' }]
        });

        if (!usuario) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        if (!usuario.wallets || usuario.wallets.length === 0) {
            return res.status(404).json({ message: 'Wallet no encontrada para el usuario.' });
        }
        
        // Assuming the first wallet is the one to use
        const userWallet = usuario.wallets[0];
        const userAddress = userWallet.direccion;

        if (!userAddress) {
            return res.status(500).json({ message: 'Dirección de la wallet no encontrada.' });
        }

        // 3. Instantiate Provider
        const provider = new Provider();

        // 4. Get balance
        console.log(`Consultando balance para la dirección: ${userAddress}`);
        const balanceSatoshis = await provider.getBalance(userAddress);
        const balanceRTM = balanceSatoshis / 1e8; // Convert satoshis to RTM

        console.log(`Balance obtenido: ${balanceSatoshis} satoshis (${balanceRTM} RTM)`);
        res.status(200).json({ 
            message: 'Balance obtenido correctamente.', 
            address: userAddress,
            balanceSatoshis: balanceSatoshis,
            balanceRTM: balanceRTM 
        });

    } catch (error) {
        console.error('Error en la ruta /balance:', error);
        if (error.message.includes("RPC call")) { // Errors from provider.call
             return res.status(500).json({ message: 'Error de comunicación con el nodo Raptoreum al obtener el balance.', details: error.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al obtener el balance.', error: error.message });
    }
});



export default router;