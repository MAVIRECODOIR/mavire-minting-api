const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { ThirdwebSDK } = require('@thirdweb-dev/sdk');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const crypto = require('crypto');

const CloudinaryCoAGenerator = require('./cloudinaryCoAGenerator');
const DatabaseService = require('./databaseService');
const WalletService = require('./walletService');
const MicrosoftGraphEmailService = require('./emailService');

console.log('🚀 Starting Mavire Codoir NFT Minting System...');

// Validate essential environment variables
const requiredEnvVars = [
  'THIRDWEB_CLIENT_ID',
  'THIRDWEB_SECRET_KEY', 
  'THIRDWEB_PRIVATE_KEY',
  'THIRDWEB_CONTRACT_ADDRESS'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.warn(`⚠️ Missing environment variables: ${missingVars.join(', ')}`);
  console.warn('Some features may not work properly.');
}

const app = express();

// Initialize services
const coaGenerator = new CloudinaryCoAGenerator();
const db = new DatabaseService();
const walletService = new WalletService();
const emailService = new MicrosoftGraphEmailService();

// Session store for admin authentication
const adminSessions = new Map();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow Cloudinary images
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Admin login rate limiting (more restrictive)
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 login attempts per 15 minutes
  message: { error: 'Too many login attempts, please try again later.' }
});

// Webhook rate limiting (more restrictive)
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Webhook rate limit exceeded' }
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Middleware to verify admin session
function requireAdminAuth(req, res, next) {
  const sessionId = req.headers.authorization?.replace('Bearer ', '');
  
  if (!sessionId || !adminSessions.has(sessionId)) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Valid admin session required'
    });
  }
  
  const session = adminSessions.get(sessionId);
  if (session.expiresAt < Date.now()) {
    adminSessions.delete(sessionId);
    return res.status(401).json({ 
      error: 'Session expired',
      message: 'Please login again'
    });
  }
  
  next();
}

// Admin login endpoint
app.post('/api/admin/login', adminLoginLimiter, async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Access token required' });
    }
    
    // Verify against Vercel token (set in environment variables)
    const expectedToken = process.env.ADMIN_ACCESS_TOKEN || 'mavire-admin-2024';
    
    if (token !== expectedToken) {
      console.warn('🚨 Invalid admin login attempt:', req.ip);
      return res.status(401).json({ 
        error: 'Invalid access token',
        message: 'Access denied'
      });
    }
    
    // Generate session ID
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    
    adminSessions.set(sessionId, {
      createdAt: Date.now(),
      expiresAt,
      ip: req.ip
    });
    
    console.log('✅ Admin login successful:', req.ip);
    
    res.json({
      success: true,
      sessionId,
      expiresAt: new Date(expiresAt).toISOString(),
      message: 'Authentication successful'
    });
    
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Admin logout endpoint
app.post('/api/admin/logout', (req, res) => {
  const sessionId = req.headers.authorization?.replace('Bearer ', '');
  
  if (sessionId && adminSessions.has(sessionId)) {
    adminSessions.delete(sessionId);
  }
  
  res.json({ success: true, message: 'Logged out successfully' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Admin login page (serves the HTML interface)
app.get('/admin', (req, res) => {
  const loginHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Mavire Codoir - Admin Access</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #333;
        }
        
        .login-container {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 3rem;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          max-width: 400px;
          width: 100%;
          text-align: center;
        }
        
        .brand-logo {
          font-size: 2.5rem;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 1rem;
        }
        
        .subtitle {
          color: #666;
          margin-bottom: 2rem;
          font-size: 0.9rem;
        }
        
        .form-group {
          margin-bottom: 1.5rem;
          text-align: left;
        }
        
        label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: #555;
        }
        
        input[type="password"] {
          width: 100%;
          padding: 1rem;
          border: 2px solid #e1e5e9;
          border-radius: 10px;
          font-size: 1rem;
          transition: all 0.3s ease;
          background: rgba(255, 255, 255, 0.8);
        }
        
        input[type="password"]:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .login-btn {
          width: 100%;
          padding: 1rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-bottom: 1rem;
        }
        
        .login-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }
        
        .login-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        
        .error-message {
          background: #fee;
          color: #c33;
          padding: 0.75rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          font-size: 0.9rem;
        }
        
        .success-message {
          background: #efe;
          color: #363;
          padding: 0.75rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          font-size: 0.9rem;
        }
        
        .security-notice {
          font-size: 0.8rem;
          color: #888;
          margin-top: 1rem;
          text-align: center;
        }
        
        .dashboard {
          display: none;
          padding: 2rem 0;
        }
        
        .dashboard-header {
          margin-bottom: 2rem;
        }
        
        .dashboard-nav {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }
        
        .nav-button {
          padding: 1rem;
          background: white;
          border: 2px solid #e1e5e9;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          color: #333;
          text-align: center;
          font-weight: 500;
        }
        
        .nav-button:hover {
          border-color: #667eea;
          background: #f8f9ff;
        }
        
        .logout-btn {
          background: #ff6b6b;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 5px;
          cursor: pointer;
          float: right;
        }
        
        .content-area {
          background: white;
          border-radius: 10px;
          padding: 1.5rem;
          min-height: 400px;
          border: 1px solid #e1e5e9;
        }
        
        @media (max-width: 480px) {
          .login-container {
            margin: 1rem;
            padding: 2rem;
          }
        }
      </style>
    </head>
    <body>
      <div class="login-container">
        <div id="loginForm">
          <div class="brand-logo">Mavire Codoir</div>
          <div class="subtitle">Admin Dashboard Access</div>
          
          <div id="messageArea"></div>
          
          <form id="authForm">
            <div class="form-group">
              <label for="accessToken">Access Token</label>
              <input type="password" id="accessToken" placeholder="Enter your admin token" required>
            </div>
            
            <button type="submit" class="login-btn" id="loginBtn">
              Access Dashboard
            </button>
          </form>
          
          <div class="security-notice">
            🔒 Secure access required • Luxury sustainable fashion NFTs
          </div>
        </div>
        
        <div id="adminDashboard" class="dashboard">
          <div class="dashboard-header">
            <h2>Admin Dashboard</h2>
            <button class="logout-btn" onclick="logout()">Logout</button>
          </div>
          
          <div class="dashboard-nav">
            <button class="nav-button" onclick="loadSection('status')">System Status</button>
            <button class="nav-button" onclick="loadSection('environment')">Environment Check</button>
            <button class="nav-button" onclick="loadSection('email')">Test Email</button>
            <button class="nav-button" onclick="loadSection('coa')">Test CoA Generator</button>
            <button class="nav-button" onclick="loadSection('tokens')">Graph Token Test</button>
          </div>
          
          <div class="content-area" id="contentArea">
            <p>Welcome to the Mavire Codoir Admin Dashboard. Select a section above to get started.</p>
          </div>
        </div>
      </div>
      
      <script>
        // ${Buffer.from(`
        let currentSession = null;
        
        document.getElementById('authForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const loginBtn = document.getElementById('loginBtn');
          const messageArea = document.getElementById('messageArea');
          const token = document.getElementById('accessToken').value;
          
          if (!token) {
            showMessage('Please enter your access token', 'error');
            return;
          }
          
          loginBtn.disabled = true;
          loginBtn.textContent = 'Authenticating...';
          
          try {
            const response = await fetch('/api/admin/login', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ token })
            });
            
            const data = await response.json();
            
            if (data.success) {
              currentSession = data.sessionId;
              showMessage('Authentication successful! Loading dashboard...', 'success');
              
              setTimeout(() => {
                document.getElementById('loginForm').style.display = 'none';
                document.getElementById('adminDashboard').style.display = 'block';
                loadSection('status');
              }, 1000);
            } else {
              showMessage(data.message || 'Authentication failed', 'error');
            }
          } catch (error) {
            showMessage('Connection error. Please try again.', 'error');
          } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Access Dashboard';
          }
        });
        
        function showMessage(message, type) {
          const messageArea = document.getElementById('messageArea');
          messageArea.innerHTML = \`<div class="\${type}-message">\${message}</div>\`;
        }
        
        async function apiCall(endpoint) {
          try {
            const response = await fetch(endpoint, {
              headers: {
                'Authorization': \`Bearer \${currentSession}\`
              }
            });
            return await response.json();
          } catch (error) {
            return { error: 'Failed to connect to API' };
          }
        }
        
        async function apiPost(endpoint, data = {}) {
          try {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': \`Bearer \${currentSession}\`
              },
              body: JSON.stringify(data)
            });
            return await response.json();
          } catch (error) {
            return { error: 'Failed to connect to API' };
          }
        }
        
        async function loadSection(section) {
          const contentArea = document.getElementById('contentArea');
          contentArea.innerHTML = '<div style="text-align: center; padding: 2rem;">Loading...</div>';
          
          switch (section) {
            case 'status':
              const status = await apiCall('/api/admin/status');
              contentArea.innerHTML = \`
                <h3>System Status</h3>
                <pre style="background: #f5f5f5; padding: 1rem; border-radius: 5px; overflow-x: auto;">\${JSON.stringify(status, null, 2)}</pre>
              \`;
              break;
              
            case 'environment':
              const env = await apiCall('/api/debug/environment');
              contentArea.innerHTML = \`
                <h3>Environment Check</h3>
                <pre style="background: #f5f5f5; padding: 1rem; border-radius: 5px; overflow-x: auto;">\${JSON.stringify(env, null, 2)}</pre>
              \`;
              break;
              
            case 'email':
              contentArea.innerHTML = \`
                <h3>Email Service Test</h3>
                <div style="margin-bottom: 1rem;">
                  <input type="email" id="testEmail" placeholder="test@example.com" style="padding: 0.5rem; margin-right: 1rem; border: 1px solid #ddd; border-radius: 5px;">
                  <select id="emailType" style="padding: 0.5rem; margin-right: 1rem; border: 1px solid #ddd; border-radius: 5px;">
                    <option value="claim">Claim Email</option>
                    <option value="welcome">Welcome Email</option>
                  </select>
                  <button onclick="testEmail()" style="padding: 0.5rem 1rem; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">Send Test Email</button>
                </div>
                <div id="emailResult"></div>
              \`;
              break;
              
            case 'coa':
              const coa = await apiCall('/api/test/coa');
              const coaMultiple = await apiCall('/api/test/coa-multiple');
              contentArea.innerHTML = \`
                <h3>Certificate of Authenticity Tests</h3>
                <h4>Single CoA Test:</h4>
                <pre style="background: #f5f5f5; padding: 1rem; border-radius: 5px; overflow-x: auto;">\${JSON.stringify(coa, null, 2)}</pre>
                <h4>Multiple CoA Test:</h4>
                <pre style="background: #f5f5f5; padding: 1rem; border-radius: 5px; overflow-x: auto;">\${JSON.stringify(coaMultiple, null, 2)}</pre>
              \`;
              break;
              
            case 'tokens':
              const tokens = await apiCall('/api/debug/graph-token');
              contentArea.innerHTML = \`
                <h3>Microsoft Graph Token Test</h3>
                <pre style="background: #f5f5f5; padding: 1rem; border-radius: 5px; overflow-x: auto;">\${JSON.stringify(tokens, null, 2)}</pre>
              \`;
              break;
              
            default:
              contentArea.innerHTML = '<p>Section not found.</p>';
          }
        }
        
        async function testEmail() {
          const email = document.getElementById('testEmail').value;
          const type = document.getElementById('emailType').value;
          const resultDiv = document.getElementById('emailResult');
          
          resultDiv.innerHTML = 'Sending test email...';
          
          const result = await apiPost('/api/test-email', { email, type });
          resultDiv.innerHTML = \`<pre style="background: #f5f5f5; padding: 1rem; border-radius: 5px; overflow-x: auto;">\${JSON.stringify(result, null, 2)}</pre>\`;
        }
        
        async function logout() {
          if (currentSession) {
            await fetch('/api/admin/logout', {
              method: 'POST',
              headers: {
                'Authorization': \`Bearer \${currentSession}\`
              }
            });
          }
          
          currentSession = null;
          document.getElementById('loginForm').style.display = 'block';
          document.getElementById('adminDashboard').style.display = 'none';
          document.getElementById('accessToken').value = '';
          document.getElementById('messageArea').innerHTML = '';
        }
        `).toString('base64')}
        eval(atob(document.currentScript.textContent.split('base64')[1].split("'")[1]));
      </script>
    </body>
    </html>
  `;
  
  res.send(loginHtml);
});

// Test email endpoint - add this to your index.js (PROTECTED)
app.post('/api/test-email', requireAdminAuth, async (req, res) => {
  try {
    console.log('🧪 Testing email service...');
    
    const { email, type } = req.body;
    const testEmail = email || 'test@example.com';
    const emailType = type || 'claim';
    
    // Test Microsoft Graph connection first
    const connectionTest = await emailService.testConnection();
    console.log('📧 Email service connection test:', connectionTest);
    
    if (!connectionTest.success) {
      return res.status(500).json({
        success: false,
        error: 'Email service connection failed',
        details: connectionTest.error,
        troubleshooting: {
          checkEnvVars: [
            'MICROSOFT_CLIENT_ID',
            'MICROSOFT_CLIENT_SECRET', 
            'MICROSOFT_TENANT_ID',
            'FROM_EMAIL'
          ],
          commonIssues: [
            'Admin consent not granted for Mail.Send permission',
            'Using Delegated permissions instead of Application permissions',
            'Invalid client credentials',
            'Shared mailbox not accessible'
          ]
        }
      });
    }
    
    // Mock data for different email types
    const mockOrderData = {
      shopify_order_number: 'TEST-001',
      product_name: 'Test NFT Product',
      product_sku: 'TEST-SKU-001',
      customer_first_name: testEmail.split('@')[0],
      customer_last_name: 'Tester'
    };
    
    const mockWalletData = {
      address: '0x742E8C0b13C2a2b4A5B1234567890123456789AB',
      privateKey: '0x1234567890abcdef...' // Mock for testing
    };
    
    const mockNftData = {
      tokenId: '123',
      transactionHash: '0xabcdef1234567890...' // Mock for testing
    };
    
    const testToken = 'test-token-' + Date.now();
    
    let emailResult;
    
    // Send different types of emails based on request
    switch (emailType) {
      case 'welcome':
        emailResult = await emailService.sendWelcomeEmail(
          testEmail, 
          mockWalletData,
          mockNftData,
          mockOrderData
        );
        break;
      case 'claim':
      default:
        emailResult = await emailService.sendClaimEmail(
          testEmail, 
          testToken, 
          mockOrderData
        );
        break;
    }
    
    console.log('✅ Test email sent successfully:', emailResult);
    
    res.json({
      success: true,
      message: `Test ${emailType} email sent successfully to ${testEmail}`,
      emailResult,
      connectionTest,
      testData: {
        recipient: testEmail,
        emailType: emailType,
        claimToken: emailType === 'claim' ? testToken : undefined,
        fromEmail: process.env.FROM_EMAIL,
        orderData: mockOrderData
      },
      instructions: [
        'Check your inbox and spam folder',
        'Email should arrive from customerservice@mavirecodoir.com',
        `Look for subject containing "NFT Certificate" or "Authenticity"`
      ]
    });
    
  } catch (error) {
    console.error('💥 Email test failed:', error);
    
    // Provide detailed error analysis
    let errorAnalysis = 'Unknown error';
    let troubleshooting = [];
    
    if (error.message.includes('insufficient_scope')) {
      errorAnalysis = 'Insufficient permissions - Mail.Send permission not granted';
      troubleshooting = [
        'Go to Azure Entra admin center',
        'Navigate to your app registration > API permissions',
        'Ensure Mail.Send has Application permissions (not Delegated)',
        'Click "Grant admin consent" button'
      ];
    } else if (error.message.includes('invalid_client')) {
      errorAnalysis = 'Invalid client credentials';
      troubleshooting = [
        'Check MICROSOFT_CLIENT_ID in environment variables',
        'Verify MICROSOFT_CLIENT_SECRET is correct',
        'Generate a new client secret if needed',
        'Ensure no extra spaces in environment variables'
      ];
    } else if (error.message.includes('Forbidden')) {
      errorAnalysis = 'Access forbidden to shared mailbox';
      troubleshooting = [
        'Verify customerservice@mavirecodoir.com exists and is active',
        'Check if admin consent was properly granted',
        'Ensure the app has permission to send from shared mailboxes'
      ];
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('network')) {
      errorAnalysis = 'Network connectivity issue';
      troubleshooting = [
        'Check internet connection',
        'Verify Microsoft Graph endpoints are accessible',
        'Check if corporate firewall is blocking requests'
      ];
    }
    
    res.status(500).json({
      success: false,
      error: 'Email test failed',
      message: error.message,
      errorAnalysis,
      troubleshooting,
      environmentCheck: {
        clientId: !!process.env.MICROSOFT_CLIENT_ID,
        clientSecret: !!process.env.MICROSOFT_CLIENT_SECRET,
        tenantId: !!process.env.MICROSOFT_TENANT_ID,
        fromEmail: !!process.env.FROM_EMAIL,
        claimPortalUrl: !!process.env.CLAIM_PORTAL_URL
      },
      nextSteps: [
        'Check Vercel deployment logs for detailed errors',
        'Verify all environment variables are set in Vercel dashboard',
        'Test Microsoft Graph connection manually using Postman or similar tool',
        'Contact Microsoft 365 admin to verify shared mailbox configuration'
      ]
    });
  }
});

// Detailed environment check endpoint (PROTECTED)
app.get('/api/debug/environment', requireAdminAuth, (req, res) => {
  const envCheck = {
    requiredVars: {
      // Email service
      MICROSOFT_CLIENT_ID: {
        present: !!process.env.MICROSOFT_CLIENT_ID,
        length: process.env.MICROSOFT_CLIENT_ID?.length || 0,
        format: process.env.MICROSOFT_CLIENT_ID ? 'UUID format' : 'Missing'
      },
      MICROSOFT_CLIENT_SECRET: {
        present: !!process.env.MICROSOFT_CLIENT_SECRET,
        length: process.env.MICROSOFT_CLIENT_SECRET?.length || 0,
        format: 'Hidden for security'
      },
      MICROSOFT_TENANT_ID: {
        present: !!process.env.MICROSOFT_TENANT_ID,
        length: process.env.MICROSOFT_TENANT_ID?.length || 0,
        format: process.env.MICROSOFT_TENANT_ID ? 'UUID format' : 'Missing'
      },
      FROM_EMAIL: {
        present: !!process.env.FROM_EMAIL,
        value: process.env.FROM_EMAIL || 'Missing',
        isValid: process.env.FROM_EMAIL?.includes('@') || false
      },
      
      // Other critical vars
      THIRDWEB_CLIENT_ID: {
        present: !!process.env.THIRDWEB_CLIENT_ID,
        length: process.env.THIRDWEB_CLIENT_ID?.length || 0
      },
      THIRDWEB_SECRET_KEY: {
        present: !!process.env.THIRDWEB_SECRET_KEY,
        length: process.env.THIRDWEB_SECRET_KEY?.length || 0
      },
      THIRDWEB_PRIVATE_KEY: {
        present: !!process.env.THIRDWEB_PRIVATE_KEY,
        length: process.env.THIRDWEB_PRIVATE_KEY?.length || 0
      },
      SUPABASE_URL: {
        present: !!process.env.SUPABASE_URL,
        value: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.substring(0, 30) + '...' : 'Missing'
      }
    },
    
    emailServiceStatus: 'unknown',
    recommendations: []
  };
  
  // Generate recommendations
  if (!envCheck.requiredVars.MICROSOFT_CLIENT_ID.present) {
    envCheck.recommendations.push('Set MICROSOFT_CLIENT_ID from Azure app registration');
  }
  
  if (!envCheck.requiredVars.MICROSOFT_CLIENT_SECRET.present) {
    envCheck.recommendations.push('Set MICROSOFT_CLIENT_SECRET from Azure app registration');
  }
  
  if (!envCheck.requiredVars.MICROSOFT_TENANT_ID.present) {
    envCheck.recommendations.push('Set MICROSOFT_TENANT_ID from Azure app registration');
  }
  
  if (!envCheck.requiredVars.FROM_EMAIL.isValid) {
    envCheck.recommendations.push('Set valid FROM_EMAIL address (customerservice@mavirecodoir.com)');
  }
  
  const allEmailVarsPresent = envCheck.requiredVars.MICROSOFT_CLIENT_ID.present && 
                              envCheck.requiredVars.MICROSOFT_CLIENT_SECRET.present && 
                              envCheck.requiredVars.MICROSOFT_TENANT_ID.present && 
                              envCheck.requiredVars.FROM_EMAIL.present;
                              
  envCheck.emailServiceStatus = allEmailVarsPresent ? 'Ready to test' : 'Missing configuration';
  
  if (envCheck.recommendations.length === 0) {
    envCheck.recommendations.push('All environment variables look good! Try testing email service.');
  }
  
  res.json({
    status: 'Environment check completed',
    timestamp: new Date().toISOString(),
    ...envCheck
  });
});

// Microsoft Graph token test endpoint (PROTECTED)
app.get('/api/debug/graph-token', requireAdminAuth, async (req, res) => {
  try {
    console.log('🔑 Testing Microsoft Graph token acquisition...');
    
    const tokenTest = await emailService.getAccessToken();
    
    res.json({
      success: true,
      message: 'Successfully obtained Microsoft Graph access token',
      tokenInfo: {
        obtained: true,
        length: tokenTest?.length || 0,
        expirySet: !!emailService.tokenExpiry,
        fromEmail: process.env.FROM_EMAIL
      },
      nextStep: 'Token acquired successfully. You can now test sending emails.'
    });
    
  } catch (error) {
    console.error('❌ Token acquisition failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to obtain Microsoft Graph access token',
      details: error.message,
      troubleshooting: {
        checkCredentials: [
          'Verify MICROSOFT_CLIENT_ID is correct',
          'Verify MICROSOFT_CLIENT_SECRET is correct',
          'Verify MICROSOFT_TENANT_ID is correct'
        ],
        azureConfiguration: [
          'Ensure app registration exists in Azure Entra',
          'Check that client secret hasn\'t expired',
          'Verify tenant ID matches your organization'
        ]
      }
    });
  }
});

// Shopify Webhook Handler
app.post('/webhook/shopify', webhookLimiter, async (req, res) => {
  try {
    console.log('📦 Received Shopify webhook:', req.headers['x-shopify-topic']);
    
    const order = req.body;
    
    // Basic validation
    if (!order.id || !order.customer?.email) {
      return res.status(400).json({ error: 'Invalid order data' });
    }

    // Store order in database (if database is configured)
    let storedOrder;
    try {
      storedOrder = await db.storeOrder(order);
      console.log('✅ Order stored:', storedOrder.shopify_order_id);
    } catch (dbError) {
      console.error('⚠️ Database storage failed:', dbError.message);
      // Continue processing even if DB fails
      storedOrder = {
        shopify_order_id: order.id.toString(),
        shopify_order_number: order.order_number?.toString() || 'Unknown',
        customer_email: order.customer.email,
        product_name: order.line_items[0]?.name || 'Unknown Product',
        product_sku: order.line_items[0]?.sku || 'NO-SKU',
        is_nft_eligible: order.line_items.some(item => 
          item.product_type === 'NFT Eligible' || 
          (item.tags && item.tags.includes('nft-eligible'))
        )
      };
    }

    // If order is NFT eligible, create a claim token and send email
    if (storedOrder.is_nft_eligible) {
      const claimToken = uuidv4();
      
      try {
        const claim = await db.createClaim(
          storedOrder.shopify_order_id,
          storedOrder.customer_email,
          claimToken
        );
        console.log('🎫 Claim created:', claim.claim_token);
      } catch (claimError) {
        console.error('⚠️ Claim creation failed:', claimError.message);
      }
      
      // Send email to customer with claim link
      try {
        await emailService.sendClaimEmail(storedOrder.customer_email, claimToken, storedOrder);
        console.log('📧 Claim email sent to:', storedOrder.customer_email);
      } catch (emailError) {
        console.error('⚠️ Failed to send claim email:', emailError.message);
        // Continue processing - don't fail the webhook
      }
    }

    res.status(200).json({ 
      received: true,
      orderId: storedOrder.shopify_order_id,
      nftEligible: storedOrder.is_nft_eligible,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Webhook error:', error);
    res.status(500).json({ 
      error: 'Webhook processing failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Verify claim eligibility
app.post('/api/claim/verify', async (req, res) => {
  try {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      claimToken: Joi.string().uuid().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, claimToken } = value;

    if (claimToken) {
      // Verify specific claim token
      try {
        const claim = await db.verifyClaim(email, claimToken);
        if (!claim) {
          return res.status(404).json({ 
            error: 'Invalid claim or claim has expired',
            eligible: false
          });
        }

        res.json({
          eligible: true,
          claim: {
            id: claim.id,
            token: claim.claim_token,
            productName: claim.orders?.product_name || 'Unknown Product',
            productSku: claim.orders?.product_sku || 'NO-SKU',
            orderNumber: claim.orders?.shopify_order_number || 'Unknown',
            expiresAt: claim.expires_at
          }
        });
      } catch (dbError) {
        console.error('Database verification error:', dbError);
        return res.status(500).json({ error: 'Verification service temporarily unavailable' });
      }
    } else {
      // Check if email has any eligible orders
      try {
        const orders = await db.getOrderByEmail(email);
        const eligibleOrders = [];

        for (const order of orders) {
          const isClaimed = await db.isOrderClaimed(order.shopify_order_id);
          if (!isClaimed) {
            eligibleOrders.push({
              orderId: order.shopify_order_id,
              orderNumber: order.shopify_order_number,
              productName: order.product_name,
              productSku: order.product_sku,
              createdAt: order.created_at
            });
          }
        }

        res.json({
          eligible: eligibleOrders.length > 0,
          eligibleOrders
        });
      } catch (dbError) {
        console.error('Database query error:', dbError);
        return res.status(500).json({ error: 'Service temporarily unavailable' });
      }
    }

  } catch (error) {
    console.error('Claim verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Process NFT claim
app.post('/api/claim/process', async (req, res) => {
  try {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      claimToken: Joi.string().uuid().required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, claimToken } = value;

    // Verify claim
    const claim = await db.verifyClaim(email, claimToken);
    if (!claim) {
      return res.status(404).json({ error: 'Invalid or expired claim' });
    }

    console.log('🎨 Processing claim for:', email);

    // Generate wallet
    const walletData = walletService.generateWallet();
    console.log('💳 Generated wallet:', walletData.address);

    // Generate CoA URL using Cloudinary
    const coaResult = coaGenerator.generateCertificateUrl({
      customerName: email.split('@')[0], // Use email prefix as customer name
      productName: claim.orders?.product_name || 'Unknown Product',
      authenticityId: `AUTH-${Date.now()}`,
      serialNumber: claim.orders?.product_sku || 'NO-SKU',
      purchaseDate: new Date(claim.created_at)
    });

    console.log('🎨 Generated CoA URL:', coaResult);

    // Initialize ThirdWeb and mint NFT
    const sdk = ThirdwebSDK.fromPrivateKey(
      process.env.THIRDWEB_PRIVATE_KEY,
      process.env.THIRDWEB_CHAIN || "polygon",
      { 
        clientId: process.env.THIRDWEB_CLIENT_ID,
        secretKey: process.env.THIRDWEB_SECRET_KEY
      }
    );

    const contract = await sdk.getContract(process.env.THIRDWEB_CONTRACT_ADDRESS);

    const nftMetadata = {
      name: `${claim.orders?.product_name || 'Unknown Product'} - Certificate of Authenticity`,
      description: `Official Certificate of Authenticity for ${claim.orders?.product_name || 'Unknown Product'} by Mavire Codoir`,
      image: coaResult, // Use Cloudinary URL
      attributes: [
        {
          trait_type: "Product Name",
          value: claim.orders?.product_name || 'Unknown Product'
        },
        {
          trait_type: "SKU", 
          value: claim.orders?.product_sku || 'NO-SKU'
        },
        {
          trait_type: "Authenticity ID",
          value: `AUTH-${Date.now()}`
        },
        {
          trait_type: "Authorization Date",
          value: new Date().toLocaleDateString('en-US')
        },
        {
          trait_type: "Order Number",
          value: claim.orders?.shopify_order_number || 'Unknown'
        },
        {
          trait_type: "Brand",
          value: "Mavire Codoir"
        }
      ],
      properties: {
        authenticity_id: `AUTH-${Date.now()}`,
        generated_at: new Date().toISOString(),
        brand: "Mavire Codoir",
        type: "Certificate of Authenticity",
        claim_token: claimToken,
        image_service: "Cloudinary"
      }
    };

    console.log('🪙 Minting NFT to:', walletData.address);
    const mintResult = await contract.erc721.mintTo(walletData.address, nftMetadata);
    console.log('✅ NFT minted:', mintResult.id.toString());

    // Update claim with results
    const updatedClaim = await db.updateClaimWithNFT(
      claim.id,
      walletData,
      {
        tokenId: mintResult.id.toString(),
        transactionHash: mintResult.receipt.transactionHash,
        coaUniqueId: `AUTH-${Date.now()}`,
        metadata: nftMetadata
      }
    );

    // Format response
    const walletDisplay = walletService.formatWalletForDisplay(walletData);

    res.json({
      success: true,
      claim: {
        status: 'completed',
        claimedAt: updatedClaim.claimed_at,
        nft: {
          tokenId: mintResult.id.toString(),
          transactionHash: mintResult.receipt.transactionHash,
          contractAddress: process.env.THIRDWEB_CONTRACT_ADDRESS,
          network: process.env.THIRDWEB_CHAIN || "polygon"
        },
        wallet: {
          ...walletDisplay,
          privateKey: walletData.privateKey // Include for customer
        },
        coa: {
          uniqueId: `AUTH-${Date.now()}`,
          authDate: new Date().toLocaleDateString('en-US'),
          filename: 'certificate.jpg',
          imageUrl: coaResult
        }
      }
    });

    // Send success email (async, don't wait)
    emailService.sendWelcomeEmail(email, walletData, {
      tokenId: mintResult.id.toString(),
      transactionHash: mintResult.receipt.transactionHash
    }, claim.orders).catch(err => {
      console.error('Failed to send welcome email:', err);
    });

  } catch (error) {
    console.error('💥 Claim processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process claim',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get claim status
app.get('/api/claim/status/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({ error: 'Claim token required' });
    }

    const claim = await db.getClaimStatus(token);
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    const response = {
      status: claim.claim_status,
      product: {
        name: claim.orders?.product_name || 'Unknown Product',
        sku: claim.orders?.product_sku || 'NO-SKU'
      },
      createdAt: claim.created_at,
      expiresAt: claim.expires_at
    };

    if (claim.claim_status === 'completed') {
      response.nft = {
        tokenId: claim.nft_token_id,
        transactionHash: claim.nft_transaction_hash,
        walletAddress: claim.wallet_address
      };
      response.claimedAt = claim.claimed_at;
    }

    res.json(response);

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to get claim status' });
  }
});

// Generate CoA URL (for testing)
app.post('/api/generate-coa', async (req, res) => {
  try {
    const schema = Joi.object({
      customerName: Joi.string().required(),
      productName: Joi.string().required(),
      authenticityId: Joi.string().optional(),
      serialNumber: Joi.string().optional(),
      purchaseDate: Joi.date().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const coaResult = coaGenerator.generateCertificateUrl({
      customerName: value.customerName,
      productName: value.productName,
      authenticityId: value.authenticityId || `AUTH-${Date.now()}`,
      serialNumber: value.serialNumber || 'MV-001',
      purchaseDate: value.purchaseDate || new Date()
    });

    res.json({
      success: true,
      certificateUrl: coaResult,
      message: 'Certificate URL generated successfully'
    });

  } catch (error) {
    console.error('CoA generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate Certificate of Authenticity',
      details: error.message 
    });
  }
});

// Test Cloudinary endpoint (PROTECTED)
app.get('/api/test/coa', requireAdminAuth, (req, res) => {
  try {
    console.log('🧪 Testing Cloudinary CoA generation...');
    const testResult = coaGenerator.testGeneration();
    
    res.json({
      success: true,
      message: 'Cloudinary CoA generation test completed',
      ...testResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('CoA test failed:', error);
    res.status(500).json({
      error: 'Test failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test multiple CoA variations (PROTECTED)
app.get('/api/test/coa-multiple', requireAdminAuth, (req, res) => {
  try {
    console.log('🧪 Testing multiple Cloudinary CoA variations...');
    const testResults = coaGenerator.generateTestCertificates();
    
    res.json({
      success: true,
      message: 'Multiple CoA generation test completed',
      testResults,
      count: testResults.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Multiple CoA test failed:', error);
    res.status(500).json({
      error: 'Multiple test failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Admin endpoint to check system status (PROTECTED)
app.get('/api/admin/status', requireAdminAuth, async (req, res) => {
  try {
    const services = {
      database: 'unknown',
      blockchain: 'unknown',
      imageGeneration: 'healthy',
      email: 'unknown'
    };

    // Check database health
    try {
      await db.supabase.from('orders').select('id').limit(1);
      services.database = 'healthy';
    } catch (error) {
      services.database = 'error';
    }

    // Check blockchain health
    try {
      const sdk = ThirdwebSDK.fromPrivateKey(
        process.env.THIRDWEB_PRIVATE_KEY,
        process.env.THIRDWEB_CHAIN || "polygon",
        { clientId: process.env.THIRDWEB_CLIENT_ID }
      );
      const contract = await sdk.getContract(process.env.THIRDWEB_CONTRACT_ADDRESS);
      await contract.metadata.get();
      services.blockchain = 'healthy';
    } catch (error) {
      services.blockchain = 'error';
    }

    // Check email service
    try {
      const emailTest = await emailService.testConnection();
      services.email = emailTest.success ? 'healthy' : 'error';
    } catch (error) {
      services.email = 'error';
    }

    res.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      services,
      version: '3.1.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      activeSessions: adminSessions.size
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of adminSessions.entries()) {
    if (session.expiresAt < now) {
      adminSessions.delete(sessionId);
      console.log('🧹 Cleaned up expired admin session');
    }
  }
}, 60000); // Check every minute

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('💥 Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'GET /admin - Admin Dashboard',
      'POST /webhook/shopify - Shopify Webhook',
      'POST /api/claim/verify - Verify Claim',
      'POST /api/claim/process - Process Claim', 
      'GET /api/claim/status/:token - Claim Status',
      'POST /api/generate-coa - Generate CoA',
      'GET /health - Health Check'
    ]
  });
});

// Graceful error handling
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const port = process.env.PORT || 3000;

// Export for Vercel
module.exports = app;

// Local development
if (require.main === module) {
  app.listen(port, () => {
    console.log(`🚀 Mavire Codoir NFT Minting System running on port ${port}`);
    console.log(`🔐 Admin Dashboard: http://localhost:${port}/admin`);
    console.log(`📊 System Status: http://localhost:${port}/api/admin/status`);
    console.log(`🧪 CoA Test: http://localhost:${port}/api/test/coa`);
    console.log(`💡 Remember to set ADMIN_ACCESS_TOKEN environment variable`);
  });
}