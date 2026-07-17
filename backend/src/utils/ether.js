// src/utils/ether.js
import { ethers } from 'ethers';
import axios from 'axios';

const INFURA_KEY = process.env.INFURA_KEY;
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price';

export async function estimateCost(txRequest) {
  // Use the configured provider (Ganache or other network)
  const providerUrl = process.env.PROVIDER_URL || 'http://localhost:8545';
  const provider = new ethers.JsonRpcProvider(providerUrl);

  try {
    // 1. estimate gas (bigint) and fetch EIP-1559 fees (bigint) in parallel
    const [gasLimit, feeData] = await Promise.all([
      provider.estimateGas(txRequest),  // returns bigint
      provider.getFeeData()             // feeData.maxFeePerGas is bigint
    ]);

    const { maxFeePerGas, maxPriorityFeePerGas, gasPrice } = feeData;

    // Use gasPrice for legacy networks (like Ganache) or maxFeePerGas for EIP-1559
    const effectiveGasPrice = maxFeePerGas || gasPrice || 20000000000n; // 20 gwei default

    // 2. compute total fee in wei using native bigint multiplication
    const totalFeeWei = gasLimit * effectiveGasPrice;

    // 3. convert to ETH (formatEther accepts bigint)
    const costEth = parseFloat(ethers.formatEther(totalFeeWei));

    // 4. fetch ETH→INR and compute INR cost (with timeout and fallback)
    let costInr = costEth * 88000; // Fallback rate
    try {
      const { data } = await axios.get(COINGECKO_URL, {
        params: { ids: 'ethereum', vs_currencies: 'inr' },
        timeout: 2000 // 2 second timeout
      });
      const ethInInr = data.ethereum.inr;
      costInr = costEth * ethInInr;
    } catch (err) {
      // Use fallback rate if API fails
      console.log('Using fallback ETH/INR rate');
    }

    return {
      gasLimit: gasLimit.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas?.toString() ?? 'n/a',
      maxFeePerGas: effectiveGasPrice.toString(),
      costEth,
      costInr
    };
  } catch (error) {
    console.error('Gas estimation failed:', error.message);
    // Return reasonable defaults for Ganache
    return {
      gasLimit: '500000',
      maxPriorityFeePerGas: 'n/a',
      maxFeePerGas: '20000000000',
      costEth: 0.01,
      costInr: 880
    };
  }
}
