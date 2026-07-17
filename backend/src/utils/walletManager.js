// src/utils/walletManager.js
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Wallet Manager - Handles wallet connections for different networks
 * Supports both Ganache (pre-funded accounts) and real networks (mnemonic/private key)
 */
export class WalletManager {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.network = null;
    this.isGanache = false;
  }

  /**
   * Initialize wallet based on network configuration
   */
  async initialize() {
    try {
      const providerURL = process.env.PROVIDER_URL || 'http://localhost:8545';
      const network = process.env.BLOCKCHAIN_NETWORK || 'development';
      
      console.log(`Initializing wallet for network: ${network}`);
      console.log(`Provider URL: ${providerURL}`);
      
      // Create provider
      this.provider = new ethers.JsonRpcProvider(providerURL);
      
      // Get network info
      this.network = await this.provider.getNetwork();
      console.log(`Connected to network: ${this.network.name} (Chain ID: ${this.network.chainId})`);
      
      // Check if Ganache
      this.isGanache = this.network.chainId === 5777n || 
                       this.network.chainId === 1337n ||
                       network === 'development';
      
      if (this.isGanache) {
        await this.initializeGanacheWallet();
      } else {
        await this.initializeProductionWallet();
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize wallet:', error.message);
      throw error;
    }
  }

  /**
   * Initialize wallet for Ganache (uses pre-funded accounts)
   */
  async initializeGanacheWallet() {
    try {
      console.log('Using Ganache pre-funded accounts');
      
      // Get the first account from Ganache
      const accounts = await this.provider.listAccounts();
      
      if (accounts.length === 0) {
        throw new Error('No accounts available in Ganache');
      }
      
      // Use the first account
      const signerAddress = accounts[0].address;
      this.wallet = await this.provider.getSigner(signerAddress);
      
      const balance = await this.provider.getBalance(signerAddress);
      console.log(`Ganache wallet address: ${signerAddress}`);
      console.log(`Ganache wallet balance: ${ethers.formatEther(balance)} ETH`);
      
      return this.wallet;
    } catch (error) {
      console.error('Failed to initialize Ganache wallet:', error.message);
      throw error;
    }
  }

  /**
   * Initialize wallet for production networks (uses mnemonic or private key)
   */
  async initializeProductionWallet() {
    try {
      console.log('Using production wallet (mnemonic/private key)');
      
      // Check for mnemonic first
      if (process.env.MNEMONIC) {
        console.log('Using mnemonic for wallet');
        this.wallet = ethers.Wallet.fromPhrase(
          process.env.MNEMONIC,
          this.provider
        );
      } 
      // Fallback to private key
      else if (process.env.PRIVATE_KEY) {
        console.log('Using private key for wallet');
        this.wallet = new ethers.Wallet(
          process.env.PRIVATE_KEY,
          this.provider
        );
      } 
      else {
        throw new Error(
          'No wallet credentials provided! Set MNEMONIC or PRIVATE_KEY in .env file'
        );
      }
      
      const address = await this.wallet.getAddress();
      const balance = await this.provider.getBalance(address);
      
      console.log(`Wallet address: ${address}`);
      console.log(`Wallet balance: ${ethers.formatEther(balance)} ${this.getNetworkCurrency()}`);
      
      // Warn if balance is low
      if (balance === 0n) {
        console.warn('⚠️  WARNING: Wallet has no funds!');
        console.warn(`Get testnet funds from:`);
        console.warn(`- Sepolia: https://sepoliafaucet.com/`);
        console.warn(`- Mumbai: https://faucet.polygon.technology/`);
      } else if (balance < ethers.parseEther('0.01')) {
        console.warn('⚠️  WARNING: Wallet balance is low! Consider adding more funds.');
      }
      
      return this.wallet;
    } catch (error) {
      console.error('Failed to initialize production wallet:', error.message);
      throw error;
    }
  }

  /**
   * Get wallet address
   */
  async getAddress() {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    return await this.wallet.getAddress();
  }

  /**
   * Get wallet balance
   */
  async getBalance() {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    const address = await this.getAddress();
    return await this.provider.getBalance(address);
  }

  /**
   * Get wallet balance in human-readable format
   */
  async getBalanceFormatted() {
    const balance = await this.getBalance();
    return `${ethers.formatEther(balance)} ${this.getNetworkCurrency()}`;
  }

  /**
   * Sign a transaction
   */
  async signTransaction(tx) {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    return await this.wallet.signTransaction(tx);
  }

  /**
   * Send a transaction
   */
  async sendTransaction(tx) {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    return await this.wallet.sendTransaction(tx);
  }

  /**
   * Get network currency symbol
   */
  getNetworkCurrency() {
    if (!this.network) return 'ETH';
    
    const chainId = Number(this.network.chainId);
    
    switch (chainId) {
      case 137: // Polygon Mainnet
      case 80001: // Mumbai Testnet
        return 'MATIC';
      case 56: // BSC Mainnet
      case 97: // BSC Testnet
        return 'BNB';
      default:
        return 'ETH';
    }
  }

  /**
   * Get network name
   */
  getNetworkName() {
    if (!this.network) return 'Unknown';
    
    const chainId = Number(this.network.chainId);
    
    const networks = {
      1: 'Ethereum Mainnet',
      5: 'Goerli Testnet',
      11155111: 'Sepolia Testnet',
      137: 'Polygon Mainnet',
      80001: 'Mumbai Testnet',
      5777: 'Ganache',
      1337: 'Ganache'
    };
    
    return networks[chainId] || `Unknown (Chain ID: ${chainId})`;
  }

  /**
   * Check if wallet has sufficient balance for transaction
   */
  async hasSufficientBalance(requiredAmount) {
    const balance = await this.getBalance();
    return balance >= requiredAmount;
  }

  /**
   * Get wallet info
   */
  async getWalletInfo() {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    
    const address = await this.getAddress();
    const balance = await this.getBalance();
    
    return {
      address,
      balance: ethers.formatEther(balance),
      balanceWei: balance.toString(),
      network: this.getNetworkName(),
      chainId: Number(this.network.chainId),
      currency: this.getNetworkCurrency(),
      isGanache: this.isGanache
    };
  }
}

/**
 * Singleton instance
 */
let walletManagerInstance = null;

/**
 * Get or create wallet manager instance
 */
export const getWalletManager = async () => {
  if (!walletManagerInstance) {
    walletManagerInstance = new WalletManager();
    await walletManagerInstance.initialize();
  }
  return walletManagerInstance;
};

/**
 * Reset wallet manager (useful for testing)
 */
export const resetWalletManager = () => {
  walletManagerInstance = null;
};

export default WalletManager;
