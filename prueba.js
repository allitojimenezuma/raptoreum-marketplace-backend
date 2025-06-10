
import { encrypt, decrypt } from './utils/encryption.js';

const wif = decrypt('fdf8f7eaca2090fe7f1f470a460d5787f8fd049aaeb63d9c3cd7367e2091ffa8c84816a99106ee9e0f7309fb1cc66bfacb0741af8f62a26c8dac014e7f5e7489');
console.log('WIF Desencriptado:', wif);