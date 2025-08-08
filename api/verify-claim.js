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
    // TODO: Implement actual Shopify order verification
    // Check if claimToken exists and matches email in your database
    // Example: Query Shopify API or database for order details
    if (!email || !claimToken) {
      throw new Error('Missing email or claim token');
    }

    // Mock response for testing
    const orderData = {
      order: {
        orderNumber: '12345',
        productName: 'Mavire Product',
        customerName: 'Customer Name',
        createdAt: new Date().toISOString(),
      },
    };

    res.status(200).json(orderData);
  } catch (error) {
    console.error('Verify claim error:', error);
    res.status(400).json({ error: error.message || 'Verification failed' });
  }
}
