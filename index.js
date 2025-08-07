// Temporary simple version - replace your index.js with this for testing
const express = require('express');
const cors = require('cors');

console.log('🚀 Starting Mavire API...');

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Root route - this should work
app.get('/', (req, res) => {
  console.log('✅ Root route hit');
  res.json({
    message: 'Mavire Codoir NFT Minting API',
    status: 'running',
    timestamp: new Date().toISOString(),
    version: '3.0.0'
  });
});

// Health check
app.get('/health', (req, res) => {
  console.log('✅ Health check hit');
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Simple API route
app.get('/api/status', (req, res) => {
  console.log('✅ API status hit');
  res.json({
    api: 'working',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Catch all - shows what routes are being requested
app.use('*', (req, res) => {
  console.log('❌ 404 for:', req.method, req.originalUrl);
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
    availableRoutes: ['/', '/health', '/api/status']
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('💥 Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

const port = process.env.PORT || 3000;

// For Vercel
module.exports = app;

// For local development
if (require.main === module) {
  app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
  });
}