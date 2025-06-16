import { encrypt, decrypt } from './utils/encryption.js';
import { Provider } from 'rtnft-client';

const wif = decrypt('fdf8f7eaca2090fe7f1f470a460d5787f8fd049aaeb63d9c3cd7367e2091ffa8c84816a99106ee9e0f7309fb1cc66bfacb0741af8f62a26c8dac014e7f5e7489');
const provider = new Provider();

const fromAddress = 'RDchUFVPNTa9nFV4kRDuKRjHWHvFhDGmxp';

const transactions = [
    { toAddress: 'RBSuBcxbNRHJFuPCvgJB9scwpkaMSdxqxf', assetName: 'ASSETUNKNOWN2' },
    { toAddress: 'RP8fsdMwcsTreSV764MQYE1KnEtyBUA2bH', assetName: 'UNKNOWN_GRAVITY' },
    { toAddress: 'RKPNRheWMdopKgmFLBbBSZVPh1cp2TBMJ6', assetName: 'BITCOIN_LEGEND' },
    { toAddress: 'RNHtALPBhGqWP4hjuZqtEim2eb8phFtJy6', assetName: 'RAPTOREUM_SILVER' },
    { toAddress: 'RNHtALPBhGqWP4hjuZqtEim2eb8phFtJy6', assetName: 'PICASSO_BEER' },
    { toAddress: 'RKPNRheWMdopKgmFLBbBSZVPh1cp2TBMJ6', assetName: 'RUBIK_CUBE' },
    { toAddress: 'RNHtALPBhGqWP4hjuZqtEim2eb8phFtJy6', assetName: 'TUX' },
    { toAddress: 'RP8fsdMwcsTreSV764MQYE1KnEtyBUA2bH', assetName: 'CHECKKK' },
    { toAddress: 'RWaXRMdshWNpb247iXxAZdryw3fy9oU5Yy', assetName: 'RAPTOREUM_GOLD' },
    { toAddress: 'RBSuBcxbNRHJFuPCvgJB9scwpkaMSdxqxf', assetName: 'CHILI' },
    { toAddress: 'RWaXRMdshWNpb247iXxAZdryw3fy9oU5Yy', assetName: 'DES_2025' },
    { toAddress: 'RP8fsdMwcsTreSV764MQYE1KnEtyBUA2bH', assetName: 'WATERFALL' },
];

async function runTransactions() {
    for (const tx of transactions) {
        try {
            console.log(`Iniciando transacción para ${tx.assetName} a ${tx.toAddress}...`);
            const result = await provider.sendAssetTransaction(
                fromAddress,
                tx.toAddress,
                wif,
                tx.assetName
            );
            await provider.waitTransaction(result);
            console.log(`Resultado de la transacción para ${tx.assetName}:`, result);
        } catch (error) {
            console.error(`Error en la transacción para ${tx.assetName}:`, error);
        }
    }
}

runTransactions();


