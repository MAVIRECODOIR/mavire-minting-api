const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  async sendClaimEmail(customerEmail, claimToken, orderData) {
    const claimUrl = `${process.env.CLAIM_PORTAL_URL}?token=${claimToken}`;
    
    const mailOptions = {
      from: `"Mavire Codoir" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: '🎉 Claim Your NFT Certificate of Authenticity',
      html: this.generateEmailHTML(claimUrl, orderData)
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Claim email sent successfully:', result.messageId);
      return result;
    } catch (error) {
      console.error('Failed to send claim email:', error);
      throw error;
    }
  }

  generateEmailHTML(claimUrl, orderData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <title>Claim Your NFT Certificate</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
              <h1 style="margin: 0; font-size: 32px; font-weight: bold;">MAVIRE CODOIR</h1>
              <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">Certificate of Authenticity</p>
          </div>
          
          <div style="background: white; padding: 40px;">
              <h2 style="color: #333; margin-bottom: 20px; font-size: 24px;">Thank you for your purchase! 🎉</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #555; margin-bottom: 25px;">
                  Your order for <strong style="color: #667eea;">${orderData.product_name}</strong> includes a complimentary NFT Certificate of Authenticity.
              </p>
              
              <div style="background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%); border-radius: 15px; padding: 25px; margin: 25px 0; text-align: center;">
                  <h3 style="color: #1976d2; margin: 0 0 15px 0; font-size: 20px;">🎨 Your Unique NFT Certificate</h3>
                  <p style="color: #666; margin-bottom: 20px;">Click below to claim your blockchain-verified Certificate of Authenticity:</p>
                  
                  <a href="${claimUrl}" 
                     style="background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); color: white; padding: 15px 35px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);">
                      🚀 Claim My NFT Certificate
                  </a>
              </div>
              
              <div style="background: #fff8e1; border-left: 4px solid #ffa726; padding: 20px; margin: 25px 0; border-radius: 5px;">
                  <h4 style="color: #ef6c00; margin: 0 0 10px 0; font-size: 16px;">⏰ Important Information:</h4>
                  <ul style="color: #ef6c00; margin: 0; padding-left: 20px; line-height: 1.6;">
                      <li>This claim link expires in <strong>90 days</strong></li>
                      <li>Use the email address from this order to verify</li>
                      <li>A secure crypto wallet will be created automatically</li>
                      <li>Your NFT will be minted directly to your new wallet</li>
                  </ul>
              </div>
              
              <div style="border: 1px solid #e0e0e0; border-radius: 10px; padding: 20px; margin: 25px 0;">
                  <h4 style="color: #333; margin: 0 0 15px 0; font-size: 16px;">📋 Order Details:</h4>
                  <div style="color: #666; line-height: 1.6;">
                      <p style="margin: 5px 0;"><strong>Order #:</strong> ${orderData.shopify_order_number}</p>
                      <p style="margin: 5px 0;"><strong>Product:</strong> ${orderData.product_name}</p>
                      <p style="margin: 5px 0;"><strong>SKU:</strong> ${orderData.product_sku}</p>
                  </div>
              </div>
              
              <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                  <p style="color: #999; font-size: 14px; margin: 0;">
                      Questions? Contact us at 
                      <a href="mailto:support@mavirecodoir.com" style="color: #667eea;">support@mavirecodoir.com</a>
                  </p>
              </div>
          </div>
      </body>
      </html>
    `;
  }
}

module.exports = EmailService;