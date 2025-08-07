const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

class CloudinaryCoAGenerator {
  constructor() {
    this.baseImageUrl = 'https://res.cloudinary.com/dd3cjiork/image/upload';
    this.templateImage = 'Mavire_CoA_-_Customer_iehzb9.jpg';
  }

  /**
   * Generate a unique ID based on SKU and Shopify Order ID
   */
  generateUniqueId(sku, orderId) {
    const timestamp = Date.now().toString(36);
    const orderSuffix = orderId.slice(-6);
    const skuPrefix = sku.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
    
    return `${skuPrefix}-${orderSuffix}-${timestamp}`.toUpperCase();
  }

  /**
   * Generate Certificate of Authenticity URL with Cloudinary transformations
   */
  generateCoAUrl(data) {
    try {
      // Generate unique ID and format data
      const uniqueId = this.generateUniqueId(data.sku, data.shopifyOrderId);
      const authDate = moment().format('MMMM Do, YYYY');
      const serialNumber = `SN-${data.shopifyOrderId.slice(-8)}`;

      // Prepare text overlays with proper URL encoding
      const productName = encodeURIComponent(data.productName.toUpperCase());
      const authenticityId = encodeURIComponent(`AUTHENTICITY ID: ${uniqueId}`);
      const authorizedDate = encodeURIComponent(`AUTHORIZED: ${authDate}`);
      const serial = encodeURIComponent(`SERIAL: ${serialNumber}`);
      const brandText = encodeURIComponent('MAVIRE CODOIR - CERTIFICATE OF AUTHENTICITY');

      // Build Cloudinary transformation URL with multiple text overlays
      const transformations = [
        // Product Name (large, bold, centered at top)
        `l_text:Amiri_36_bold:${productName},co_rgb:1a1a1a,g_center,y_-100`,
        
        // Authenticity ID (medium size, centered)
        `l_text:Amiri_28:${authenticityId},co_rgb:2c3e50,g_center,y_-20`,
        
        // Authorization Date (medium size, centered)
        `l_text:Amiri_24:${authorizedDate},co_rgb:555555,g_center,y_40`,
        
        // Serial Number (smaller, centered)
        `l_text:Amiri_20:${serial},co_rgb:666666,g_center,y_100`,
        
        // Brand Text (small, at bottom)
        `l_text:Amiri_16:${brandText},co_rgb:888888,g_center,y_240`
      ].join('/');

      const coaImageUrl = `${this.baseImageUrl}/${transformations}/${this.templateImage}`;

      return {
        imageUrl: coaImageUrl,
        uniqueId: uniqueId,
        authDate: authDate,
        serialNumber: serialNumber,
        filename: `Mavire_CoA_${data.productName.replace(/[^a-zA-Z0-9]/g, '_')}_${uniqueId}.jpg`
      };

    } catch (error) {
      console.error('Error generating CoA URL:', error);
      throw new Error('Failed to generate Certificate of Authenticity URL');
    }
  }

  /**
   * Generate CoA for customer display (simpler version)
   */
  generateSimpleCoA(data) {
    try {
      const uniqueId = this.generateUniqueId(data.sku, data.shopifyOrderId);
      const authDate = moment().format('MMMM Do, YYYY');

      // Simple version with just essential text
      const productName = encodeURIComponent(data.productName.toUpperCase());
      const authenticityText = encodeURIComponent(`${uniqueId} - ${authDate}`);

      const transformations = [
        `l_text:Amiri_30:${productName},co_black,g_center,y_-50`,
        `l_text:Amiri_20:${authenticityText},co_rgb:333333,g_center,y_50`
      ].join('/');

      const coaImageUrl = `${this.baseImageUrl}/${transformations}/${this.templateImage}`;

      return {
        imageUrl: coaImageUrl,
        uniqueId: uniqueId,
        authDate: authDate,
        filename: `Mavire_CoA_${data.productName.replace(/[^a-zA-Z0-9]/g, '_')}_${uniqueId}.jpg`
      };

    } catch (error) {
      console.error('Error generating simple CoA:', error);
      throw new Error('Failed to generate Certificate of Authenticity');
    }
  }

  /**
   * Test the Cloudinary transformation
   */
  generateTestCoA() {
    const testData = {
      productName: "Premium Leather Jacket",
      sku: "MLJ-001",
      shopifyOrderId: "5001234567890"
    };

    return this.generateCoAUrl(testData);
  }
}

module.exports = CloudinaryCoAGenerator;