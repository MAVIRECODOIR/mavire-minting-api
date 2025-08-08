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
  // Replace with actual Vercel API token validation (e.g., check against env or secret manager)
  if (!token || token !== process.env.VERCEL_API_TOKEN) {
    return res.status(401).json({ error: 'Invalid API token' });
  }

  // Mock status response
  const status = {
    status: 'operational',
    version: '1.0.0',
    uptime: 86400, // seconds
    timestamp: new Date().toISOString(),
    services: {
      database: 'online',
      blockchain: 'online',
      imageGeneration: 'online',
      email: 'online'
    }
  };

  res.status(200).json(status);
}