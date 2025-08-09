const { createClient } = require('@supabase/supabase-js');
const CryptoJS = require('crypto-js');

class DatabaseService {
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,  // Fixed: matches your .env
      process.env.SUPABASE_SERVICE_KEY
    );
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'mavire-default-key-change-in-production';
  }

  encrypt(text) {
    return CryptoJS.AES.encrypt(text, this.encryptionKey).toString();
  }

  decrypt(encryptedText) {
    const bytes = CryptoJS.AES.decrypt(encryptedText, this.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  async storeOrder(orderData) {
    try {
      const { data, error } = await this.supabase
        .from('orders')
        .insert([{
          shopify_order_id: orderData.id.toString(),
          shopify_order_number: orderData.order_number.toString(),
          customer_email: orderData.customer.email,
          customer_first_name: orderData.customer.first_name,
          customer_last_name: orderData.customer.last_name,
          product_name: orderData.line_items[0]?.name || 'Unknown Product',
          product_sku: orderData.line_items[0]?.sku || 'NO-SKU',
          order_total: parseFloat(orderData.total_price),
          currency: orderData.currency,
          is_nft_eligible: this.isNFTEligible(orderData),
          nft_template_url: this.getTemplateURL(orderData),
          order_metadata: {
            line_items: orderData.line_items,
            shipping_address: orderData.shipping_address,
            billing_address: orderData.billing_address
          }
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error storing order:', error);
      throw error;
    }
  }

  isNFTEligible(orderData) {
    return orderData.line_items.some(item => 
      item.product_type === 'NFT Eligible' || 
      (item.tags && item.tags.includes('nft-eligible'))
    );
  }

  getTemplateURL(orderData) {
    const firstItem = orderData.line_items[0];
    return `https://your-assets-domain.com/templates/${firstItem.sku}-template.png`;
  }

  async createClaim(shopifyOrderId, customerEmail, claimToken) {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90);

      const { data, error } = await this.supabase
        .from('claims')
        .insert([{
          shopify_order_id: shopifyOrderId,
          customer_email: customerEmail,
          claim_token: claimToken,
          expires_at: expiresAt.toISOString(),
          claim_status: 'pending'
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating claim:', error);
      throw error;
    }
  }

  async verifyClaim(email, claimToken) {
    try {
      const { data, error } = await this.supabase
        .from('claims')
        .select(`
          *,
          orders (*)
        `)
        .eq('claim_token', claimToken)
        .eq('customer_email', email)
        .eq('claim_status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error verifying claim:', error);
      return null;
    }
  }

  async updateClaimWithNFT(claimId, walletData, nftData) {
    try {
      const { data, error } = await this.supabase
        .from('claims')
        .update({
          wallet_address: walletData.address,
          encrypted_private_key: this.encrypt(walletData.privateKey),
          wallet_mnemonic_encrypted: this.encrypt(walletData.mnemonic),
          nft_token_id: nftData.tokenId,
          nft_transaction_hash: nftData.transactionHash,
          coa_unique_id: nftData.coaUniqueId,
          claim_status: 'completed',
          claimed_at: new Date().toISOString(),
          metadata: {
            nft_metadata: nftData.metadata,
            generation_timestamp: new Date().toISOString()
          }
        })
        .eq('id', claimId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating claim:', error);
      throw error;
    }
  }

  async getClaimStatus(claimToken) {
    try {
      const { data, error } = await this.supabase
        .from('claims')
        .select(`
          *,
          orders (product_name, product_sku)
        `)
        .eq('claim_token', claimToken)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting claim status:', error);
      return null;
    }
  }

  async isOrderClaimed(shopifyOrderId) {
    try {
      const { data, error } = await this.supabase
        .from('claims')
        .select('id')
        .eq('shopify_order_id', shopifyOrderId)
        .in('claim_status', ['completed', 'processing']);

      if (error) throw error;
      return data && data.length > 0;
    } catch (error) {
      console.error('Error checking if order claimed:', error);
      return false;
    }
  }

  async getOrderByEmail(email) {
    try {
      const { data, error } = await this.supabase
        .from('orders')
        .select('*')
        .eq('customer_email', email)
        .eq('is_nft_eligible', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting orders by email:', error);
      return [];
    }
  }
}

module.exports = DatabaseService;