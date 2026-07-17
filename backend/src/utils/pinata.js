import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import { PINATA_API_URL, PINATA_GATEWAY_BASE_URL } from '../constants.js';
import dotenv from 'dotenv';

dotenv.config();

const IPFS_GATEWAYS = [
  `${PINATA_GATEWAY_BASE_URL}/ipfs/`,
  'https://cloudflare-ipfs.com/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/'
];

export const uploadToPinata = async (filePath) => {
  try {
    const apiKey = process.env.PINATA_API_KEY;
    const apiSecret = process.env.PINATA_API_SECRET;

    // console.log('Pinata API Key:', apiKey); // Should match c60213b1e6f1a734c90b
    // console.log('Pinata API Secret:', apiSecret ? '[REDACTED]' : 'MISSING'); // Check if loaded

    if (!apiKey || !apiSecret) {
      throw new Error('Pinata API credentials not set in environment variables');
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    console.log('Uploading file:', filePath, 'Size:', fs.statSync(filePath).size);

    const data = new FormData();
    data.append('file', fs.createReadStream(filePath));
    console.log('FormData headers:', data.getHeaders());

    const response = await axios.post(PINATA_API_URL, data, {
      maxContentLength: Infinity, // Updated to Infinity (no quotes)
      headers: {
        ...data.getHeaders(),
        pinata_api_key: apiKey,
        pinata_secret_api_key: apiSecret
      }
    }).catch(err => {
      console.error('Axios error:', err.response?.data || err.message);
      throw err;
    });

    console.log('Pinata response:', response.data);

    if (response.data && response.data.IpfsHash) {
      console.log(`File uploaded to Pinata. IPFS Hash: ${response.data.IpfsHash}`);
      return response.data.IpfsHash;
    } else {
      console.error('Unexpected Pinata response:', response.data);
      return null;
    }
  } catch (error) {
    console.error('Error in uploadToPinata:', error.message);
    return null;
  }
};

export const retrieveFromIPFS = async (ipfsHash) => {
  if (!ipfsHash?.startsWith('Qm')) {
    throw new Error('Invalid IPFS hash format');
  }

  for (const gateway of IPFS_GATEWAYS) {
    try {
      const url = `${gateway}${ipfsHash}`;
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000
      });

      if (response.status === 200 && response.data) {
        console.log('IPFS Retrieval Successful from:', gateway);
        return response.data;
      }
    } catch (error) {
      console.warn(`IPFS Gateway Failed [${gateway}]:`, error.message);
    }
  }

  throw new Error('All IPFS gateways failed');
};

// Add to pinata.js
export const verifyPinataAuth = async () => {
  try {
    const response = await axios.get(PINATA_AUTH_TEST_URL, {
      headers: {
        'x-pinata-api-key': process.env.PINATA_API_KEY,
        'x-pinata-secret-api-key': process.env.PINATA_API_SECRET
      }
    });
    console.log('Pinata Auth Valid:', response.data);
    return true;
  } catch (error) {
    console.error('Pinata Auth Failed:', error.response?.data || error.message);
    return false;
  }
};

export const uploadBufferToPinata = async (buffer, filename) => {
  try {
    const apiKey = process.env.PINATA_API_KEY;
    const apiSecret = process.env.PINATA_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error('Pinata API credentials not set in environment variables');
    }

    if (!buffer) {
      throw new Error('No buffer provided for upload');
    }

    console.log('Uploading buffer with filename:', filename, 'Size:', buffer.length);

    const data = new FormData();
    data.append('file', buffer, { filename: filename });
    console.log('FormData headers:', data.getHeaders());

    const response = await axios.post(PINATA_API_URL, data, {
      maxContentLength: Infinity,
      headers: {
        ...data.getHeaders(),
        pinata_api_key: apiKey,
        pinata_secret_api_key: apiSecret
      }
    }).catch(err => {
      console.error('Axios error:', err.response?.data || err.message);
      throw err;
    });

    console.log('Pinata response:', response.data);

    if (response.data && response.data.IpfsHash) {
      console.log(`File uploaded to Pinata. IPFS Hash: ${response.data.IpfsHash}`);
      return response.data.IpfsHash;
    } else {
      console.error('Unexpected Pinata response:', response.data);
      throw new Error('Failed to get IPFS hash from Pinata');
    }
  } catch (error) {
    console.error('Error in uploadBufferToPinata:', error.message);
    throw error;
  }
};