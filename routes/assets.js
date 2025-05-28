import axios from 'axios';
import FormData from 'form-data';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Asset, Usuario, Wallet } from '../model/index.js';
import { Provider } from 'rtnft-client';

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

router.post('/createAsset', async (req, res) => {
    try {
        const foto = req.body.foto;
        let fotoHash = '';
        if (foto) {
            await uploadBase64Image(foto)
                .then(async (response) => {
                    fotoHash = response; // Guarda el hash de la imagen subida
                    console.log('Imagen subida exitosamente:', response);
                })
                .catch((error) => {
                    console.error('Error al subir la imagen:', error);
                    res.status(500).json({ error: 'Error al subir la imagen' });
                });
        }


        const nombre = req.body.nombre;
        const descripcion = req.body.descripcion;
        const precio = req.body.precio;
        const token = req.body.token;
        const email = jwt.decode(token).email;

        const usuario = await Usuario.findOne({
            where: {
                email
            }
        });

        const wallet = await Wallet.findOne({
            where: {
                usuarioId: usuario.id
            }
        });

        const provider = new Provider(); //Provider de Raptoreum
        const assetid = await provider.create_Asset({ name: nombre, referenceHash: fotoHash }, "dirNode", "dirCustomer");

        console.log('Asset ID creado en Raptoreum:', assetid);

        // Crea el asset en la base de datos
        await Asset.create({
            name: nombre,
            description: descripcion,
            price : precio,
            referenceHash: fotoHash,
            asset_id: assetid, 
            WalletId: wallet.id
        });

        res.status(200).json({
            message: 'Asset created successfully. Wait at least 10 minutes to see it in the marketplace.',
        });

    } catch (error) {
        console.error('Error creating asset:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;