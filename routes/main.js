import express from 'express';
import { Asset, Usuario, Wallet } from '../model/index.js';
import axios from 'axios'; 

const router = express.Router();

// Obtener todos los assets
router.get('/assets', async (req, res) => {
  try {
    const assets = await Asset.findAll({
      where: { isListed: true },
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

router.get('/get-rtm-price', async (req, res) => {
  const COINMARKETCAP_API_KEY = process.env.CMC_PRO_API_KEY;

  if (!COINMARKETCAP_API_KEY) {
        console.error('CoinMarketCap API Key is not configured on the backend.');
        return res.status(500).json({ message: 'API key for price service not configured.' });
    }

    const cmcUrl = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest';
    try {
        const response = await axios.get(cmcUrl, {
            headers: {
                'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY,
                'Accept': 'application/json',
            },
            params: {
                symbol: 'RTM',
                convert: 'USD',
            },
        });

        if (response.data && response.data.data && response.data.data.RTM && response.data.data.RTM.quote && response.data.data.RTM.quote.USD) {
            const usdPrice = response.data.data.RTM.quote.USD.price;
            res.json({ usd_price: usdPrice });
        } else {
            console.error('Unexpected response structure from CoinMarketCap:', response.data);
            res.status(500).json({ message: 'Could not parse price data from external service.' });
        }
    } catch (error) {
        console.error('Error calling CoinMarketCap API:', error.response ? error.response.data : error.message);
        let statusCode = 500;
        let message = 'Error fetching price data from external service.';
        if (error.response) {
            statusCode = error.response.status;
            message = error.response.data.status ? error.response.data.status.error_message : message;
        }
        res.status(statusCode).json({ message: message });
    }
});



export default router;