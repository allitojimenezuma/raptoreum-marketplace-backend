import { Provider } from 'raptoreum.js';
import { decrypt } from './encryption.js';

export async function transferAsset({ fromAddress, toAddress, wif, assetName }) {
  try {
    const provider = new Provider(
      process.env.RPC_USER,
      process.env.RPC_PASSWORD,
      process.env.RPC_PORT,
      process.env.RPC_HOST
    );
    const txid = await provider.sendAssetTransaction(
      fromAddress,
      toAddress,
      wif,
      assetName
    );
    await provider.waitTransaction(txid, 1);
    return { success: true, txid };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
