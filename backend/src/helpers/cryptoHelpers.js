import crypto from 'crypto';

/**
 * Generates a new cryptographic key pair for digital signatures
 * @returns {Object} Object containing publicKey and privateKey as PEM strings
 */
export const generateKeyPair = () => {
  try {
    console.log('[cryptoUtils] Generating new key pair...');

    // Generate RSA key pair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    console.log('[cryptoUtils] Key pair generated successfully');
    console.log(`[cryptoUtils] Public key (first 40 chars): ${publicKey.substring(0, 40)}...`);
    console.log(`[cryptoUtils] Private key (first 40 chars): ${privateKey.substring(0, 40)}...`);

    return { publicKey, privateKey };
  } catch (error) {
    console.error('[cryptoUtils] Error generating key pair:', error);
    throw new Error('Failed to generate cryptographic keys: ' + error.message);
  }
};

/**
 * Creates a digital signature for data using a private key
 * @param {string} data - The data to sign
 * @param {string} privateKey - The private key in PEM format
 * @returns {string} The digital signature as a base64 string
 */
export const createDigitalSignature = (data, privateKey) => {
  try {
    const sign = crypto.createSign('SHA256');
    sign.update(data);
    sign.end();
    return sign.sign(privateKey, 'base64');
  } catch (error) {
    console.error('Error creating digital signature:', error);
    throw new Error('Failed to create digital signature');
  }
};

/**
 * Verifies a digital signature using the public key
 * @param {string} data - The original data that was signed
 * @param {string} signature - The signature to verify (base64 string)
 * @param {string} publicKey - The public key in PEM format
 * @returns {boolean} True if the signature is valid, false otherwise
 */
export const verifyDigitalSignature = (data, signature, publicKey) => {
  try {
    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    verify.end();
    return verify.verify(publicKey, signature, 'base64');
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
};

/**
 * Creates a hash of data
 * @param {string} data - The data to hash
 * @returns {string} The hash as a hex string
 */
export const createHash = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Generates a wallet-like address from a public key
 * @param {string} publicKey - The public key in PEM format
 * @returns {string} A wallet-like address (0x prefixed hex string)
 */
export const deriveWalletAddress = (publicKey) => {
  try {
    console.log('[cryptoUtils] Deriving wallet address from public key...');

    // Remove PEM headers and convert to a buffer
    const publicKeyBuffer = Buffer.from(
      publicKey
        .replace('-----BEGIN PUBLIC KEY-----', '')
        .replace('-----END PUBLIC KEY-----', '')
        .replace(/\s+/g, ''),
      'base64'
    );

    // Create address by hashing the public key and taking the last 20 bytes (like Ethereum)
    const address = '0x' + crypto
      .createHash('sha256')
      .update(publicKeyBuffer)
      .digest('hex')
      .slice(-40);

    console.log(`[cryptoUtils] Wallet address derived: ${address}`);
    return address;
  } catch (error) {
    console.error('[cryptoUtils] Error deriving wallet address:', error);
    throw new Error('Failed to derive wallet address: ' + error.message);
  }
}; 