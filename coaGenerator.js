const { createCanvas, loadImage, registerFont } = require('canvas');
const sharp = require('sharp');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

class CoAGenerator {
  constructor() {
    this.canvasWidth = 1024;
    this.canvasHeight = 1024;
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
   * Generate Certificate of Authenticity image
   */
  async generateCoA(data, backgroundImage) {
    try {
      const canvas = createCanvas(this.canvasWidth, this.canvasHeight);
      const ctx = canvas.getContext('2d');

      // Load background image
      const bgImage = await loadImage(backgroundImage);
      ctx.drawImage(bgImage, 0, 0, this.canvasWidth, this.canvasHeight);

      // Generate unique ID
      const uniqueId = this.generateUniqueId(data.sku, data.shopifyOrderId);
      
      // Format authorization date
      const authDate = moment().format('MMMM Do, YYYY');

      // Configure text styling
      const setupText = (fontSize, color = '#2c3e50', fontFamily = 'Arial') => {
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
      };

      // Text overlay positions (adjusted for privacy - no customer name shown)
      const positions = {
        productName: { x: 512, y: 320 },
        uniqueId: { x: 512, y: 420 },
        authDate: { x: 512, y: 520 },
        serialNumber: { x: 512, y: 620 }
      };

      // Add product name
      setupText(36, '#1a1a1a', 'Arial Bold');
      ctx.fillText(data.productName.toUpperCase(), positions.productName.x, positions.productName.y);

      // Add unique ID
      setupText(28, '#2c3e50');
      ctx.fillText(`AUTHENTICITY ID: ${uniqueId}`, positions.uniqueId.x, positions.uniqueId.y);

      // Add authorization date
      setupText(24, '#555');
      ctx.fillText(`AUTHORIZED: ${authDate}`, positions.authDate.x, positions.authDate.y);

      // Add serial number for additional verification
      const serialNumber = `SN-${data.shopifyOrderId.slice(-8)}`;
      setupText(20, '#666');
      ctx.fillText(`SERIAL: ${serialNumber}`, positions.serialNumber.x, positions.serialNumber.y);

      // Add Mavire Codoir branding
      setupText(16, '#888');
      ctx.fillText('MAVIRE CODOIR - CERTIFICATE OF AUTHENTICITY', 512, 850);

      // Convert canvas to buffer
      const canvasBuffer = canvas.toBuffer('image/png');

      // Optimize image with sharp
      const optimizedBuffer = await sharp(canvasBuffer)
        .png({ quality: 90, compressionLevel: 6 })
        .toBuffer();

      return {
        imageBuffer: optimizedBuffer,
        uniqueId: uniqueId,
        authDate: authDate,
        filename: `Mavire_CoA_${data.productName.replace(/[^a-zA-Z0-9]/g, '_')}_${uniqueId}.png`
      };

    } catch (error) {
      console.error('Error generating CoA:', error);
      throw new Error('Failed to generate Certificate of Authenticity');
    }
  }

  /**
   * Generate CoA from base64 template
   */
  async generateCoAFromBase64(data, base64Template) {
    const templateBuffer = Buffer.from(base64Template, 'base64');
    return await this.generateCoA(data, templateBuffer);
  }
}

module.exports = CoAGenerator;