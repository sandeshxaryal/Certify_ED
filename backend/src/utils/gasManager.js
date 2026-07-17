// src/utils/gasManager.js
import { ethers } from 'ethers';

/**
 * Gas Manager - Handles gas estimation and optimization
 * Works with both Ganache (unlimited gas) and real networks
 */
export class GasManager {
  constructor(provider) {
    this.provider = provider;
    this.isGanache = false;
    this.checkIfGanache();
  }

  /**
   * Detect if we're running on Ganache
   */
  async checkIfGanache() {
    try {
      const network = await this.provider.getNetwork();
      // Ganache typically uses network ID 5777 or 1337
      this.isGanache = network.chainId === 5777n || network.chainId === 1337n;
    } catch (error) {
      console.warn('Could not detect network type:', error.message);
    }
  }

  /**
   * Estimate gas for a transaction with safety buffer
   */
  async estimateGas(transaction) {
    try {
      // If Ganache, use a reasonable default
      if (this.isGanache) {
        return 500000n; // 500k gas is plenty for most operations
      }

      // Estimate gas for real networks
      const gasEstimate = await this.provider.estimateGas(transaction);
      
      // Add 20% buffer for safety
      const bufferedGas = (gasEstimate * 120n) / 100n;
      
      console.log(`Gas estimate: ${gasEstimate.toString()}, with buffer: ${bufferedGas.toString()}`);
      
      return bufferedGas;
    } catch (error) {
      console.error('Gas estimation failed:', error.message);
      // Fallback to a safe default
      return 500000n;
    }
  }

  /**
   * Get current gas price from network
   */
  async getCurrentGasPrice() {
    try {
      const feeData = await this.provider.getFeeData();
      
      return {
        gasPrice: feeData.gasPrice,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
      };
    } catch (error) {
      console.error('Failed to get gas price:', error.message);
      return {
        gasPrice: 20000000000n, // 20 gwei default
        maxFeePerGas: null,
        maxPriorityFeePerGas: null
      };
    }
  }

  /**
   * Get optimal gas price for transaction
   * Handles both legacy and EIP-1559 transactions
   */
  async getOptimalGasPrice() {
    try {
      // If Ganache, use simple gas price
      if (this.isGanache) {
        return {
          gasPrice: 20000000000n // 20 gwei
        };
      }

      const feeData = await this.getCurrentGasPrice();
      
      // For EIP-1559 networks (Polygon, Ethereum post-London)
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        return {
          maxFeePerGas: feeData.maxFeePerGas,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
        };
      }
      
      // For legacy networks
      return {
        gasPrice: feeData.gasPrice || 20000000000n
      };
    } catch (error) {
      console.error('Failed to get optimal gas price:', error.message);
      return {
        gasPrice: 20000000000n // 20 gwei fallback
      };
    }
  }

  /**
   * Calculate transaction cost in ETH/MATIC
   */
  calculateTransactionCost(gasUsed, gasPrice) {
    try {
      const cost = BigInt(gasUsed) * BigInt(gasPrice);
      return ethers.formatEther(cost);
    } catch (error) {
      console.error('Failed to calculate transaction cost:', error.message);
      return '0.0';
    }
  }

  /**
   * Check if wallet has sufficient balance for transaction
   */
  async checkSufficientBalance(walletAddress, estimatedGas, gasPrice) {
    try {
      const balance = await this.provider.getBalance(walletAddress);
      const requiredBalance = BigInt(estimatedGas) * BigInt(gasPrice);
      
      return {
        sufficient: balance >= requiredBalance,
        balance: ethers.formatEther(balance),
        required: ethers.formatEther(requiredBalance),
        balanceWei: balance,
        requiredWei: requiredBalance
      };
    } catch (error) {
      console.error('Failed to check balance:', error.message);
      return {
        sufficient: false,
        balance: '0',
        required: '0',
        error: error.message
      };
    }
  }

  /**
   * Get gas price in human-readable format
   */
  formatGasPrice(gasPrice) {
    try {
      const gwei = ethers.formatUnits(gasPrice, 'gwei');
      return `${parseFloat(gwei).toFixed(2)} gwei`;
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Get recommended gas settings based on network
   */
  async getRecommendedGasSettings(transaction) {
    try {
      const gasLimit = await this.estimateGas(transaction);
      const gasPrice = await this.getOptimalGasPrice();
      
      return {
        gasLimit: gasLimit.toString(),
        ...gasPrice,
        estimatedCost: this.calculateTransactionCost(
          gasLimit,
          gasPrice.gasPrice || gasPrice.maxFeePerGas
        )
      };
    } catch (error) {
      console.error('Failed to get recommended gas settings:', error.message);
      return {
        gasLimit: '500000',
        gasPrice: 20000000000n,
        estimatedCost: '0.01'
      };
    }
  }
}

/**
 * Create a gas manager instance
 */
export const createGasManager = (provider) => {
  return new GasManager(provider);
};

export default GasManager;
