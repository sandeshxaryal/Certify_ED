// src/controllers/health.controller.js
import { checkBlockchainStatus } from '../utils/blockchain.js';
import mongoose from 'mongoose';
import { Certificate } from '../models/certificate.model.js';

export const checkHealth = async (req, res) => {
  try {
    const blockchainStatus = await checkBlockchainStatus();
    const dbStatus = mongoose.connection.readyState === 1;

    // Get database stats
    let dbStats = null;
    if (dbStatus) {
      try {
        const certCount = await Certificate.countDocuments();
        dbStats = {
          certificateCount: certCount,
          databaseName: mongoose.connection.name,
          collections: Object.keys(mongoose.connection.collections)
        };
      } catch (dbError) {
        console.error('Error getting database stats:', dbError);
        dbStats = { error: 'Failed to get database stats' };
      }
    }

    const status = {
      services: {
        blockchain: {
          ...blockchainStatus,
          status: blockchainStatus.connected ? 'OK' : 'DOWN'
        },
        database: {
          status: dbStatus ? 'OK' : 'DOWN',
          host: mongoose.connection.host || 'N/A',
          name: mongoose.connection.name || 'N/A',
          ...dbStats
        }
      },
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version
    };

    const allServicesOK = blockchainStatus.connected && dbStatus;
    res.status(allServicesOK ? 200 : 503).json(status);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      error: 'Health check failed',
      details: error.message
    });
  }
};