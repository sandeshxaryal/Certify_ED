// truffle-config.cjs
require('dotenv').config();
const HDWalletProvider = require('@truffle/hdwallet-provider');

module.exports = {
  networks: {
    // Local development with Ganache (Docker or standalone)
    development: {
      host: process.env.GANACHE_HOST || "127.0.0.1",  // Flexible: localhost or "ganache" for Docker
      port: 8545,
      network_id: "*",  // Match any network
      gas: 6721975,
      gasPrice: 20000000000,
    },

    // Sepolia Testnet (Ethereum)
    sepolia: {
      provider: () => new HDWalletProvider({
        mnemonic: {
          phrase: process.env.MNEMONIC
        },
        providerOrUrl: `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
        pollingInterval: 8000
      }),
      network_id: 11155111,
      gas: 5500000,
      gasPrice: 20000000000, // 20 gwei
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
      networkCheckTimeout: 10000
    },

    // Polygon Mumbai Testnet
    mumbai: {
      provider: () => new HDWalletProvider({
        mnemonic: {
          phrase: process.env.MNEMONIC
        },
        providerOrUrl: `https://polygon-mumbai.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        pollingInterval: 8000
      }),
      network_id: 80001,
      gas: 6000000,
      gasPrice: 30000000000, // 30 gwei
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
      networkCheckTimeout: 10000
    },

    // Polygon Mainnet (Production)
    polygon: {
      provider: () => new HDWalletProvider({
        mnemonic: {
          phrase: process.env.MNEMONIC
        },
        providerOrUrl: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        pollingInterval: 8000
      }),
      network_id: 137,
      gas: 6000000,
      gasPrice: 30000000000, // 30 gwei - adjust based on network conditions
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
      networkCheckTimeout: 10000
    },

    // Ethereum Mainnet (Production - High gas costs!)
    mainnet: {
      provider: () => new HDWalletProvider({
        mnemonic: {
          phrase: process.env.MNEMONIC
        },
        providerOrUrl: `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
        pollingInterval: 8000
      }),
      network_id: 1,
      gas: 5500000,
      gasPrice: 20000000000, // 20 gwei - adjust based on network conditions
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: false, // Always dry run on mainnet!
      networkCheckTimeout: 10000
    }
  },

  compilers: {
    solc: {
      version: "0.8.13",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  },

  // Mocha test framework configuration
  mocha: {
    timeout: 100000
  },

  // Configure your compilers
  plugins: []
};