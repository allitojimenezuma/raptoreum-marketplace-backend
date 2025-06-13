import multer from 'multer';

// Configuración básica: guarda archivos en memoria
const storage = multer.memoryStorage();
const upload = multer({ storage });

export default upload;
