export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
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

    // TODO: Implement actual NFT minting logic
    // Example: Create wallet, mint NFT on Polygon
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

    // 🆕 NEW: Trigger success email after NFT minting
    try {
      const emailResponse = await fetch(`${process.env.SUPABASE_URL}/functions/v1/send-nft-emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailType: 'claim_success',
          customerEmail: email,
          orderId: extractOrderIdFromToken(claimToken), // Helper function to get orderId
          walletAddress: walletData.walletAddress,
          claimToken: claimToken
        })
      });

      const emailResult = await emailResponse.json();
      console.log('Success email sent:', emailResult);
    } catch (emailError) {
      // Don't fail the main process if email fails
      console.error('Failed to send success email:', emailError);
    }

    res.status(200).json(walletData);
  } catch (error) {
    console.error('Claim process error:', error);
    res.status(500).json({ error: error.message || 'Failed to process claim' });
  }
}

// Helper function to extract order ID from claim token
function extractOrderIdFromToken(claimToken) {
  // Assuming format: "claim_ORDER_ID_timestamp_random"
  const parts = claimToken.split('_');
  return parts.length > 1 ? parts[1] : 'unknown_order';
}

    res.status(200).json(walletData);
  } catch (error) {
    console.error('Claim process error:', error);
    res.status(500).json({ error: error.message || 'Failed to process claim' });
  }
}