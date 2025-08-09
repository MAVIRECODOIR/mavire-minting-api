import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

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

    // 🆕 NEW: Query Supabase for the claim record
    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select(`
        *,
        orders (
          id,
          customer_email,
          product_id,
          status,
          created_at
        )
      `)
      .eq('claim_token', claimToken)
      .eq('customer_email', email)
      .eq('status', 'pending')
      .single();

    if (claimError || !claim) {
      console.error('Claim lookup error:', claimError);
      throw new Error('Invalid claim token or email. Please check your details.');
    }

    // Check if claim has expired
    const expiresAt = new Date(claim.expires_at);
    const now = new Date();
    if (now > expiresAt) {
      throw new Error('This claim token has expired. Please contact support.');
    }

    // Return order data in the format your frontend expects
    const orderData = {
      orderId: claim.orders.id,
      productName: claim.orders.product_id || 'Mavire Product', // You might want to join with products table
      customerName: email.split('@')[0], // Extract name from email or get from orders
      orderDate: claim.orders.created_at,
      price: 'N/A', // Add this field to your orders table if needed
      claimStatus: claim.status,
      expiresAt: claim.expires_at
    };

    res.status(200).json(orderData);
  } catch (error) {
    console.error('Verify claim error:', error);
    res.status(400).json({ error: error.message || 'Verification failed' });
  }
}