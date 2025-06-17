import express from 'express';
import jwt from 'jsonwebtoken';
import { Offer, Usuario, Asset, Wallet } from '../model/index.js'; // Asegúrate que las importaciones sean correctas
import { Op } from 'sequelize'; // Para operadores como OR
import { transferAsset } from '../utils/blockchainService.js';
import { decrypt } from '../utils/encryption.js';
import sequelize from '../db.js';

const router = express.Router();

// Middleware para verificar JWT y añadir usuario a req (opcional pero recomendado)
// Podrías tener este middleware en otro lugar y usarlo aquí
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401); // Si no hay token, no autorizado

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Si el token no es válido
        req.user = user; // Añade el payload del token (que debería incluir el email o id del usuario)
        next();
    });
};

// --- RUTA PARA OBTENER OFERTAS HECHAS POR EL USUARIO AUTENTICADO ---
router.get('/my/made', authenticateToken, async (req, res) => {
    try {
        const userEmail = req.user.email; // Asumiendo que el email está en el token
        const usuario = await Usuario.findOne({ where: { email: userEmail } });

        if (!usuario) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const madeOffers = await Offer.findAll({
            where: { OffererUserId: usuario.id },
            include: [
                {
                    model: Asset,
                    as: 'asset', // Alias definido en la asociación Offer.belongsTo(Asset)
                    attributes: ['id', 'name', 'asset_id', 'isListed'],
                    include: { // Para obtener el nombre del dueño actual del asset
                        model: Wallet, // Asumiendo que Asset tiene WalletId
                        as: 'Wallet', // Alias de Asset.belongsTo(Wallet)
                        include: {
                            model: Usuario,
                            as: 'Usuario', // Alias de Wallet.belongsTo(Usuario)
                            attributes: ['id', 'name', 'email']
                        }
                    }
                },
                {
                    model: Usuario,
                    as: 'assetOwnerAtTimeOfOffer', // Alias definido en Offer.belongsTo(Usuario, { as: 'assetOwnerAtTimeOfOffer' })
                    attributes: ['id', 'name', 'email']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json(madeOffers);

    } catch (error) {
        console.error('Error al obtener ofertas hechas:', error);
        res.status(500).json({ message: 'Error interno al obtener las ofertas hechas.', error: error.message });
    }
});

// --- RUTA PARA OBTENER OFERTAS RECIBIDAS POR EL USUARIO AUTENTICADO (EN SUS ASSETS) ---
router.get('/my/received', authenticateToken, async (req, res) => {
    try {
        const userEmail = req.user.email; // Asumiendo que el email está en el token
        const usuario = await Usuario.findOne({ where: { email: userEmail } });

        if (!usuario) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        // Encuentra todos los assets que pertenecen actualmente al usuario
        const userAssets = await Asset.findAll({
            attributes: ['id'], // Solo necesitamos los IDs de los assets
            include: [{
                model: Wallet,
                as: 'Wallet',
                where: { UsuarioId: usuario.id } // Filtra por las wallets del usuario
            }]
        });

        if (!userAssets || userAssets.length === 0) {
            return res.status(200).json([]); // El usuario no tiene assets, por lo tanto no hay ofertas recibidas
        }

        const userAssetIds = userAssets.map(asset => asset.id);

        const receivedOffers = await Offer.findAll({
            where: {
                AssetId: { [Op.in]: userAssetIds }, // Ofertas para los assets del usuario
                status: 'pending' // Opcional: mostrar solo ofertas pendientes de acción
                // También podrías filtrar para que OwnerUserId sea el usuario.id,
                // pero AssetId es más directo si el asset aún le pertenece.
                // OwnerUserId: usuario.id // Si quieres ser estricto con quién era el dueño al momento de la oferta
            },
            include: [
                {
                    model: Asset,
                    as: 'asset',
                    attributes: ['id', 'name', 'asset_id', 'isListed']
                },
                {
                    model: Usuario,
                    as: 'offerer', // Alias definido en Offer.belongsTo(Usuario, { as: 'offerer' })
                    attributes: ['id', 'name', 'email']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json(receivedOffers);

    } catch (error) {
        console.error('Error al obtener ofertas recibidas:', error);
        res.status(500).json({ message: 'Error interno al obtener las ofertas recibidas.', error: error.message });
    }
});

// --- RUTA PARA CREAR UNA NUEVA OFERTA POR UN ASSET ---
router.post('/makeOffer', authenticateToken, async (req, res) => {
    try {
        const userEmail = req.user.email; // Email del oferente desde el token
        const { assetId, offerPrice, expiresAt } = req.body; // assetId es el ID de la BBDD del asset

        // 1. Validar entrada
        if (!assetId || offerPrice === undefined || offerPrice === null) {
            return res.status(400).json({ message: 'assetId y offerPrice son requeridos.' });
        }
        const price = parseFloat(offerPrice);
        if (isNaN(price) || price <= 0) {
            return res.status(400).json({ message: 'offerPrice debe ser un número positivo.' });
        }
        let parsedExpiresAt = null;
        if (expiresAt) {
            parsedExpiresAt = new Date(expiresAt);
            if (isNaN(parsedExpiresAt.getTime()) || parsedExpiresAt <= new Date()) {
                return res.status(400).json({ message: 'expiresAt debe ser una fecha válida y futura.' });
            }
        } else {
            // Si no se envía, poner 24h después de ahora
            parsedExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        }

        // 2. Obtener el usuario oferente
        const offerer = await Usuario.findOne({ where: { email: userEmail } });
        if (!offerer) {
            return res.status(404).json({ message: 'Usuario oferente no encontrado.' });
        }

        // 3. Obtener el asset y su propietario actual
        const asset = await Asset.findOne({
            where: { id: assetId },
            include: [{
                model: Wallet,
                as: 'Wallet', // Alias de Asset.belongsTo(Wallet)
                include: [{
                    model: Usuario,
                    as: 'Usuario' // Alias de Wallet.belongsTo(Usuario)
                }]
            }]
        });

        if (!asset) {
            return res.status(404).json({ message: 'Asset no encontrado.' });
        }
        if (!asset.Wallet || !asset.Wallet.Usuario) {
            return res.status(500).json({ message: 'No se pudo determinar el propietario del asset.' });
        }
        if (!asset.isListed) {
            return res.status(400).json({ message: 'Este asset no está actualmente listado para la venta o para recibir ofertas.' });
        }

        const assetOwner = asset.Wallet.Usuario;

        // 4. Verificar que el oferente no sea el propietario actual del asset
        if (offerer.id === assetOwner.id) {
            return res.status(400).json({ message: 'No puedes hacer una oferta por un asset que ya te pertenece.' });
        }

        // 5. Verificar si ya existe una oferta activa del mismo usuario por el mismo asset
        const existingOffer = await Offer.findOne({
            where: {
                AssetId: asset.id,
                OffererUserId: offerer.id,
                status: 'pending' // Solo considerar ofertas pendientes
            }
        });

        if (existingOffer) {
            return res.status(400).json({ message: 'Ya tienes una oferta pendiente para este asset. Puedes cancelarla o esperar a que expire/sea respondida.' });
        }

        // 6. Crear la nueva oferta
        const newOffer = await Offer.create({
            offerPrice: price,
            status: 'pending',
            expiresAt: parsedExpiresAt,
            AssetId: asset.id,
            OffererUserId: offerer.id,
            OwnerUserId: assetOwner.id // ID del propietario del asset en el momento de la oferta
        });

        // 7. Opcional: Enviar notificación al propietario del asset (implementación no incluida aquí)

        res.status(201).json({
            message: 'Oferta creada exitosamente.',
            offer: newOffer
        });

    } catch (error) {
        console.error('Error al crear la oferta:', error);
        res.status(500).json({ message: 'Error interno al crear la oferta.', error: error.message });
    }
});

// --- RUTA PARA ACEPTAR UNA OFERTA ---
router.post('/:offerId/accept', authenticateToken, async (req, res) => {
    const { offerId } = req.params;
    let userId = req.user.id;
    if (!userId && req.user.email) {
        const usuario = await Usuario.findOne({ where: { email: req.user.email } });
        if (usuario) userId = usuario.id;
    }
    const t = await sequelize.transaction();
    try {
        // 1. Buscar la oferta y el asset
        const offer = await Offer.findOne({ where: { id: offerId, status: 'pending' }, transaction: t });
        if (!offer) return res.status(404).json({ message: 'Oferta no encontrada o ya procesada.' });

        const asset = await Asset.findOne({
            where: { id: offer.AssetId },
            include: [{
                model: Wallet,
                as: 'Wallet',
                include: [{ model: Usuario, as: 'Usuario' }]
            }],
            transaction: t
        });
        if (!asset) return res.status(404).json({ message: 'Asset no encontrado.' });
        if (!asset.Wallet || !asset.Wallet.Usuario) return res.status(500).json({ message: 'No se pudo determinar el propietario del asset.' });
        if (asset.Wallet.Usuario.id !== userId) return res.status(403).json({ message: 'No eres el propietario del asset.' });

        // 2. Obtener wallets y WIFs
        const sellerWallet = asset.Wallet;
        const sellerAddress = sellerWallet.direccion;
        const sellerEncryptedWif = sellerWallet.wif;
        const sellerWif = decrypt(sellerEncryptedWif); // Desencripta el WIF antes de usarlo
        const assetBlockchainId = asset.name;
        const offerer = await Usuario.findOne({ where: { id: offer.OffererUserId } });
        if (!offerer) return res.status(404).json({ message: 'Usuario oferente no encontrado.' });
        const offererWallet = await Wallet.findOne({ where: { UsuarioId: offerer.id } });
        if (!offererWallet) return res.status(404).json({ message: 'Wallet del ofertante no encontrada.' });
        const offererAddress = offererWallet.direccion;

        // 3. Transferir el asset en blockchain
        const { success, txid, message } = await transferAsset({
            fromAddress: sellerAddress,
            toAddress: offererAddress,
            wif: sellerWif, // Usa el WIF desencriptado
            assetName: assetBlockchainId
        });
        if (!success) throw new Error('Error en la transacción blockchain: ' + message);

        // 4. Actualizar la base de datos
        await asset.update({ WalletId: offererWallet.id }, { transaction: t });
        offer.status = 'accepted';
        offer.acceptedAt = new Date();
        offer.txid = txid;
        await offer.save({ transaction: t });
        // Rechazar otras ofertas pendientes para ese asset
        await Offer.update(
            { status: 'rejected' },
            { where: { AssetId: asset.id, status: 'pending', id: { [Op.ne]: offer.id } }, transaction: t }
        );
        await t.commit();
        return res.json({ message: 'Oferta aceptada y asset transferido en blockchain.', txid });
    } catch (err) {
        await t.rollback();
        return res.status(500).json({ message: err.message || 'Error al aceptar la oferta.' });
    }
});

// --- RUTA PARA CANCELAR UNA OFERTA (por el oferente, versión debug) ---
router.post('/:offerId/cancel', authenticateToken, async (req, res) => {
    const { offerId } = req.params;
    let userId = req.user.id;
    if (!userId && req.user.email) {
        // Busca el usuario por email si el id no está en el token
        const usuario = await Usuario.findOne({ where: { email: req.user.email } });
        if (usuario) userId = usuario.id;
    }
    console.log('Intentando cancelar oferta:', offerId, 'por usuario:', userId);
    try {
        // Busca la oferta y verifica que el usuario sea el que la creó y que esté pendiente
        const offer = await Offer.findOne({ where: { id: offerId, OffererUserId: userId, status: 'pending' } });
        console.log('Resultado búsqueda de oferta:', offer);
        if (!offer) {
            console.log('No se encontró la oferta o ya no está pendiente/corresponde al usuario.');
            return res.status(404).json({ message: 'Oferta no encontrada o ya procesada.' });
        }

        offer.status = 'cancelled';
        offer.updatedAt = new Date();
        await offer.save();
        console.log('Oferta cancelada correctamente:', offer.id);

        return res.json({ message: 'Oferta cancelada correctamente.' });
    } catch (err) {
        console.error('Error al cancelar la oferta:', err);
        return res.status(500).json({ message: 'Error al cancelar la oferta.', error: err.message });
    }
});


export default router;