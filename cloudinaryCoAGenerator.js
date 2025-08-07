/**
 * Cloudinary-based Certificate of Authenticity Generator
 * Uses Cloudinary's URL transformation API for text overlay
 */

class CloudinaryCoAGenerator {
  constructor() {
    this.baseUrl = 'https://res.cloudinary.com/dd3cjiork/image/upload';
    this.baseImageId = 'Mavire_CoA_-_Customer_iehzb9';
  }

  /**
   * Generate Certificate of Authenticity URL using Cloudinary transformations
   * @param {Object} data - Certificate data
   * @param {string} data.customerName - Customer's full name
   * @param {string} data.productName - Product name
   * @param {string} data.authenticityId - Unique authenticity ID
   * @param {string} data.serialNumber - Serial number
   * @param {Date} data.purchaseDate - Purchase date
   * @returns {string} Cloudinary URL with text overlays
   */
  generateCertificateUrl(data) {
    try {
      const {
        customerName = 'Customer Name',
        productName = 'Mavire Product',
        authenticityId = 'AUTH-000000',
        serialNumber = 'SN-000000',
        purchaseDate = new Date()
      } = data;

      // Format the purchase date
      const formattedDate = this.formatDate(purchaseDate);

      // Create text overlays with proper positioning
      const overlays = [
        // Customer Name - Main placement (center, y_390)
        `l_text:Amiri_30:${this.encodeText(customerName)},co_black,g_center,y_390`,
        
        // Product Name - Above customer name
        `l_text:Amiri_20:${this.encodeText(productName)},co_black,g_center,y_320`,
        
        // Authenticity ID - Below customer name
        `l_text:Amiri_16:${this.encodeText(authenticityId)},co_black,g_center,y_450`,
        
        // Date - Bottom left area
        `l_text:Amiri_14:${this.encodeText(formattedDate)},co_black,g_south_west,x_50,y_50`,
        
        // Serial Number - Bottom right area
        `l_text:Amiri_14:${this.encodeText(serialNumber)},co_black,g_south_east,x_50,y_50`
      ];

      // Combine all overlays
      const transformations = overlays.join('/');

      // Build final URL
      const certificateUrl = `${this.baseUrl}/${transformations}/${this.baseImageId}.jpg`;

      console.log('Generated Certificate URL:', certificateUrl);
      return certificateUrl;

    } catch (error) {
      console.error('Error generating certificate URL:', error);
      // Return fallback URL without text overlays
      return `${this.baseUrl}/${this.baseImageId}.jpg`;
    }
  }

  /**
   * Encode text for Cloudinary URL (handle spaces and special characters)
   * @param {string} text - Text to encode
   * @returns {string} URL-encoded text
   */
  encodeText(text) {
    if (!text || typeof text !== 'string') return 'N/A';
    
    return text
      .trim()
      .replace(/\s+/g, '%20') // Replace spaces with %20
      .replace(/[^a-zA-Z0-9%20\-_.~]/g, '') // Remove special characters except safe ones
      .replace(/'/g, '') // Remove apostrophes
      .replace(/"/g, ''); // Remove quotes
  }

  /**
   * Format date for certificate
   * @param {Date|string} date - Date to format
   * @returns {string} Formatted date string
   */
  formatDate(date) {
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  }

  /**
   * Test the certificate generation with sample data
   * @returns {Object} Test result with URL and sample data
   */
  testGeneration() {
    const sampleData = {
      customerName: 'John Doe',
      productName: 'Mavire Luxury Item',
      authenticityId: 'AUTH-123456',
      serialNumber: 'MV-2024-001',
      purchaseDate: new Date()
    };

    const url = this.generateCertificateUrl(sampleData);

    return {
      success: true,
      sampleData,
      certificateUrl: url,
      message: 'Certificate generation test completed'
    };
  }

  /**
   * Generate multiple certificate variations for testing
   * @returns {Array} Array of test certificates
   */
  generateTestCertificates() {
    const testCases = [
      {
        customerName: 'John Doe',
        productName: 'Mavire Classic',
        authenticityId: 'AUTH-001',
        serialNumber: 'MV-001'
      },
      {
        customerName: 'Jane Smith',
        productName: 'Mavire Premium Collection',
        authenticityId: 'AUTH-002',
        serialNumber: 'MV-002'
      },
      {
        customerName: 'Michael Johnson',
        productName: 'Mavire Limited Edition',
        authenticityId: 'AUTH-003',
        serialNumber: 'MV-003'
      }
    ];

    return testCases.map((testData, index) => ({
      testCase: index + 1,
      data: testData,
      certificateUrl: this.generateCertificateUrl(testData)
    }));
  }
}

// Export the class
module.exports = CloudinaryCoAGenerator;
