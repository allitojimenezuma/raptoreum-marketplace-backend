# Raptoreum Marketplace Backend

## Índice
1. [Introducción](#introducción)
2. [Características Principales](#características-principales)
3. [Tecnologías Utilizadas](#tecnologías-utilizadas)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Configuración e Instalación](#configuración-e-instalación)
6. [Guía de la API (Endpoints)](#guía-de-la-api-endpoints)
    - [Autenticación (`/auth`)](#autenticación-auth)
    - [Usuarios (`/user`)](#usuarios-user)
    - [Assets (`/assets`)](#assets-assets)
    - [Ofertas (`/offers`)](#ofertas-offers)
    - [Rutas Principales (`/`)](#rutas-principales-)
7. [Flujos de Trabajo Clave](#flujos-de-trabajo-clave)
    - [Creación de un Asset (NFT)](#creación-de-un-asset-nft)
    - [Compra de un Asset](#compra-de-un-asset)
    - [Sistema de Ofertas](#sistema-de-ofertas)
    - [Sincronización con la Blockchain](#sincronización-con-la-blockchain)

---

## Introducción

Este repositorio contiene el código fuente del backend para un marketplace de activos digitales (NFTs) construido sobre la blockchain de **Raptoreum**, inspirado en plataformas como OpenSea.

El sistema gestiona usuarios, wallets, la creación (minteo), compra, venta y transferencia de assets en la red de Raptoreum. Se comunica directamente con un nodo de Raptoreum a través de RPC para ejecutar transacciones on-chain y utiliza una base de datos MySQL para almacenar metadatos, información de usuarios y el historial de transacciones, manteniendo la consistencia entre la data off-chain y on-chain.

## Características Principales

- **Gestión de Usuarios:** Sistema completo de autenticación con registro, verificación por correo electrónico, inicio de sesión con JWT y recuperación de contraseña.
- **Wallets Integradas:** Creación automática de una wallet de Raptoreum para cada nuevo usuario, con almacenamiento seguro de claves privadas (WIF).
- **Creación de Assets (NFTs):**
    - Flujo completo de creación, minteo y transferencia de assets en la blockchain de Raptoreum.
    - Subida de imágenes y metadatos a IPFS a través del servicio `ipfsm.raptoreum.com`.
- **Marketplace Funcional:**
    - Poner assets a la venta y retirarlos del mercado.
    - Actualización de precios y descripciones.
    - Compra directa de assets con un flujo de pago RTM y transferencia del asset.
- **Sistema de Ofertas:**
    - Los usuarios pueden hacer ofertas por assets que no están a la venta.
    - Los propietarios pueden ver, aceptar o rechazar las ofertas recibidas.
    - La aceptación de una oferta desencadena automáticamente el pago en RTM y la transferencia del asset.
- **Sincronización con la Blockchain:**
    - Herramientas para detectar y registrar en la plataforma assets que un usuario ya posee en su wallet de Raptoreum.
    - Consulta de balances de RTM y de assets específicos directamente desde el nodo.
- **Historial de Transacciones:** Registro detallado de todas las operaciones (creación, compra, venta, importación) para cada asset y cada usuario.

## Tecnologías Utilizadas

- **Backend:** Node.js, Express.js
- **Base de Datos:** MySQL con el ORM Sequelize.
- **Interacción Blockchain:** [raptoreum.js](https://www.npmjs.com/package/raptoreum.js) para la comunicación RPC con un nodo de Raptoreum.
- **Autenticación:** JSON Web Tokens (JWT) para sesiones seguras.
- **Seguridad:** `bcrypt` para el hasheo de contraseñas y un sistema de encriptación/desencriptación para las claves WIF de las wallets.
- **Servicios de Correo:** `Nodemailer` para el envío de correos de verificación y recuperación de contraseña.
- **Gestión de Archivos:** `Multer` y `form-data` para la gestión de subidas de imágenes a IPFS.
- **Variables de Entorno:** `dotenv`.

## Estructura del Proyecto

El proyecto está organizado de la siguiente manera para mantener una clara separación de responsabilidades:

```
/
├── model/                # Modelos de la base de datos (Sequelize)
│   ├── Asset.js
│   ├── index.js          # Definición de modelos y asociaciones
│   ├── Offer.js
│   ├── TransactionHistory.js
│   ├── Usuario.js
│   └── Wallet.js
├── routes/               # Definición de las rutas de la API
│   ├── assets.js
│   ├── auth.js
│   ├── main.js
│   ├── offers.js
│   └── user.js
├── utils/                # Funciones y utilidades auxiliares
│   ├── blockchainService.js
│   ├── encryption.js
│   └── multer.js
├── app.js                # Punto de entrada principal de la aplicación Express
├── db.js                 # Configuración de la conexión a la base de datos
├── sync.js               # Script para sincronizar los modelos con la BD
└── .env.example          # Archivo de ejemplo para las variables de entorno
```

## Configuración e Instalación

Sigue estos pasos para poner en marcha el proyecto en un entorno local.

### Prerrequisitos
- Node.js (v16 o superior)
- Acceso a una base de datos MySQL.
- Un nodo de Raptoreum Core corriendo y completamente sincronizado, con la API RPC habilitada.

### Pasos

1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/tu-usuario/raptoreum-opensea-backend.git
    cd raptoreum-opensea-backend
    ```

2.  **Instalar dependencias:**
    ```bash
    npm install
    ```

3.  **Configurar variables de entorno:**
    Crea un archivo `.env` en la raíz del proyecto, copiando el contenido de `.env.example` y rellenando los valores correspondientes.

    ```env
    # Base de Datos
    DB_HOST=tu_host_mysql
    DB_USER=tu_usuario_mysql
    DB_PASS=tu_password_mysql
    DB_NAME=RaptoreumAssetTracking

    # RPC del nodo Raptoreum
    RPC_USER=tu_usuario_rpc
    RPC_PASSWORD=tu_password_rpc
    RPC_PORT=19998
    RPC_HOST=127.0.0.1

    # JWT
    JWT_SECRET=tu_secreto_muy_largo_y_seguro_para_jwt

    # Email (usando Gmail como ejemplo)
    EMAIL_USER=tu_correo@gmail.com
    EMAIL_PASS=tu_contraseña_de_aplicacion_de_gmail

    # API Externa (CoinMarketCap para precio de RTM)
    CMC_PRO_API_KEY=tu_api_key_de_coinmarketcap
    ```

4.  **Sincronizar la Base de Datos:**
    Este comando creará las tablas en tu base de datos MySQL basándose en los modelos de Sequelize.
    ```bash
    node sync.js
    ```

5.  **Iniciar el servidor:**
    ```bash
    npm start
    ```
    El servidor se iniciará por defecto en `http://localhost:3000`.

## Guía de la API (Endpoints)

Todas las rutas que requieren autenticación esperan un `Bearer Token` en el header `Authorization`.

### Autenticación (`/auth`)

-   `POST /signup`: Registra un nuevo usuario. Requiere `name`, `email`, `password`. Envía un correo de verificación.
-   `GET /verify`: Endpoint al que apunta el enlace de verificación. Recibe un token como query param. Al verificar, crea el usuario y su wallet en la BD.
-   `POST /login`: Inicia sesión. Requiere `email` y `password`. Devuelve un JWT y datos básicos del usuario.

### Usuarios (`/user`)

-   `POST /info`: Obtiene la información completa del usuario autenticado, incluyendo sus wallets y los assets que posee.
-   `GET /balance`: Devuelve el balance de RTM del usuario autenticado.
-   `GET /history`: Devuelve el historial de transacciones (compras y ventas) del usuario.
-   `POST /request-password-change`: Inicia el proceso de recuperación de contraseña. Requiere `email`.
-   `POST /reset-password`: Establece una nueva contraseña. Requiere `token`, `newPassword`, `confirmPassword`.

### Assets (`/assets`)

-   `POST /createAsset`: Crea un nuevo asset. Requiere un `form-data` con los campos `nombre`, `descripcion`, `precio` y un archivo `foto`.
-   `POST /buy/:id`: Compra un asset. El `:id` es el ID del asset en la base de datos.
-   `POST /send`: Envía un asset que posee el usuario a otra dirección de Raptoreum. Requiere `toAddress` y `assetTicker` (nombre del asset).
-   `PUT /:assetDbId/toggle-listing`: Pone a la venta o retira del mercado un asset. Requiere un booleano `isListed` en el body.
-   `PUT /updatePrice/:id`: Actualiza el precio de un asset. Requiere `precio` en el body.
-   `PUT /updateDescription/:id`: Actualiza la descripción de un asset. Requiere `description` en el body.
-   `POST /asset-balance`: Devuelve la cantidad que el usuario posee de un asset específico. Requiere `assetName`.
-   `GET /missingAssets`: Compara los assets en la wallet del usuario (on-chain) con los registrados en la BD y devuelve los que faltan por importar.
-   `POST /importMissingAssets`: Importa a la plataforma todos los assets detectados por la ruta `/missingAssets`.
-   `GET /:id/history`: Devuelve el historial de transacciones de un asset específico.

### Ofertas (`/offers`)

-   `POST /makeOffer`: Crea una oferta por un asset. Requiere `assetId` (ID de la BD), `offerPrice` y opcionalmente `expiresAt`.
-   `GET /my/made`: Devuelve todas las ofertas hechas por el usuario autenticado.
-   `GET /my/received`: Devuelve todas las ofertas recibidas en los assets del usuario autenticado.
-   `POST /:offerId/accept`: Acepta una oferta recibida. El propietario del asset debe llamar a esta ruta.

### Rutas Principales (`/`)

-   `GET /assets`: Devuelve una lista de todos los assets que están a la venta (`isListed: true`).
-   `GET /asset/:id`: Devuelve los detalles de un asset específico, incluyendo el nombre de su propietario.
-   `GET /get-rtm-price`: Devuelve el precio actual de RTM en USD desde CoinMarketCap.

## Flujos de Trabajo Clave

### Creación de un Asset (NFT)

La creación de un asset es un proceso de varios pasos que garantiza la atomicidad y el registro correcto tanto en la blockchain como en la base de datos:
1.  **Subida a IPFS:** La imagen del asset se sube a IPFS para obtener un hash de referencia inmutable.
2.  **Creación (On-chain):** Se llama a `initiateAssetCreation` en el nodo de Raptoreum. Esta transacción define el asset y es la que genera su identificador único (el `creationTxid`).
3.  **Minteo (On-chain):** Una vez confirmada la creación, se llama a `mintCreatedAsset` para acuñar la primera y única copia del NFT.
4.  **Transferencia (On-chain):** El asset recién minteado (que inicialmente pertenece a una wallet del nodo) se transfiere a la wallet del usuario que lo creó.
5.  **Registro en BD:** Tras confirmar todas las transacciones on-chain, el asset se guarda en la base de datos local, asociándolo al usuario y su wallet.

### Compra de un Asset

La compra simula un "atomic swap" para garantizar la seguridad de ambas partes:
1.  **Verificación:** El sistema verifica que el comprador tiene fondos suficientes y que el vendedor posee el asset.
2.  **Pago en RTM:** El comprador envía el pago en RTM a la dirección del vendedor. El sistema espera la confirmación de esta transacción en la blockchain.
3.  **Transferencia del Asset:** Una vez confirmado el pago, el sistema utiliza la WIF del vendedor para firmar y enviar la transacción que transfiere el asset a la dirección del comprador.
4.  **Actualización de la BD:** Tras la confirmación de la transferencia del asset, la base de datos se actualiza para reflejar el nuevo propietario.

### Sistema de Ofertas

El flujo de aceptación de una oferta es muy similar al de una compra directa:
1.  Un usuario realiza una oferta sobre un asset a través de `POST /offers/makeOffer`.
2.  El propietario del asset ve la oferta y la acepta a través de `POST /offers/:offerId/accept`.
3.  El backend ejecuta el mismo flujo de "Pago en RTM -> Transferencia del Asset" que en la compra directa, pero usando los datos de la oferta (ofertante y precio).
4.  La base de datos se actualiza, marcando la oferta como `aceptada` y cambiando el propietario del asset. Todas las demás ofertas pendientes para ese asset se marcan como `rechazadas`.

### Sincronización con la Blockchain

Dado que un usuario puede recibir assets en su wallet por fuera de la plataforma, existen rutas para mantener la sincronización:
-   `/assets/missingAssets` consulta el balance de assets de la dirección del usuario en la blockchain (`listassetbalancesbyaddress`) y lo compara con los assets registrados en la base de datos para encontrar discrepancias.
-   `/assets/importMissingAssets` toma esta lista de assets faltantes, obtiene sus detalles (`getassetdetailsbyname`) y los crea en la base de datos, asociándolos al usuario correcto.
