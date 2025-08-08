<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mavire Codoir Admin Portal</title>
  <script src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/axios@1/dist/axios.min.js"></script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect } = React;

    const AdminPortal = () => {
      const [isAuthenticated, setIsAuthenticated] = useState(false);
      const [status, setStatus] = useState(null);
      const [error, setError] = useState('');
      const [loading, setLoading] = useState(false);

      const VERCEL_AUTH_URL = 'https://vercel.com/oauth/authorize?client_id=YOUR_VERCEL_CLIENT_ID&redirect_uri=https://mavire-minting-api.vercel.app/api/admin&scope=user';
      const API_BASE = 'https://mavire-minting-api.vercel.app';

      useEffect(() => {
        // Check for Vercel OAuth token in URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
          // Exchange code for token (simplified, requires backend endpoint)
          setIsAuthenticated(true);
          window.history.replaceState({}, document.title, '/api/admin');
          fetchStatus();
        }
      }, []);

      const fetchStatus = async () => {
        setLoading(true);
        try {
          const response = await axios.get(`${API_BASE}/api/admin/status`, {
            headers: { 'Content-Type': 'application/json' }
          });
          setStatus(response.data);
        } catch (err) {
          setError('Failed to fetch system status');
          console.error('Status fetch error:', err);
        } finally {
          setLoading(false);
        }
      };

      const handleLogin = () => {
        window.location.href = VERCEL_AUTH_URL;
      };

      const handleLogout = () => {
        setIsAuthenticated(false);
        setStatus(null);
      };

      if (!isAuthenticated) {
        return (
          <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
            <div className="bg-gray-800 bg-opacity-90 p-8 rounded-xl shadow-2xl max-w-md w-full text-center">
              <img
                src="https://res.cloudinary.com/dd3cjiork/image/upload/v1754541227/Manvire_Codoir_W_-_LOGO_gycswo.png"
                alt="Mavire Codoir Logo"
                className="h-16 mx-auto mb-6"
              />
              <h1 className="text-3xl font-serif text-gold-400 mb-4">Mavire Codoir Admin Portal</h1>
              <p className="text-gray-300 mb-6">Sign in with your Vercel account to access the admin dashboard.</p>
              <button
                onClick={handleLogin}
                className="bg-gold-400 text-gray-900 px-6 py-3 rounded-lg font-medium hover:bg-gold-500 transition-all duration-200"
              >
                Sign in with Vercel
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-gray-100 font-serif">
          <header className="bg-gray-800 bg-opacity-90 py-4 shadow-md">
            <div className="container mx-auto px-4 flex justify-between items-center">
              <div className="flex items-center">
                <img
                  src="https://res.cloudinary.com/dd3cjiork/image/upload/v1754541227/Manvire_Codoir_W_-_LOGO_gycswo.png"
                  alt="Mavire Codoir Logo"
                  className="h-12 mr-4"
                />
                <h1 className="text-2xl font-bold text-gold-400">Mavire Codoir Admin Portal</h1>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-all duration-200"
              >
                Logout
              </button>
            </div>
          </header>
          <main className="container mx-auto px-4 py-8">
            <div className="bg-gray-800 bg-opacity-90 p-8 rounded-xl shadow-2xl">
              <h2 className="text-2xl font-bold text-gold-400 mb-6">System Status</h2>
              {loading && (
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              )}
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
                  {error}
                </div>
              )}
              {status && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-700 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-gold-400 mb-4">System Overview</h3>
                    <p><strong>Status:</strong> {status.status}</p>
                    <p><strong>Version:</strong> {status.version}</p>
                    <p><strong>Uptime:</strong> {(status.uptime / 3600).toFixed(2)} hours</p>
                    <p><strong>Timestamp:</strong> {new Date(status.timestamp).toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-700 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-gold-400 mb-4">Services</h3>
                    <p><strong>Database:</strong> {status.services.database}</p>
                    <p><strong>Blockchain:</strong> {status.services.blockchain}</p>
                    <p><strong>Image Generation:</strong> {status.services.imageGeneration}</p>
                    <p><strong>Email:</strong> {status.services.email}</p>
                  </div>
                  <div className="bg-gray-700 p-6 rounded-lg col-span-1 md:col-span-2">
                    <h3 className="text-lg font-semibold text-gold-400 mb-4">Available Endpoints</h3>
                    <ul className="list-disc list-inside text-gray-300">
                      {[
                        'POST /webhook/shopify - Shopify order webhook',
                        'POST /api/claim/verify - Verify claim eligibility',
                        'POST /api/claim/process - Process NFT claim',
                        'GET /api/claim/status/:token - Get claim status',
                        'POST /api/generate-coa - Generate CoA URL',
                        'GET /api/test/coa - Test CoA generation',
                        'GET /api/test/coa-multiple - Test multiple CoA generation',
                        'GET /api/admin/status - System status'
                      ].map((endpoint, index) => (
                        <li key={index}>{endpoint}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </main>
          <footer className="bg-gray-800 bg-opacity-90 py-4 text-center text-gray-400 text-sm">
            <p>© 2025 Mavire Codoir. All rights reserved.</p>
            <p>Powered by Vercel and Polygon Network</p>
          </footer>
        </div>
      );
    };

    ReactDOM.render(<AdminPortal />, document.getElementById('root'));
  </script>
</body>
</html>