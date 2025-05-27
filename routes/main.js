import express from 'express';
import { Asset, Usuario } from '../model/index.js';

const router = express.Router();

// Obtener todos los assets
router.get('/assets', async (req, res) => {
  try {
    const assets = await Asset.findAll();
    res.json(assets);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Obtener un asset por ID
router.get('/asset/:id', async (req, res) => {
  try {
    const assetId = req.params.id;
    const asset = await Asset.findOne({ where: { id: assetId } });

    if (!asset) {
      return res.status(404).json({ error: 'Asset no encontrado' });
    }

    res.json(asset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});



export default router;