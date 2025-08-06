const axios = require('axios');

class MicrosoftGraphEmailService {
  constructor() {
    this.clientId = process.env.MICROSOFT_CLIENT_ID;
    this.clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    this.tenantId = process.env.MICROSOFT_TENANT_ID;
    this.fromEmail = process.env.FROM_EMAIL; // customerservice@mavirecodoir.com
    this.tokenEndpoint = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    this.graphEndpoint = 'https://graph.microsoft.com/v1.0';
    
    // Cache token to avoid getting new one for every email
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(this.tokenEndpoint, new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials'
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken = response.data.access_token;
      // Set expiry 5 minutes before actual expiry for safety
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;
      
      console.log('Successfully obtained Microsoft Graph access token');
      return this.accessToken;
    } catch (error) {
      console.error('Failed to get Microsoft Graph access token:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Microsoft Graph');
    }
  }

  async sendClaimEmail(customerEmail, claimToken, orderData) {
    try {
      const accessToken = await this.getAccessToken();
      const claimUrl = `${process.env.CLAIM_PORTAL_URL}?token=${claimToken}`;
      
      const emailMessage = {
        message: {
          subject: '🎉 Claim Your NFT Certificate of Authenticity - Mavire Codoir',
          body: {
            contentType: 'HTML',
            content: this.generateEmailHTML(claimUrl, orderData)
          },
          toRecipients: [
            {
              emailAddress: {
                address: customerEmail
              }
            }
          ],
          from: {
            emailAddress: {
              address: this.fromEmail,
              name: 'Mavire Codoir'
            }
          }
        },
        saveToSentItems: true
      };

      // Send email using Graph API
      const response = await axios.post(
        `${this.graphEndpoint}/users/${this.fromEmail}/sendMail`,
        emailMessage,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Claim email sent successfully via Microsoft Graph to:', customerEmail);
      return {
        success: true,
        messageId: response.headers['request-id'] || 'graph-api',
        service: 'Microsoft Graph'
      };

    } catch (error) {
      console.error('Failed to send email via Microsoft Graph:', error.response?.data || error.message);
      throw new Error(`Failed to send claim email: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async sendWelcomeEmail(customerEmail, walletData, nftData, orderData) {
    try {
      const accessToken = await this.getAccessToken();
      
      const emailMessage = {
        message: {
          subject: '🎉 Your NFT Certificate Has Been Created! - Mavire Codoir',
          body: {
            contentType: 'HTML',
            content: this.generateWelcomeEmailHTML(walletData, nftData, orderData)
          },
          toRecipients: [
            {
              emailAddress: {
                address: customerEmail
              }
            }
          ],
          from: {
            emailAddress: {
              address: this.fromEmail,
              name: 'Mavire Codoir'
            }
          }
        },
        saveToSentItems: true
      };

      const response = await axios.post(
        `${this.graphEndpoint}/users/${this.fromEmail}/sendMail`,
        emailMessage,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Welcome email sent successfully via Microsoft Graph to:', customerEmail);
      return {
        success: true,
        messageId: response.headers['request-id'] || 'graph-api',
        service: 'Microsoft Graph'
      };

    } catch (error) {
      console.error('Failed to send welcome email via Microsoft Graph:', error.response?.data || error.message);
      throw new Error(`Failed to send welcome email: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  generateEmailHTML(claimUrl, orderData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <title>Claim Your NFT Certificate</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; color: white; border-radius: 15px 15px 0 0;">
              <h1 style="margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 2px;">MAVIRE CODOIR</h1>
              <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.95; font-weight: 300;">Certificate of Authenticity</p>
          </div>
          
          <div style="background: white; padding: 40px 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
              <h2 style="color: #2c3e50; margin-bottom: 25px; font-size: 28px; text-align: center;">Thank you for your purchase! 🎉</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #555; margin-bottom: 25px; text-align: center;">
                  Your order for <strong style="color: #667eea; font-size: 18px;">${orderData.product_name}</strong> includes a complimentary NFT Certificate of Authenticity.
              </p>
              
              <div style="background: linear-gradient(135deg, #e8f4f8 0%, #f4e8f8 100%); border-radius: 20px; padding: 30px; margin: 30px 0; text-align: center; border: 2px solid #e1e8ed;">
                  <div style="margin-bottom: 20px;">
                      <span style="font-size: 48px;">🎨</span>
                  </div>
                  <h3 style="color: #1976d2; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Your Unique NFT Certificate</h3>
                  <p style="color: #666; margin-bottom: 25px; font-size: 16px; line-height: 1.6;">Click below to claim your blockchain-verified Certificate of Authenticity:</p>
                  
                  <a href="${claimUrl}" 
                     style="background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); color: white; padding: 18px 40px; text-decoration: none; border-radius: 30px; font-weight: 600; display: inline-block; font-size: 16px; box-shadow: 0 6px 20px rgba(76, 175, 80, 0.3); text-transform: uppercase; letter-spacing: 1px; transition: all 0.3s ease;">
                      🚀 Claim My NFT Certificate
                  </a>
              </div>
              
              <div style="background: #fff3cd; border-left: 5px solid #ffa726; padding: 25px; margin: 30px 0; border-radius: 8px;">
                  <h4 style="color: #e65100; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">⏰ Important Information:</h4>
                  <ul style="color: #d84315; margin: 0; padding-left: 20px; line-height: 1.8; font-size: 15px;">
                      <li>This claim link expires in <strong>90 days</strong></li>
                      <li>Use the email address from this order to verify</li>
                      <li>A secure crypto wallet will be created automatically</li>
                      <li>Your NFT will be minted directly to your new wallet</li>
                  </ul>
              </div>
              
              <div style="border: 1px solid #e0e0e0; border-radius: 12px; padding: 25px; margin: 30px 0; background: #fafafa;">
                  <h4 style="color: #333; margin: 0 0 20px 0; font-size: 18px; font-weight: 600;">📋 Order Details:</h4>
                  <div style="color: #666; line-height: 1.8; font-size: 15px;">
                      <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px 0; border-bottom: 1px solid #eee;">
                          <span><strong>Order #:</strong></span>
                          <span>${orderData.shopify_order_number}</span>
                      </div>
                      <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px 0; border-bottom: 1px solid #eee;">
                          <span><strong>Product:</strong></span>
                          <span>${orderData.product_name}</span>
                      </div>
                      <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                          <span><strong>SKU:</strong></span>
                          <span>${orderData.product_sku}</span>
                      </div>
                  </div>
              </div>
              
              <div style="text-align: center; margin-top: 40px; padding-top: 25px; border-top: 2px solid #eee;">
                  <p style="color: #888; font-size: 14px; margin: 0 0 10px 0;">
                      Questions about your NFT certificate?
                  </p>
                  <p style="margin: 0;">
                      <a href="mailto:customerservice@mavirecodoir.com" style="color: #667eea; font-weight: 600; text-decoration: none;">customerservice@mavirecodoir.com</a>
                  </p>
              </div>
          </div>
          
          <div style="background: #2c3e50; padding: 25px 30px; text-align: center; color: #bdc3c7; font-size: 13px; border-radius: 0 0 15px 15px;">
              <p style="margin: 0 0 10px 0;">© 2024 Mavire Codoir. All rights reserved.</p>
              <p style="margin: 0; opacity: 0.8;">This email was sent regarding your recent purchase. Please do not reply to this email.</p>
          </div>
      </body>
      </html>
    `;
  }

  generateWelcomeEmailHTML(walletData, nftData, orderData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <title>Your NFT Certificate Is Ready!</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
          <div style="background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); padding: 40px 30px; text-align: center; color: white; border-radius: 15px 15px 0 0;">
              <span style="font-size: 64px; display: block; margin-bottom: 10px;">🎉</span>
              <h1 style="margin: 0; font-size: 32px; font-weight: bold;">NFT Certificate Created!</h1>
              <p style="margin: 15px 0 0 0; font-size: 16px; opacity: 0.95;">Your blockchain certificate is now ready</p>
          </div>
          
          <div style="background: white; padding: 40px 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
              <h2 style="color: #2c3e50; margin-bottom: 25px; font-size: 24px; text-align: center;">Congratulations!</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #555; margin-bottom: 30px; text-align: center;">
                  Your NFT Certificate of Authenticity for <strong style="color: #27ae60;">${orderData.product_name}</strong> has been successfully created and is now stored on the blockchain.
              </p>
              
              <div style="background: #e8f5e8; border-radius: 15px; padding: 25px; margin: 25px 0; border: 2px solid #27ae60;">
                  <h3 style="color: #1e7e34; margin: 0 0 20px 0; font-size: 20px; text-align: center;">🔐 Your Secure Wallet</h3>
                  <div style="background: white; padding: 20px; border-radius: 10px; margin: 15px 0;">
                      <p style="margin: 0 0 10px 0; color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Wallet Address:</p>
                      <p style="margin: 0; color: #2c3e50; font-family: 'Courier New', monospace; font-size: 14px; word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px;">${walletData.address}</p>
                  </div>
              </div>

              <div style="background: #fff3cd; border-left: 5px solid #ffc107; padding: 25px; margin: 30px 0; border-radius: 8px;">
                  <h4 style="color: #856404; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">🔒 Important Security Information:</h4>
                  <ul style="color: #856404; margin: 0; padding-left: 20px; line-height: 1.8; font-size: 14px;">
                      <li><strong>Keep your private key secure</strong> - Never share it with anyone</li>
                      <li><strong>Import to MetaMask</strong> - Use your private key to access your NFT</li>
                      <li><strong>Blockchain verified</strong> - Your certificate cannot be forged</li>
                      <li><strong>Permanent record</strong> - This proves authenticity forever</li>
                  </ul>
              </div>

              <div style="border: 1px solid #e0e0e0; border-radius: 12px; padding: 25px; margin: 30px 0; background: #fafafa;">
                  <h4 style="color: #333; margin: 0 0 20px 0; font-size: 18px; font-weight: 600;">📊 Certificate Details:</h4>
                  <div style="color: #666; line-height: 1.8; font-size: 15px;">
                      <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px 0; border-bottom: 1px solid #eee;">
                          <span><strong>Token ID:</strong></span>
                          <span>${nftData.tokenId}</span>
                      </div>
                      <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px 0; border-bottom: 1px solid #eee;">
                          <span><strong>Contract:</strong></span>
                          <span style="font-family: monospace; font-size: 12px;">${process.env.THIRDWEB_CONTRACT_ADDRESS}</span>
                      </div>
                      <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                          <span><strong>Network:</strong></span>
                          <span>Polygon</span>
                      </div>
                  </div>
              </div>

              <div style="text-align: center; margin-top: 40px; padding-top: 25px; border-top: 2px solid #eee;">
                  <p style="color: #888; font-size: 14px; margin: 0 0 10px 0;">
                      Need help with your NFT certificate?
                  </p>
                  <p style="margin: 0;">
                      <a href="mailto:customerservice@mavirecodoir.com" style="color: #27ae60; font-weight: 600; text-decoration: none;">customerservice@mavirecodoir.com</a>
                  </p>
              </div>
          </div>
          
          <div style="background: #2c3e50; padding: 25px 30px; text-align: center; color: #bdc3c7; font-size: 13px; border-radius: 0 0 15px 15px;">
              <p style="margin: 0 0 10px 0;">© 2024 Mavire Codoir. All rights reserved.</p>
              <p style="margin: 0; opacity: 0.8;">Your NFT certificate is permanently stored on the blockchain.</p>
          </div>
      </body>
      </html>
    `;
  }

  async testConnection() {
    try {
      const accessToken = await this.getAccessToken();
      console.log('Microsoft Graph connection successful');
      return {
        success: true,
        service: 'Microsoft Graph',
        fromEmail: this.fromEmail
      };
    } catch (error) {
      console.error('Microsoft Graph connection failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = MicrosoftGraphEmailService;