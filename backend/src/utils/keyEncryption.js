// src/utils/keyEncryption.js
//
// Envelope encryption for institute RSA private keys before they touch
// MongoDB. A DB dump/leak now yields ciphertext, not usable signing keys.
//
// KEY_ENCRYPTION_KEY must be a 32-byte key, base64-encoded, generated with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// Store it in a secrets manager (AWS KMS/Secrets Manager, GCP Secret Manager,
// Vault) — NOT in the same .env file / host as the database credentials.
// Rotate it independently of the DB, and never commit it.

import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:'; // lets us tell already-encrypted values apart from legacy plaintext during migration

function getMasterKey() {
  const raw = process.env.KEY_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'KEY_ENCRYPTION_KEY is not set. Generate one with: ' +
      `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('KEY_ENCRYPTION_KEY must decode to exactly 32 bytes');
  }
  return key;
}

/**
 * Encrypts a PEM private key (or any string secret) for storage.
 * @param {string} plaintext
 * @returns {string} `${PREFIX}<iv>.<authTag>.<ciphertext>` (all base64)
 */
export function encryptSecret(plaintext) {
  if (!plaintext) return plaintext;
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv, tag, encrypted].map((b) => b.toString('base64')).join('.');
}

/**
 * Decrypts a value produced by encryptSecret. If the value doesn't carry
 * the encryption prefix (i.e. it's a legacy plaintext key from before this
 * migration), it's returned as-is so signing keeps working during rollout —
 * run the migration script to re-encrypt those rows, then this fallback
 * can be removed.
 */
export function decryptSecret(stored) {
  if (!stored) return stored;
  if (!stored.startsWith(PREFIX)) {
    return stored; // legacy plaintext, not yet migrated
  }
  const key = getMasterKey();
  const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split('.');
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function isEncrypted(stored) {
  return typeof stored === 'string' && stored.startsWith(PREFIX);
}