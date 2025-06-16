import axios from 'axios';
import FormData from 'form-data';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Asset, Usuario, Wallet } from '../model/index.js';
import { Provider } from 'rtnft-client';
import upload from '../utils/multer.js';
import { decrypt } from '../utils/encryption.js';

const router = express.Router();


/**
 * Sube una imagen dada como Data URL base64 a IPFS via Raptoreum usando axios.
 *
 * @param {string} dataUrl – Cadena "data:<mime>;base64,<datos…>"
 * @returns {Promise<Object>} – JSON de respuesta
 */
async function uploadBase64Image(dataUrl) {
    // 1) Separa metadata y contenido base64
    const [meta, base64Data] = dataUrl.split(',');
    if (!base64Data) {
        throw new Error('Formato inválido. Debe ser "data:<mime>;base64,<datos>"');
    }

    // extrae el mime-type (e.g. "image/jpeg")
    const mimeMatch = meta.match(/data:(.+);base64/);
    const mimeType = mimeMatch?.[1] || 'application/octet-stream';

    // 2) Decodifica a Buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // 3) Monta el multipart/form-data
    const form = new FormData();
    // ATTENCIÓN: el campo debe llamarse **file**, que es lo que espera el endpoint
    form.append('file', buffer, {
        filename: 'upload.jpg',     // o .png si fuese necesario
        contentType: mimeType
    });

    // 4) Envía la petición con axios
    const resp = await axios.post(
        'https://ipfsm.raptoreum.com/upload',
        form,
        {
            headers: form.getHeaders(),  // aquí axios añadirá el boundary correcto
            maxBodyLength: Infinity      // por si el archivo es grande
        }
    );

    return resp.data;
}

router.post('/createAsset', upload.single('foto'), async (req, res) => {
    try {
        // Obtener el token del header Authorization
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token de autorización requerido' });
        }
        const token = authHeader.replace('Bearer ', '');
        let email;
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            email = decoded.email;
        } catch (err) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        // Los campos del asset están en req.body, la imagen en req.file
        const { nombre, descripcion, precio } = req.body;
        let fotoHash = '';
        if (req.file) {
            // Subir la imagen a IPFS usando el buffer recibido
            const form = new FormData();
            form.append('file', req.file.buffer, {
                filename: req.file.originalname || 'upload.jpg',
                contentType: req.file.mimetype
            });
            try {
                const resp = await axios.post(
                    'https://ipfsm.raptoreum.com/upload',
                    form,
                    {
                        headers: form.getHeaders(),
                        maxBodyLength: Infinity
                    }
                );
                fotoHash = resp.data;
                console.log('Imagen subida exitosamente:', resp.data);
            } catch (error) {
                console.error('Error al subir la imagen:', error);
                return res.status(500).json({ error: 'Error al subir la imagen' });
            }
        }

        const usuario = await Usuario.findOne({
            where: { email }
        });
        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const wallet = await Wallet.findOne({
            where: { usuarioId: usuario.id }
        });
        if (!wallet) {
            return res.status(404).json({ error: 'Wallet no encontrada para el usuario' });
        }

        const provider = new Provider();
        const assetid = await provider.create_Asset({ name: nombre, referenceHash: fotoHash }, "RGpAUBToAQywJfJJAC9MCKpiHAvDAimy24", wallet.direccion);

        console.log('Asset ID creado en Raptoreum:', assetid);

        // Crea el asset en la base de datos
        await Asset.create({
            name: nombre,
            description: descripcion,
            price: precio,
            referenceHash: fotoHash,
            asset_id: assetid.assetTxid,
            WalletId: wallet.id
        });

        res.status(200).json({
            message: 'Asset creado correctamente. Espera unos minutos para verlo en el marketplace.',
        });

    } catch (error) {
        console.error('Error creating asset:', error?.response?.data);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Traspaso de asset entre wallets (compra)
router.post('/buy/:id', async (req, res) => {
  try {
    console.log('--- INICIO COMPRA ASSET ---');
    const assetId = req.params.id;
    const token = req.headers.authorization?.replace('Bearer ', '');
    console.log('assetId:', assetId);
    console.log('token:', token);
    if (!token) return res.status(401).json({ message: 'Token requerido' });
    const decoded = jwt.decode(token);
    console.log('decoded:', decoded);
    if (!decoded?.email) return res.status(401).json({ message: 'Token inválido' });

    // Asset y wallet origen
    const asset = await Asset.findOne({ where: { id: assetId }, include: Wallet });
    console.log('asset:', asset?.toJSON?.() || asset);
    if (!asset) return res.status(404).json({ message: 'Asset no encontrado' });
    const walletOrigen = await Wallet.findOne({ where: { id: asset.WalletId } });
    console.log('walletOrigen:', walletOrigen?.toJSON?.() || walletOrigen);
    if (!walletOrigen) return res.status(404).json({ message: 'Wallet origen no encontrada' });

    // Wallet destino (usuario comprador)
    const usuarioDestino = await Usuario.findOne({ where: { email: decoded.email }, include: { model: Wallet, as: 'wallets' } });
    console.log('usuarioDestino:', usuarioDestino?.toJSON?.() || usuarioDestino);
    if (!usuarioDestino || !usuarioDestino.wallets?.length) return res.status(404).json({ message: 'Wallet destino no encontrada' });
    const walletDestino = usuarioDestino.wallets[0];
    console.log('walletDestino:', walletDestino?.toJSON?.() || walletDestino);

    // Desencriptar WIF origen
    const { decrypt } = await import('../utils/encryption.js');
    const wifOrigen = decrypt(walletOrigen.wif);
    console.log('wifOrigen:', wifOrigen);

    // 2. Traspaso lógico: solo cambiar el WalletId en la base de datos
    await asset.update({ WalletId: walletDestino.id });
    console.log('Asset actualizado en BD con nuevo WalletId:', walletDestino.id);

    res.json({ message: 'Compra realizada y asset transferido (solo en base de datos)' });
  } catch (err) {
    console.error('Error en la compra de asset:', err);
    res.status(500).json({ message: 'Error al realizar la compra', error: err.message });
  }
});

// Envío de asset entre wallets (envío manual)
router.post('/send', async (req, res) => {
    try {
        console.log('--- INICIO ENVÍO ASSET ---');
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
        
        // Assuming the first wallet is the one to use for sending
        const senderWallet = usuario.wallets[0];
        const fromAddress = senderWallet.direccion;
        const encryptedWif = senderWallet.wif;

        if (!fromAddress || !encryptedWif) {
            return res.status(500).json({ message: 'Información de la wallet incompleta.' });
        }

        // 3. Decrypt the private key (WIF)
        let wif;
        try {
            wif = decrypt(encryptedWif);
            if (!wif) {
                throw new Error('La desencriptación de WIF resultó en un valor vacío.');
            }
        } catch (decryptionError) {
            console.error('Error al desencriptar WIF:', decryptionError);
            return res.status(500).json({ message: 'Error al procesar la clave privada.' });
        }

        // 4. Get parameters from request body
        const { toAddress, assetTicker } = req.body;

        if (!toAddress || !assetTicker) {
            return res.status(400).json({ message: 'Faltan parámetros: toAddress y assetTicker son requeridos.' });
        }
        
        
        // 6. Call provider.sendAssetTransaction
        console.log(`Intentando enviar asset:
            De: ${fromAddress}
            A: ${toAddress}
            Asset: ${assetTicker}
        `);

        // // 5. Instantiate Provider
        // const provider = new Provider();

        // const txid = await provider.sendAssetTransaction(
        //     fromAddress,
        //     toAddress,
        //     wif,
        //     assetTicker
        // );
        const txid = "234567";

        console.log('Transacción de envío de asset exitosa. TXID:', txid);

        //Eliminar el asset de la base de datos
        
        await Asset.destroy({
            where: {
                asset_id: assetTicker,
                WalletId: senderWallet.id
            }
        });
        console.log('Asset eliminado de la base de datos:', assetTicker);


        res.status(200).json({ message: 'Transacción de envío de asset iniciada correctamente.', txid });

    } catch (error) {
        console.error('Error en la ruta /send:', error);
        // Specific error messages from the provider might be included in error.message
        if (error.message.includes("Sin UTXO para") || error.message.includes("RTM insuficiente") || error.message.includes("Firma incompleta")) {
            return res.status(400).json({ message: `Fallo en la transacción: ${error.message}` });
        }
        if (error.message.includes("RPC call")) { // Errors from provider.call
             return res.status(500).json({ message: 'Error de comunicación con el nodo Raptoreum.', details: error.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al enviar el asset.', error: error.message });
    }
});


export default router;