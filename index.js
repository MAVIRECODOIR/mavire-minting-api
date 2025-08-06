const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { ThirdwebSDK } = require('thirdweb');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');

const CoAGenerator = require('./coaGenerator');
const DatabaseService = require('./databaseService');
const WalletService = require('./walletService');
const EmailService = require('./emailService');

const app = express();
const coaGenerator = new CoAGenerator();
const db = new DatabaseService();
const walletService = new WalletService();
const emailService = new EmailService();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests, please try again later.'
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Webhook rate limiting
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  skip: (req) => false
});

// Health check
app.get('/', (req, res) => {
  res.json({
    message: 'Mavire Codoir Complete NFT Minting System',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /webhook/shopify - Shopify order webhook',
      'POST /api/claim/verify - Verify claim eligibility',
      'POST /api/claim/process - Process NFT claim',
      'GET /api/claim/status/:token - Get claim status'
    ]
  });
});

// Shopify Webhook Handler
app.post('/webhook/shopify', webhookLimiter, async (req, res) => {
  try {
    console.log('Received Shopify webhook:', req.headers['x-shopify-topic']);
    
    const order = req.body;
    
    // Store order in database
    const storedOrder = await db.storeOrder(order);
    console.log('Order stored:', storedOrder.shopify_order_id);

    // If order is NFT eligible, create a claim token
    if (storedOrder.is_nft_eligible) {
      const claimToken = uuidv4();
      const claim = await db.createClaim(
        storedOrder.shopify_order_id,
        storedOrder.customer_email,
        claimToken
      );
      
      console.log('Claim created:', claim.claim_token);
      
      // Send email to customer with claim link
      try {
        await emailService.sendClaimEmail(storedOrder.customer_email, claimToken, storedOrder);
        console.log('Claim email sent to:', storedOrder.customer_email);
      } catch (emailError) {
        console.error('Failed to send claim email:', emailError);
        // Continue processing - don't fail the webhook
      }
    }

    res.status(200).json({ 
      received: true,
      orderId: storedOrder.shopify_order_id,
      nftEligible: storedOrder.is_nft_eligible
    });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
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
          productName: claim.orders.product_name,
          productSku: claim.orders.product_sku,
          orderNumber: claim.orders.shopify_order_number,
          expiresAt: claim.expires_at
        }
      });
    } else {
      // Check if email has any eligible orders
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
      claimToken: Joi.string().uuid().required(),
      templateImage: Joi.string().required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, claimToken, templateImage } = value;

    // Verify claim
    const claim = await db.verifyClaim(email, claimToken);
    if (!claim) {
      return res.status(404).json({ error: 'Invalid or expired claim' });
    }

    console.log('Processing claim for:', email);

    // Generate wallet
    const walletData = walletService.generateWallet();
    console.log('Generated wallet:', walletData.address);

    // Generate CoA
    const coaResult = await coaGenerator.generateCoAFromBase64({
      productName: claim.orders.product_name,
      sku: claim.orders.product_sku,
      shopifyOrderId: claim.orders.shopify_order_id,
      customerName: null
    }, templateImage);

    console.log('Generated CoA:', coaResult.uniqueId);

    // Initialize ThirdWeb and mint NFT
    const sdk = ThirdwebSDK.fromPrivateKey(
      process.env.THIRDWEB_PRIVATE_KEY,
      process.env.THIRDWEB_CHAIN || "polygon"
    );

    const contract = await sdk.getContract(process.env.THIRDWEB_CONTRACT_ADDRESS);

    const nftMetadata = {
      name: `${claim.orders.product_name} - Certificate of Authenticity`,
      description: `Official Certificate of Authenticity for ${claim.orders.product_name} by Mavire Codoir`,
      image: `data:image/png;base64,${coaResult.imageBuffer.toString('base64')}`,
      attributes: [
        {
          trait_type: "Product Name",
          value: claim.orders.product_name
        },
        {
          trait_type: "SKU",
          value: claim.orders.product_sku
        },
        {
          trait_type: "Authenticity ID",
          value: coaResult.uniqueId
        },
        {
          trait_type: "Authorization Date",
          value: coaResult.authDate
        },
        {
          trait_type: "Order Number",
          value: claim.orders.shopify_order_number
        },
        {
          trait_type: "Brand",
          value: "Mavire Codoir"
        }
      ],
      properties: {
        authenticity_id: coaResult.uniqueId,
        generated_at: new Date().toISOString(),
        brand: "Mavire Codoir",
        type: "Certificate of Authenticity",
        claim_token: claimToken
      }
    };

    console.log('Minting NFT to:', walletData.address);
    const mintResult = await contract.erc721.mintTo(walletData.address, nftMetadata);

    console.log('NFT minted:', mintResult.id.toString());

    // Update claim with results
    const updatedClaim = await db.updateClaimWithNFT(
      claim.id,
      walletData,
      {
        tokenId: mintResult.id.toString(),
        transactionHash: mintResult.receipt.transactionHash,
        coaUniqueId: coaResult.uniqueId,
        metadata: nftMetadata
      }
    );

    // Format response
    const walletDisplay = walletService.formatWalletForDisplay(walletData);
    const walletExport = walletService.generateWalletExport(walletData, email);

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
          uniqueId: coaResult.uniqueId,
          authDate: coaResult.authDate,
          filename: coaResult.filename
        },
        export: walletExport
      }
    });

  } catch (error) {
    console.error('Claim processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process claim',
      details: error.message 
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
        name: claim.orders.product_name,
        sku: claim.orders.product_sku
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

// Generate CoA only (for testing)
app.post('/api/generate-coa', async (req, res) => {
  try {
    const {
      productName,
      sku,
      shopifyOrderId,
      templateImage
    } = req.body;

    if (!productName || !sku || !shopifyOrderId || !templateImage) {
      return res.status(400).json({
        error: 'Missing required fields: productName, sku, shopifyOrderId, templateImage'
      });
    }

    const coaResult = await coaGenerator.generateCoAFromBase64({
      productName,
      sku,
      shopifyOrderId,
      customerName: null
    }, templateImage);

    res.json({
      success: true,
      data: {
        image: coaResult.imageBuffer.toString('base64'),
        uniqueId: coaResult.uniqueId,
        authDate: coaResult.authDate,
        filename: coaResult.filename
      }
    });

  } catch (error) {
    console.error('CoA generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate Certificate of Authenticity',
      details: error.message 
    });
  }
});

// Admin endpoint to check system status
app.get('/api/admin/status', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    const blockchainHealth = await checkBlockchainHealth();
    
    res.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth ? 'healthy' : 'error',
        blockchain: blockchainHealth ? 'healthy' : 'error',
        imageGeneration: 'healthy'
      },
      version: '3.0.0'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

async function checkDatabaseHealth() {
  try {
    const { data, error } = await db.supabase
      .from('orders')
      .select('id')
      .limit(1);
    return !error;
  } catch (error) {
    return false;
  }
}

async function checkBlockchainHealth() {
  try {
    const sdk = ThirdwebSDK.fromPrivateKey(
      process.env.THIRDWEB_PRIVATE_KEY,
      process.env.THIRDWEB_CHAIN || "polygon"
    );
    const contract = await sdk.getContract(process.env.THIRDWEB_CONTRACT_ADDRESS);
    await contract.metadata.get();
    return true;
  } catch (error) {
    console.error('Blockchain health check failed:', error);
    return false;
  }
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: [
      'POST /webhook/shopify',
      'POST /api/claim/verify',
      'POST /api/claim/process',
      'GET /api/claim/status/:token',
      'POST /api/generate-coa',
      'GET /api/admin/status'
    ]
  });
});

const port = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`🚀 Mavire Codoir NFT Minting System running on port ${port}`);
    console.log(`📊 Admin status: http://localhost:${port}/api/admin/status`);
  });
}

module.exports = app;