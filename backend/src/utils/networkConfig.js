// src/utils/networkConfig.js
import dotenv from 'dotenv';

dotenv.config();

/**
 * Network Configuration Helper
 * Provides network-specific settings and utilities
 */

export const NETWORKS = {
  DEVELOPMENT: 'development',
  SEPOLIA: 'sepolia',
  MUMBAI: 'mumbai',
  POLYGON: 'polygon',
  MAINNET: 'mainnet'
};

export const NETWORK_CONFIGS = {
  development: {
    name: 'Ganache Local',
    chainId: 5777,
    rpcUrl: 'http://localhost:8545',
    currency: 'ETH',
    blockExplorer: null,
    isTestnet: true,
    confirmations: 0,
    blockTime: 0, // Instant
    faucet: null
  },
  sepolia: {
    name: 'Sepolia Testnet',
    chainId: 11155111,
    rpcUrl: `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
    currency: 'ETH',
    blockExplorer: 'https://sepolia.etherscan.io',
    isTestnet: true,
    confirmations: 2,
    blockTime: 12, // seconds
    faucet: 'https://sepoliafaucet.com/'
  },
  mumbai: {
    name: 'Polygon Mumbai Testnet',
    chainId: 80001,
    rpcUrl: `https://polygon-mumbai.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    currency: 'MATIC',
    blockExplorer: 'https://mumbai.polygonscan.com',
    isTestnet: true,
    confirmations: 2,
    blockTime: 2, // seconds
    faucet: 'https://faucet.polygon.technology/'
  },
  polygon: {
    name: 'Polygon Mainnet',
    chainId: 137,
    rpcUrl: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    currency: 'MATIC',
    blockExplorer: 'https://polygonscan.com',
    isTestnet: false,
    confirmations: 2,
    blockTime: 2, // seconds
    faucet: null
  },
  mainnet: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
    currency: 'ETH',
    blockExplorer: 'https://etherscan.io',
    isTestnet: false,
    confirmations: 2,
    blockTime: 12, // seconds
    faucet: null
  }
};

/**
 * Get current network configuration
 */
export const getCurrentNetworkConfig = () => {
  const network = process.env.BLOCKCHAIN_NETWORK || 'development';
  const config = NETWORK_CONFIGS[network];
  
  if (!config) {
    throw new Error(`Unknown network: ${network}`);
  }
  
  return {
    ...config,
    network
  };
};

/**
 * Get network by chain ID
 */
export const getNetworkByChainId = (chainId) => {
  const network = Object.entries(NETWORK_CONFIGS).find(
    ([_, config]) => config.chainId === chainId
  );
  
  return network ? network[0] : null;
};

/**
 * Check if current network is testnet
 */
export const isTestnet = () => {
  const config = getCurrentNetworkConfig();
  return config.isTestnet;
};

/**
 * Check if current network is mainnet
 */
export const isMainnet = () => {
  return !isTestnet();
};

/**
 * Get block explorer URL for transaction
 */
export const getTransactionUrl = (txHash) => {
  const config = getCurrentNetworkConfig();
  
  if (!config.blockExplorer) {
    return null;
  }
  
  return `${config.blockExplorer}/tx/${txHash}`;
};

/**
 * Get block explorer URL for address
 */
export const getAddressUrl = (address) => {
  const config = getCurrentNetworkConfig();
  
  if (!config.blockExplorer) {
    return null;
  }
  
  return `${config.blockExplorer}/address/${address}`;
};

/**
 * Get block explorer URL for contract
 */
export const getContractUrl = (address) => {
  return getAddressUrl(address);
};

/**
 * Get faucet URL for current network
 */
export const getFaucetUrl = () => {
  const config = getCurrentNetworkConfig();
  return config.faucet;
};

/**
 * Get recommended gas price for network (in gwei)
 */
export const getRecommendedGasPrice = () => {
  const config = getCurrentNetworkConfig();
  
  const gasPrices = {
    development: 20,
    sepolia: 20,
    mumbai: 30,
    polygon: 30,
    mainnet: 20
  };
  
  return gasPrices[config.network] || 20;
};

/**
 * Get recommended gas limit for certificate operations
 */
export const getRecommendedGasLimit = () => {
  const config = getCurrentNetworkConfig();
  
  const gasLimits = {
    development: 6721975,
    sepolia: 5500000,
    mumbai: 6000000,
    polygon: 6000000,
    mainnet: 5500000
  };
  
  return gasLimits[config.network] || 5000000;
};

/**
 * Validate network configuration
 */
export const validateNetworkConfig = () => {
  const network = process.env.BLOCKCHAIN_NETWORK || 'development';
  const config = NETWORK_CONFIGS[network];
  
  if (!config) {
    return {
      valid: false,
      error: `Unknown network: ${network}`
    };
  }
  
  // Check if required environment variables are set
  const errors = [];
  
  if (network !== 'development') {
    if (!process.env.MNEMONIC && !process.env.PRIVATE_KEY) {
      errors.push('MNEMONIC or PRIVATE_KEY required for non-development networks');
    }
    
    if (network === 'sepolia' || network === 'mainnet') {
      if (!process.env.INFURA_PROJECT_ID) {
        errors.push('INFURA_PROJECT_ID required for Ethereum networks');
      }
    }
    
    if (network === 'mumbai' || network === 'polygon') {
      if (!process.env.ALCHEMY_API_KEY) {
        errors.push('ALCHEMY_API_KEY required for Polygon networks');
      }
    }
  }
  
  if (errors.length > 0) {
    return {
      valid: false,
      errors
    };
  }
  
  return {
    valid: true,
    config
  };
};

/**
 * Get network status message
 */
export const getNetworkStatusMessage = () => {
  const config = getCurrentNetworkConfig();
  const validation = validateNetworkConfig();
  
  if (!validation.valid) {
    return {
      status: 'error',
      message: `Network configuration error: ${validation.errors?.join(', ') || validation.error}`
    };
  }
  
  let message = `Connected to ${config.name}`;
  
  if (config.isTestnet) {
    message += ' (Testnet)';
    if (config.faucet) {
      message += `\nGet testnet funds: ${config.faucet}`;
    }
  } else {
    message += ' (MAINNET - Real funds!)';
  }
  
  return {
    status: 'success',
    message,
    config
  };
};

/**
 * Print network configuration
 */
export const printNetworkConfig = () => {
  const config = getCurrentNetworkConfig();
  const validation = validateNetworkConfig();
  
  console.log('\n========================================');
  console.log('BLOCKCHAIN NETWORK CONFIGURATION');
  console.log('========================================');
  console.log(`Network: ${config.name}`);
  console.log(`Chain ID: ${config.chainId}`);
  console.log(`Currency: ${config.currency}`);
  console.log(`Type: ${config.isTestnet ? 'Testnet' : 'MAINNET'}`);
  console.log(`Block Time: ${config.blockTime}s`);
  console.log(`Confirmations: ${config.confirmations}`);
  
  if (config.blockExplorer) {
    console.log(`Explorer: ${config.blockExplorer}`);
  }
  
  if (config.faucet) {
    console.log(`Faucet: ${config.faucet}`);
  }
  
  console.log('\nConfiguration Status:');
  if (validation.valid) {
    console.log('✅ Valid');
  } else {
    console.log('❌ Invalid');
    if (validation.errors) {
      validation.errors.forEach(error => {
        console.log(`   - ${error}`);
      });
    } else {
      console.log(`   - ${validation.error}`);
    }
  }
  
  console.log('========================================\n');
};

export default {
  NETWORKS,
  NETWORK_CONFIGS,
  getCurrentNetworkConfig,
  getNetworkByChainId,
  isTestnet,
  isMainnet,
  getTransactionUrl,
  getAddressUrl,
  getContractUrl,
  getFaucetUrl,
  getRecommendedGasPrice,
  getRecommendedGasLimit,
  validateNetworkConfig,
  getNetworkStatusMessage,
  printNetworkConfig
};
