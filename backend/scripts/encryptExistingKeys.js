// scripts/encryptExistingKeys.js
//
// One-time migration: encrypts any privateKey values still stored in
// plaintext. Safe to re-run — already-encrypted rows are skipped.
//
// Usage:
//   KEY_ENCRYPTION_KEY=<base64key> node scripts/encryptExistingKeys.js

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../src/models/user.model.js';
import { encryptSecret, isEncrypted } from '../src/utils/keyEncryption.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const users = await User.find({ role: 'INSTITUTE' }).select('+privateKey');
  let migrated = 0;

  for (const user of users) {
    if (!user.privateKey || isEncrypted(user.privateKey)) continue;
    user.privateKey = encryptSecret(user.privateKey);
    await user.save({ validateBeforeSave: false });
    migrated++;
    console.log(`Encrypted privateKey for ${user.email}`);
  }

  console.log(`Done. Migrated ${migrated}/${users.length} institute accounts.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});