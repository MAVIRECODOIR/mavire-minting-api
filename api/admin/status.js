export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify API token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  if (!token || token !== process.env.VERCEL_API_TOKEN) {
    return res.status(401).json({ error: 'Invalid API token' });
  }

  // System status (matches index.js)
  const status = {
    message: 'Mavire Codoir Complete NFT Minting System',
    version: '3.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: 'online',
      blockchain: 'online',
      imageGeneration: 'online',
      email: 'online'
    },
    endpoints: [
      'POST /webhook/shopify - Shopify order webhook',
      'POST /api/claim/verify - Verify claim eligibility',
      'POST /api/claim/process - Process NFT claim',
      'GET /api/claim/status/:token - Get claim status',
      'POST /api/generate-coa - Generate CoA URL',
      'GET /api/test/coa - Test CoA generation',
      'GET /api/admin/status - System status'
    ]
  };

  res.status(200).json(status);
}