import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

// Initialize Supabase client with correct environment variables
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed. Use POST.' 
    });
  }

  try {
    const { email, claimToken } = req.body;

    // Validate input
    if (!email || !claimToken) {
      return res.status(400).json({
        success: false,
        message: 'Email and claim token are required'
      });
    }

    console.log('🎯 Processing claim:', { email, claimToken: claimToken.substring(0, 10) + '...' });

    // Verify the claim exists and is still pending
    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('*')
      .eq('claim_token', claimToken)
      .eq('customer_email', email)
      .eq('claim_status', 'pending')
      .single();

    if (claimError || !claim) {
      console.error('❌ Claim verification failed:', claimError);
      return res.status(400).json({
        success: false,
        message: 'Invalid claim token or email'
      });
    }

    // Check if claim is expired
    if (claim.expires_at) {
      const expiryDate = new Date(claim.expires_at);
      const now = new Date();
      
      if (now > expiryDate) {
        console.log('❌ Claim expired');
        return res.status(400).json({
          success: false,
          message: 'Claim token has expired'
        });
      }
    }

    // Generate new wallet
    const wallet = ethers.Wallet.createRandom();
    const walletAddress = wallet.address;
    const privateKey = wallet.privateKey;
    const mnemonic = wallet.mnemonic?.phrase;

    console.log('💼 Generated wallet:', walletAddress);

    // Encrypt sensitive data (basic encryption - you might want stronger encryption)
    const encryptedPrivateKey = Buffer.from(privateKey).toString('base64');
    const encryptedMnemonic = mnemonic ? Buffer.from(mnemonic).toString('base64') : null;

    // Generate unique COA ID
    const coaUniqueId = `COA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Update claim with wallet details and mark as completed
    const { error: updateError } = await supabase
      .from('claims')
      .update({
        wallet_address: walletAddress,
        encrypted_private_key: encryptedPrivateKey,
        wallet_mnemonic_encrypted: encryptedMnemonic,
        coa_unique_id: coaUniqueId,
        claim_status: 'completed',
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', claim.id);

    if (updateError) {
      console.error('❌ Failed to update claim:', updateError);
      throw new Error('Failed to update claim record');
    }

    console.log('✅ Claim processed successfully');

    // Return wallet details to the frontend
    res.status(200).json({
      success: true,
      message: 'Claim processed successfully! Your wallet has been created.',
      walletDetails: {
        address: walletAddress,
        privateKey: privateKey,
        mnemonic: mnemonic,
        coaId: coaUniqueId
      },
      claimId: claim.id
    });

  } catch (error) {
    console.error('💥 Server error during claim processing:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during claim processing',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}