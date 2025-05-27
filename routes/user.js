import express from 'express';
import { Asset, Usuario, Wallet } from '../model/index.js';

const router = express.Router();

// Obtener token user por email
router.post('/token', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const user = await Usuario.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ token: user.token });
  } catch (error) {
    console.error('Error fetching user token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//Obtener info user, wallets y assets por email
router.post('/info', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    console.error('Email is required');
    return res.status(400).json({ error: 'Email is required' });
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



export default router;