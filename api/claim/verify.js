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

    console.log('🔍 Verifying claim:', { email, claimToken: claimToken.substring(0, 10) + '...' });

    // ✅ FIXED: Query with correct column names from your schema
    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select(`
        *,
        orders (
          shopify_order_id,
          customer_email,
          total_amount,
          status,
          created_at
        )
      `)
      .eq('claim_token', claimToken)
      .eq('customer_email', email)
      .eq('claim_status', 'pending')  // ✅ FIXED: Use claim_status not status
      .single();

    if (claimError || !claim) {
      console.error('❌ Claim lookup error:', claimError);
      throw new Error('Invalid claim token or email. Please check your details.');
    }

    // Check if claim has expired
    if (claim.expires_at) {
      const expiresAt = new Date(claim.expires_at);
      const now = new Date();
      if (now > expiresAt) {
        throw new Error('This claim token has expired. Please contact support.');
      }
    }

    console.log('✅ Claim verified successfully');

    // ✅ FIXED: Return format that ClaimPortal expects
    res.status(200).json({
      success: true,  // ClaimPortal checks for this
      message: 'Claim verified successfully',
      claimId: claim.id,
      orderId: claim.orders?.shopify_order_id || claim.id,
      productName: 'Mavire Luxury Item',
      customerName: email.split('@')[0],
      orderDate: claim.orders?.created_at || claim.created_at,
      orderDetails: {
        createdAt: claim.orders?.created_at || claim.created_at
      }
    });

  } catch (error) {
    console.error('💥 Verify claim error:', error);
    res.status(400).json({ 
      success: false,  // ClaimPortal checks for this
      error: error.message || 'Verification failed' 
    });
  }
}