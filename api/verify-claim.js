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

    // TODO: Implement Shopify order verification
    // Example: Query Shopify API or database for order by email/claimToken
    const orderData = {
      orderId: 'found-order-id',
      productName: 'Product name from Shopify',
      customerName: 'Customer name',
      orderDate: new Date().toISOString(),
      price: 'Order price',
    };

    res.status(200).json(orderData);
  } catch (error) {
    console.error('Verify claim error:', error);
    res.status(400).json({ error: error.message || 'Verification failed' });
  }
}
