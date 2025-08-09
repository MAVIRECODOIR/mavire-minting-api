import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  // CORS headers (matching your existing style)
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

  try {
    const { customerEmail, orderId, productId, paymentStatus } = req.body;

    // Verify payment is successful
    if (paymentStatus !== 'completed') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Generate claim token
    const claimToken = `claim_${orderId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Insert order and claim record
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        id: orderId,
        customer_email: customerEmail,
        product_id: productId,
        status: 'paid',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order insert error:', orderError);
      return res.status(500).json({ error: 'Failed to save order' });
    }

    // Create claim token record
    const { error: claimError } = await supabase
      .from('claims')
      .insert({
        order_id: orderId,
        claim_token: claimToken,
        customer_email: customerEmail,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      });

    if (claimError) {
      console.error('Claim insert error:', claimError);
      return res.status(500).json({ error: 'Failed to create claim' });
    }

    // Trigger Email #1: Claim invitation
    const emailResponse = await fetch(`${process.env.SUPABASE_URL}/functions/v1/send-nft-emails`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emailType: 'claim_invitation',
        customerEmail,
        orderId,
        claimToken
      })
    });

    const emailResult = await emailResponse.json();
    console.log('Email trigger result:', emailResult);

    return res.status(200).json({ 
      success: true, 
      message: 'Order processed and claim email sent',
      claimToken 
    });

  } catch (error) {
    console.error('Purchase webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}