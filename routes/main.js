import express from 'express';
import { Asset, Usuario, Wallet } from '../model/index.js';

const router = express.Router();

// Obtener todos los assets
router.get('/assets', async (req, res) => {
  try {
    const assets = await Asset.findAll({
      include: {
        model: Wallet,
        include: {
          model: Usuario,
          attributes: ['name']
        }
      }
    });

    // Mapear para agregar ownerName
    const assetsWithOwner = assets.map(asset => {
      const assetJson = asset.toJSON();
      assetJson.ownerName = assetJson.Wallet?.Usuario?.name || null;
      return assetJson;
    });

    res.json(assetsWithOwner);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Obtener un asset por ID
router.get('/asset/:id', async (req, res) => {
  try {
    const assetId = req.params.id;
    const asset = await Asset.findOne({
      where: { id: assetId },
      include: {
        model: Wallet,
        include: {
          model: Usuario,
          attributes: ['name']
        }
      }
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset no encontrado' });
    }

    const assetJson = asset.toJSON();
    assetJson.ownerName = assetJson.Wallet?.Usuario?.name || null;
    res.json(assetJson);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});



export default router;