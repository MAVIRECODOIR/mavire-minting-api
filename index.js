const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { ThirdwebSDK } = require('@thirdweb-dev/sdk');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');

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

// Webhook rate limiting (more restrictive)
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Webhook rate limit exceeded' }
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Health check and root route
app.get('/', (req, res) => {
  res.json({
    message: 'Mavire Codoir Complete NFT Minting System',
    version: '3.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /webhook/shopify - Shopify order webhook',
      'POST /api/claim/verify - Verify claim eligibility', 
      'POST /api/claim/process - Process NFT claim',
      'GET /api/claim/status/:token - Get claim status',
      'POST /api/generate-coa - Generate CoA URL',
      'GET /api/test/coa - Test CoA generation',
      'GET /api/admin/status - System status'
    ]
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
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

// Test Cloudinary endpoint
app.get('/api/test/coa', (req, res) => {
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

// Test multiple CoA variations
app.get('/api/test/coa-multiple', (req, res) => {
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

// Admin endpoint to check system status
app.get('/api/admin/status', async (req, res) => {
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
      version: '3.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

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
      'POST /webhook/shopify',
      'POST /api/claim/verify',
      'POST /api/claim/process', 
      'GET /api/claim/status/:token',
      'POST /api/generate-coa',
      'GET /api/test/coa',
      'GET /api/test/coa-multiple',
      'GET /api/admin/status'
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
    console.log(`📊 Admin status: http://localhost:${port}/api/admin/status`);
    console.log(`🧪 CoA test: http://localhost:${port}/api/test/coa`);
  });
}