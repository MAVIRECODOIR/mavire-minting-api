// test-email.js - Run this locally to test Microsoft Graph email
const axios = require('axios');

class EmailTester {
  constructor() {
    // Load from environment variables
    this.clientId = process.env.MICROSOFT_CLIENT_ID;
    this.clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    this.tenantId = process.env.MICROSOFT_TENANT_ID;
    this.fromEmail = process.env.FROM_EMAIL || 'customerservice@mavirecodoir.com';
    
    this.tokenEndpoint = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    this.graphEndpoint = 'https://graph.microsoft.com/v1.0';
  }

  async getAccessToken() {
    console.log('🔑 Getting Microsoft Graph access token...');
    
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

      console.log('✅ Access token obtained successfully');
      return response.data.access_token;
    } catch (error) {
      console.error('❌ Failed to get access token:');
      console.error('Status:', error.response?.status);
      console.error('Error:', error.response?.data);
      throw new Error('Authentication failed');
    }
  }

  async sendTestEmail(testEmail) {
    try {
      const accessToken = await this.getAccessToken();
      
      console.log(`📧 Sending test email to: ${testEmail}`);
      
      const emailMessage = {
        message: {
          subject: '🧪 TEST: Mavire Codoir Email Service Working',
          body: {
            contentType: 'HTML',
            content: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #667eea;">Email Service Test Successful! ✅</h2>
                <p>This test email confirms that your Microsoft Graph email service is working correctly.</p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h3>Test Details:</h3>
                  <ul>
                    <li><strong>From:</strong> ${this.fromEmail}</li>
                    <li><strong>Service:</strong> Microsoft Graph API</li>
                    <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
                  </ul>
                </div>
                <p>Your Mavire NFT minting system email service is ready! 🚀</p>
                <hr>
                <p style="color: #666; font-size: 12px;">
                  This is a test email from your local development environment.
                </p>
              </div>
            `
          },
          toRecipients: [
            {
              emailAddress: {
                address: testEmail
              }
            }
          ],
          from: {
            emailAddress: {
              address: this.fromEmail,
              name: 'Mavire Codoir Test'
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

      console.log('✅ Test email sent successfully!');
      console.log('Request ID:', response.headers['request-id'] || 'Not provided');
      
      return {
        success: true,
        messageId: response.headers['request-id'] || 'graph-api',
        service: 'Microsoft Graph'
      };

    } catch (error) {
      console.error('❌ Failed to send test email:');
      console.error('Status:', error.response?.status);
      console.error('Error:', error.response?.data);
      
      if (error.response?.data?.error) {
        console.error('Error Details:', error.response.data.error);
      }
      
      throw new Error(`Email sending failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  validateConfig() {
    console.log('🔍 Validating email configuration...');
    
    const required = [
      { name: 'MICROSOFT_CLIENT_ID', value: this.clientId },
      { name: 'MICROSOFT_CLIENT_SECRET', value: this.clientSecret },
      { name: 'MICROSOFT_TENANT_ID', value: this.tenantId },
      { name: 'FROM_EMAIL', value: this.fromEmail }
    ];

    const missing = required.filter(item => !item.value);
    
    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:');
      missing.forEach(item => console.error(`   - ${item.name}`));
      return false;
    }

    console.log('✅ All required environment variables are set');
    return true;
  }
}

// Main execution
async function runEmailTest() {
  console.log('🚀 Starting Mavire Email Service Test\n');

  // Get test email from command line argument
  const testEmail = process.argv[2];
  
  if (!testEmail) {
    console.log('❌ Please provide a test email address:');
    console.log('   node test-email.js your-email@example.com');
    process.exit(1);
  }

  const emailTester = new EmailTester();

  try {
    // Validate configuration
    if (!emailTester.validateConfig()) {
      console.log('\n📝 Make sure your .env file contains:');
      console.log('   MICROSOFT_CLIENT_ID=your_client_id');
      console.log('   MICROSOFT_CLIENT_SECRET=your_client_secret');
      console.log('   MICROSOFT_TENANT_ID=your_tenant_id');
      console.log('   FROM_EMAIL=customerservice@mavirecodoir.com');
      process.exit(1);
    }

    // Send test email
    await emailTester.sendTestEmail(testEmail);
    
    console.log('\n🎉 Email test completed successfully!');
    console.log(`   Check ${testEmail} for the test message`);
    console.log('   (It may take a few minutes to arrive)');
    
  } catch (error) {
    console.error('\n💥 Email test failed:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('   1. Check your Microsoft Entra app registration');
    console.log('   2. Verify Mail.Send permissions are granted');
    console.log('   3. Ensure admin consent is provided');
    console.log('   4. Check that customerservice@mavirecodoir.com exists and is accessible');
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Email test cancelled');
  process.exit(0);
});

// Run the test
runEmailTest();