import express from 'express';
import dotenv from 'dotenv';
dotenv.config(); // Load environment variables
import authRouter from './routes/auth.js';
import mainRouter from './routes/main.js';
import userRouter from './routes/user.js';
import assetRouter from './routes/assets.js';
import cors from 'cors';

const app = express();

app.use(cors({
  origin: '*',   // o ['http://localhost:3001', 'http://otro.com']
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  credentials: true                   // si necesitas cookies o cabeceras Authorization
}));

app.use(express.json({ limit: '10mb' }));

// Montar el router bajo la ruta /auth
app.use('/auth', authRouter);
app.use('/user', userRouter);
app.use('/', mainRouter);
app.use('/assets', assetRouter);


app.listen(3000, () => {
  console.log('Servidor escuchando en puerto 3000');
});