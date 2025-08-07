/**
 * Cloudinary-based Certificate of Authenticity Generator
 * Uses Cloudinary's URL transformation API for text overlay
 * PRIVACY-FOCUSED: Does not display customer names publicly
 */

class CloudinaryCoAGenerator {
  constructor() {
    this.baseUrl = 'https://res.cloudinary.com/dd3cjiork/image/upload';
    this.baseImageId = 'Mavire_CoA_-_Customer_iehzb9';
  }

  /**
   * Generate Certificate of Authenticity URL using Cloudinary transformations
   * @param {Object} data - Certificate data
   * @param {string} data.customerName - Customer's full name (PRIVATE - not displayed)
   * @param {string} data.productName - Product name
   * @param {string} data.authenticityId - Unique authenticity ID
   * @param {string} data.serialNumber - Serial number
   * @param {Date} data.purchaseDate - Purchase date
   * @returns {string} Cloudinary URL with text overlays
   */
  generateCertificateUrl(data) {
    try {
      const {
        customerName = 'Customer Name', // NOT USED - kept for compatibility
        productName = 'Mavire Product',
        authenticityId = 'AUTH-000000',
        serialNumber = 'SN-000000',
        purchaseDate = new Date()
      } = data;

      // Format the purchase date
      const formattedDate = this.formatDate(purchaseDate);

      // Create text overlays with proper positioning
      // NOTE: Customer name is NOT included to protect privacy
      const overlays = [
        // Product Name - Center top area
        `l_text:Amiri_24:${this.encodeText(productName)},co_black,g_center,y_370`,
        
        // Authenticity ID - Center main area (where customer name was)
        `l_text:Amiri_20:${this.encodeText(authenticityId)},co_black,g_center,y_470`,
        
        // Serial Number - Center below authenticity ID
        `l_text:Amiri_18:${this.encodeText(serialNumber)},co_black,g_center,y_440`,
        
        // Date - Bottom left area
        `l_text:Amiri_14:${this.encodeText(formattedDate)},co_black,g_south_west,x_50,y_50`,
        
        // Brand name - Bottom right area
        `l_text:Amiri_14:Mavire%20Codoir,co_black,g_south_east,x_50,y_50`
      ];

      // Combine all overlays
      const transformations = overlays.join('/');

      // Build final URL
      const certificateUrl = `${this.baseUrl}/${transformations}/${this.baseImageId}.jpg`;

      console.log('Generated Certificate URL (Privacy Protected):', certificateUrl);
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
      customerName: 'John Doe', // This will NOT appear on certificate
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
      message: 'Privacy-protected certificate generation test completed',
      privacyNote: 'Customer name is NOT displayed on certificate for privacy protection'
    };
  }

  /**
   * Generate multiple certificate variations for testing
   * @returns {Array} Array of test certificates
   */
  generateTestCertificates() {
    const testCases = [
      {
        customerName: 'John Doe', // Private - not shown
        productName: 'Mavire Classic',
        authenticityId: 'AUTH-001',
        serialNumber: 'MV-001'
      },
      {
        customerName: 'Jane Smith', // Private - not shown
        productName: 'Mavire Premium Collection',
        authenticityId: 'AUTH-002',
        serialNumber: 'MV-002'
      },
      {
        customerName: 'Michael Johnson', // Private - not shown
        productName: 'Mavire Limited Edition',
        authenticityId: 'AUTH-003',
        serialNumber: 'MV-003'
      }
    ];

    return testCases.map((testData, index) => ({
      testCase: index + 1,
      data: testData,
      certificateUrl: this.generateCertificateUrl(testData),
      privacyNote: 'Customer name kept private - not displayed on certificate'
    }));
  }

  /**
   * Generate a private customer certificate with name (for internal use only)
   * This method includes customer name and should only be used for private records
   * @param {Object} data - Certificate data
   * @returns {string} Cloudinary URL with customer name (for private use)
   */
  generatePrivateCertificateUrl(data) {
    try {
      const {
        customerName = 'Customer Name',
        productName = 'Mavire Product',
        authenticityId = 'AUTH-000000',
        serialNumber = 'SN-000000',
        purchaseDate = new Date()
      } = data;

      const formattedDate = this.formatDate(purchaseDate);

      // This version INCLUDES customer name - for internal use only
      const overlays = [
        // Customer Name - Private version only
        `l_text:Amiri_30:${this.encodeText(customerName)},co_black,g_center,y_390`,
        `l_text:Amiri_20:${this.encodeText(productName)},co_black,g_center,y_320`,
        `l_text:Amiri_16:${this.encodeText(authenticityId)},co_black,g_center,y_450`,
        `l_text:Amiri_14:${this.encodeText(formattedDate)},co_black,g_south_west,x_50,y_50`,
        `l_text:Amiri_14:${this.encodeText(serialNumber)},co_black,g_south_east,x_50,y_50`
      ];

      const transformations = overlays.join('/');
      const certificateUrl = `${this.baseUrl}/${transformations}/${this.baseImageId}.jpg`;

      console.log('Generated PRIVATE Certificate URL (includes customer name):', certificateUrl);
      return certificateUrl;

    } catch (error) {
      console.error('Error generating private certificate URL:', error);
      return `${this.baseUrl}/${this.baseImageId}.jpg`;
    }
  }
}

// Export the class
module.exports = CloudinaryCoAGenerator;