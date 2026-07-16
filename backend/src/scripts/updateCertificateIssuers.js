/**
 * updateCertificateIssuers.js
 * ============================
 * 
 * IMPORTANT: DO NOT DELETE THIS FILE - It's a critical database migration utility.
 * 
 * Purpose:
 * This script updates certificates in the database that are missing the "issuer" field.
 * It matches certificates to institution users based on the orgName field and 
 * adds the appropriate user ID as the issuer.
 * 
 * Problem it solves:
 * Older certificates in the database may not have the "issuer" field populated
 * (which should contain the MongoDB ObjectId of the institution user who created 
 * the certificate). Without this field, certain queries like user stats won't work properly.
 * 
 * How it works:
 * 1. Connects to MongoDB using the database connection string
 * 2. Finds all certificates where the "issuer" field doesn't exist
 * 3. Groups these certificates by organization name (orgName)
 * 4. For each organization, it:
 *    - Finds a user with matching name and role "INSTITUTE"
 *    - Updates all certificates for that organization with the user's ID as the "issuer"
 * 5. Logs the process and results for monitoring
 * 
 * When to use it:
 * Run this script as a one-time operation when:
 * - You've added a new field to certificates that needs to be backfilled
 * - You notice missing data in certificates (specifically the issuer field)
 * - After upgrading your application if the data schema has changed
 * 
 * How to run:
 * From project root: node src/scripts/updateCertificateIssuers.js
 */

import mongoose from 'mongoose';
import Certificate from '../models/certificate.model.js';
import User from '../models/user.model.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/verificationDB';

/**
 * This script updates all certificates with a missing issuer field
 * It matches certificates to users based on the orgName field
 */
const updateCertificateIssuers = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB successfully!');

    // Find all certificates with no issuer field
    const certificates = await Certificate.find({ issuer: { $exists: false } });
    console.log(`Found ${certificates.length} certificates without issuer field`);

    if (certificates.length === 0) {
      console.log('No certificates need updating. Exiting...');
      return;
    }

    // Group certificates by orgName for efficient updates
    const certificatesByOrg = {};
    certificates.forEach(cert => {
      const orgName = cert.orgName;
      if (!certificatesByOrg[orgName]) {
        certificatesByOrg[orgName] = [];
      }
      certificatesByOrg[orgName].push(cert);
    });

    console.log(`Certificates grouped by ${Object.keys(certificatesByOrg).length} organizations`);

    // Update certificates for each organization
    for (const orgName of Object.keys(certificatesByOrg)) {
      // Find user with matching name (assuming institutional name matches)
      const user = await User.findOne({
        name: orgName,
        role: 'INSTITUTE'
      });

      if (user) {
        console.log(`Found user for org ${orgName}: ${user._id}`);
        const certsToUpdate = certificatesByOrg[orgName];
        console.log(`Updating ${certsToUpdate.length} certificates for ${orgName}`);

        // Update all certificates for this organization
        for (const cert of certsToUpdate) {
          cert.issuer = user._id;
          await cert.save();
          console.log(`Updated certificate ${cert.certificateId}`);
        }
      } else {
        console.log(`⚠️ No INSTITUTE user found for organization: ${orgName}`);
      }
    }

    console.log('Certificate issuer update completed!');
  } catch (error) {
    console.error('Error updating certificate issuers:', error);
  } finally {
    // Close MongoDB connection
    mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
};

// Run the script
updateCertificateIssuers()
  .then(() => {
    console.log('Script execution completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script execution failed:', error);
    process.exit(1);
  }); 