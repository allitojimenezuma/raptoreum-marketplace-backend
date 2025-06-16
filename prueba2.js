import { encrypt, decrypt } from './utils/encryption.js';
import { Provider } from 'rtnft-client';

const provider = new Provider();
const result = await provider.getassetdetailsbyname("GITHUB_COPILOT");

console.log(result);