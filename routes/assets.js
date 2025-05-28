import axios from 'axios';
import FormData from 'form-data';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Asset, Usuario, Wallet } from '../model/index.js';

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
        let fotoHash;
        // uploadBase64Image(foto)
        //     .then(async (response) => {
        //         fotoHash = response; // Guarda el hash de la imagen subida
        //         console.log('Imagen subida exitosamente:', response);
        //     })
        //     .catch((error) => {
        //         console.error('Error al subir la imagen:', error);
        //         res.status(500).json({ error: 'Error al subir la imagen' });
        //     });

        /*
        ------------------------------------------------------------------------------------------------------------------------------------------------+
| Assets | CREATE TABLE `Assets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `asset_id` varchar(255) DEFAULT NULL,
  `WalletId` int DEFAULT NULL,
  `referenceHash` varchar(255) DEFAULT NULL,
  `descipcion` varchar(255) DEFAULT NULL,
  `precio` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `WalletId` (`WalletId`),
  CONSTRAINT `Assets_ibfk_1` FOREIGN KEY (`WalletId`) REFERENCES `Wallets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci |
        */

        const nombre = req.body.nombre;
        const descripcion = req.body.descripcion;
        const precio = req.body.precio;
        const token = req.body.token;
        const email = jwt.decode(token).email;

        console.log("email:", email);
        const usuario = await Usuario.findOne({
            where: {
                email
            }
        });
        console.log('Usuario encontrado:', usuario.id);

        const wallet = await Wallet.findOne({
            where: {
                usuarioId: usuario.id
            }
        });

        console.log('Wallet encontrada:', wallet.id);

        



        // Asset.create({
        //     nombre: nombre,
        //     descipcion: descripcion,
        //     precio: precio,
        //     referenceHash: fotoHash,
        //     WalletId: wallet.id
        // })





    } catch (error) {
        console.error('Error creating asset:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;