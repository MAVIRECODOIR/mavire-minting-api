const { ethers } = require('ethers');

class WalletService {
  constructor() {
    this.defaultPath = "m/44'/60'/0'/0/0";
  }

  generateWallet() {
    try {
      const wallet = ethers.Wallet.createRandom();
      
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: wallet.mnemonic.phrase,
        publicKey: wallet.publicKey
      };
    } catch (error) {
      console.error('Error generating wallet:', error);
      throw new Error('Failed to generate wallet');
    }
  }

  generateWalletFromEntropy(customEntropy) {
    try {
      const entropy = ethers.keccak256(ethers.toUtf8Bytes(customEntropy));
      const wallet = new ethers.Wallet(entropy);
      
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: null,
        publicKey: wallet.publicKey
      };
    } catch (error) {
      console.error('Error generating wallet from entropy:', error);
      throw new Error('Failed to generate wallet from entropy');
    }
  }

  isValidAddress(address) {
    try {
      return ethers.isAddress(address);
    } catch (error) {
      return false;
    }
  }

  async getWalletBalance(address, rpcUrl) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const balance = await provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error getting wallet balance:', error);
      return '0.0';
    }
  }

  formatWalletForDisplay(walletData) {
    return {
      address: walletData.address,
      shortAddress: `${walletData.address.slice(0, 6)}...${walletData.address.slice(-4)}`,
      qrCodeData: walletData.address,
      instructions: {
        title: "Your NFT Wallet",
        description: "This wallet contains your Certificate of Authenticity NFT",
        warnings: [
          "Keep your private key secure and never share it",
          "You can import this wallet into MetaMask or other wallet apps",
          "Your NFT Certificate of Authenticity is stored at this address"
        ]
      }
    };
  }

  generateWalletExport(walletData, customerEmail) {
    const exportData = {
      walletInfo: {
        address: walletData.address,
        createdFor: customerEmail,
        createdAt: new Date().toISOString(),
        network: "Polygon",
        purpose: "Mavire Codoir Certificate of Authenticity"
      },
      importInstructions: {
        metamask: [
          "1. Open MetaMask",
          "2. Click 'Import Account'",
          "3. Select 'Private Key'",
          "4. Paste your private key",
          "5. Click 'Import'"
        ],
        trustWallet: [
          "1. Open Trust Wallet",
          "2. Go to Settings",
          "3. Select 'Wallets'",
          "4. Tap '+' to add wallet",
          "5. Choose 'Import Wallet'",
          "6. Enter your recovery phrase or private key"
        ]
      },
      securityNotes: [
        "NEVER share your private key with anyone",
        "Store your private key in a secure location",
        "Consider using a hardware wallet for long-term storage",
        "This wallet was generated specifically for your NFT certificate"
      ]
    };

    return exportData;
  }
}

module.exports = WalletService;