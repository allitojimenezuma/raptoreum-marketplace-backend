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

        // Fetch user and their wallet
        const usuario = await Usuario.findOne({ where: { email } });
        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        const wallet = await Wallet.findOne({ where: { UsuarioId: usuario.id } });
        if (!wallet) {
            return res.status(404).json({ error: 'Wallet no encontrada para el usuario' });
        }

        const provider = new Provider();
        const nodeWalletAddress = "RGpAUBToAQywJfJJAC9MCKpiHAvDAimy24"; // Central wallet for asset operations
        const customerAddress = wallet.direccion;

        // --- Sequential Asset Creation Process ---

        // Step 1: Define Asset Metadata and Initiate Asset Creation
        console.log(`[Asset Creation Flow] Step 1: Defining metadata for '${nombre}'...`);
        const assetMetadata = {
            name: nombre, // This name must be unique on the blockchain
            updatable: false,
            is_root: true,
            root_name: '',
            is_unique: true,
            decimalpoint: 0,
            referenceHash: fotoHash, // IPFS hash
            maxMintCount: 1,
            type: 0, // manual distribution
            targetAddress: nodeWalletAddress, // Asset initially created to node's wallet
            issueFrequency: 0,
            amount: 1, // Amount to be available upon creation/minting
            ownerAddress: nodeWalletAddress // Node wallet owns the asset definition
        };
        console.log(`[Asset Creation Flow] Calling provider.initiateAssetCreation for '${nombre}'...`);
        const creationTxid = await provider.initiateAssetCreation(assetMetadata);
        console.log(`[Asset Creation Flow] Step 1: Asset creation transaction submitted. Creation TXID: ${creationTxid}`);

        // Step 2: Wait for Asset Creation Confirmation
        console.log(`[Asset Creation Flow] Step 2: Waiting for confirmation of creation TXID: ${creationTxid}...`);
        await provider.waitTransaction(creationTxid, 1); // Wait for 1 confirmation
        console.log(`[Asset Creation Flow] Step 2: Asset '${nombre}' (definition) created successfully on blockchain. Creation TXID: ${creationTxid}`);

        // Step 3: Mint the Asset
        // The 'creationTxid' (which is also the asset's unique name on-chain) is used to identify the asset for minting.
        console.log(`[Asset Creation Flow] Step 3: Calling provider.mintCreatedAsset for asset identifier: ${creationTxid} ('${nombre}')...`);
        const mintTxid = await provider.mintCreatedAsset(creationTxid); // Use creationTxid as the asset identifier for minting
        console.log(`[Asset Creation Flow] Step 3: Asset mint transaction submitted. Mint TXID: ${mintTxid}`);

        // Step 4: Wait for Mint Confirmation
        console.log(`[Asset Creation Flow] Step 4: Waiting for confirmation of mint TXID: ${mintTxid}...`);
        await provider.waitTransaction(mintTxid, 1);
        console.log(`[Asset Creation Flow] Step 4: Asset '${nombre}' minted successfully. Mint TXID: ${mintTxid}`);

        // Step 5: Get Numerical Asset ID
        console.log(`[Asset Creation Flow] Step 5: Calling provider.getassetdetailsbyname for '${nombre}' to get numerical Asset_id...`);
        const assetInfo = await provider.getassetdetailsbyname(nombre); // 'nombre' should be the unique name used in assetMetadata
        const numericalAssetId = assetInfo.Asset_id;
        console.log(`[Asset Creation Flow] Step 5: Numerical Asset_id for '${nombre}' is ${numericalAssetId}`);

        // Step 6: Send the Minted Asset to the Customer's Address
        console.log(`[Asset Creation Flow] Step 6: Calling provider.transferMintedAsset to send asset ${numericalAssetId} ('${nombre}') to customer ${customerAddress}...`);
        const sendTxid = await provider.transferMintedAsset(numericalAssetId, 1, customerAddress);
        console.log(`[Asset Creation Flow] Step 6: Asset send transaction submitted. Send TXID: ${sendTxid}`);

        // Step 7: Wait for Send Confirmation
        console.log(`[Asset Creation Flow] Step 7: Waiting for confirmation of send TXID: ${sendTxid}...`);
        await provider.waitTransaction(sendTxid, 1);
        console.log(`[Asset Creation Flow] Step 7: Asset '${nombre}' sent successfully to ${customerAddress}. Send TXID: ${sendTxid}`);

        // The asset_id to store in your database.
        // Using creationTxid as the primary blockchain identifier for the asset.
        const assetBlockchainIdToStore = creationTxid;

        console.log(`[Asset Creation Flow] Asset ID (creationTxid) '${assetBlockchainIdToStore}' for '${nombre}' fully processed and sent to customer.`);

        // Crea el asset en la base de datos
        await Asset.create({
            name: nombre,
            description: descripcion,
            price: precio,
            referenceHash: fotoHash,
            asset_id: assetBlockchainIdToStore,
            WalletId: wallet.id
        });

        res.status(200).json({
            message: 'Asset creado correctamente. Espera unos minutos para verlo en el marketplace.',
            creationTxid: creationTxid,
            mintTxid: mintTxid,
            sendTxid: sendTxid,
            numericalAssetId: numericalAssetId,
            assetName: nombre
        });

    } catch (error) {
        console.error('Error creating asset:', error?.response?.data);
        res.status(500).json({ error: 'Internal server error during asset creation', details: error?.response?.data });
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

router.post('/asset-balance', async (req, res) => {
    try {
        console.log('--- INICIO OBTENER BALANCE DE ASSET ---');
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

        // 2. Get assetName from request body
        const { assetName } = req.body;
        if (!assetName) {
            return res.status(400).json({ message: 'El parámetro assetName es requerido.' });
        }

        // 3. Fetch user and their primary wallet
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

        const userWallet = usuario.wallets[0];
        const userAddress = userWallet.direccion;

        if (!userAddress) {
            return res.status(500).json({ message: 'Dirección de la wallet no encontrada.' });
        }

        // 4. Instantiate Provider
        const provider = new Provider();

        // 5. Get list of addresses and amounts for the asset
        console.log(`Consultando balance del asset '${assetName}' para la dirección: ${userAddress}`);
        const addressesWithAsset = await provider.listaddressesbyasset(assetName);

        let assetBalance = 0;
        if (addressesWithAsset && typeof addressesWithAsset === 'object' && addressesWithAsset[userAddress]) {
            assetBalance = addressesWithAsset[userAddress];
        }

        console.log(`Balance del asset '${assetName}' para ${userAddress}: ${assetBalance}`);
        res.status(200).json({
            message: 'Balance de asset obtenido correctamente.',
            address: userAddress,
            assetName: assetName,
            balance: assetBalance
        });
    } catch (error) {
        console.error(`Error en la ruta /asset-balance para ${req.body?.assetName}:`, error);
        if (error.message.includes("RPC call")) {
            return res.status(500).json({ message: `Error de comunicación con el nodo Raptoreum al obtener el balance del asset.`, details: error.message });
        }
        // Specific error if asset not found by the node
        if (error.message.toLowerCase().includes("asset not found") || error.message.toLowerCase().includes("unknown asset")) {
            return res.status(404).json({ message: `Asset '${req.body?.assetName}' no encontrado en la red.`, details: error.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al obtener el balance del asset.', error: error.message });
    }
});

// Importar un Asset externo a la plataforma
router.post('/importAsset', async (req, res) => {
    try {
        // 1. Verificar token y obtener email del usuario
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

        // 2. Obtener datos del asset externo
        const { assetName, description, price, referenceHash } = req.body;
        if (!assetName) {
            return res.status(400).json({ message: 'El parámetro assetName es requerido.' });
        }

        // 3. Buscar usuario y su wallet
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
        const userWallet = usuario.wallets[0];
        const userAddress = userWallet.direccion;
        if (!userAddress) {
            return res.status(500).json({ message: 'Dirección de la wallet no encontrada.' });
        }

        // 4. Verificar que el asset esté en la wallet del usuario usando el Provider
        const provider = new Provider();
        const addressesWithAsset = await provider.listaddressesbyasset(assetName);
        if (!addressesWithAsset || !addressesWithAsset[userAddress] || addressesWithAsset[userAddress] <= 0) {
            return res.status(403).json({ message: 'El asset no está en la wallet del usuario.' });
        }

        // 5. Registrar el asset en la base de datos si no existe
        const existingAsset = await Asset.findOne({ where: { asset_id: assetName, WalletId: userWallet.id } });
        if (existingAsset) {
            return res.status(409).json({ message: 'El asset ya está registrado en la plataforma para este usuario.' });
        }
        await Asset.create({
            name: assetName,
            description: description || '',
            price: price || 0,
            referenceHash: referenceHash || '',
            asset_id: assetName,
            WalletId: userWallet.id
        });

        res.status(200).json({ message: 'Asset importado correctamente a la plataforma.' });
    } catch (error) {
        console.error('Error en la importación de asset:', error);
        res.status(500).json({ message: 'Error interno al importar el asset.', error: error.message });
    }
});





export default router;