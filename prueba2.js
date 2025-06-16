import { encrypt, decrypt } from './utils/encryption.js';
import { Provider } from 'rtnft-client';

const provider = new Provider();
await provider.waitTransaction("081160125a0b71e8902009057cbf67e73149c3852ebfc6d88cbbf34d1a1fce45");