export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, claimToken } = req.body;

  try {
    if (!email || !claimToken) {
      throw new Error('Missing email or claim token');
    }

    const walletData = {
      walletAddress: 'generated-wallet-address',
      privateKey: 'generated-private-key',
      recoveryPhrase: 'generated-recovery-phrase',
      nftTokenId: 'minted-nft-id',
      nftContractAddress: 'your-contract-address',
      transactionHash: 'blockchain-tx-hash',
      blockchainNetwork: 'Polygon',
      explorerUrl: `https://polygonscan.com/tx/blockchain-tx-hash`,
    };

    res.status(200).json(walletData);
  } catch (error) {
    console.error('Claim process error:', error);
    res.status(500).json({ error: error.message || 'Failed to process claim' });
  }
}
{
{
  "wallet": {
    "address": "0x...",
    "privateKey": "0x...",
    "mnemonic": "word1 word2..."
  },
  "nft": {
    "tokenId": "42",
    "transactionHash": "0x...",
    "contractAddress": "0x..."
  }
}
