// src/index.js
// import app from './app.js';
// import dotenv from 'dotenv';
// import connectDB from "./db/mongoose.js";
// // import { initializeBlockchain } from './utils/blockchain.js';

// // Load environment variables
// dotenv.config();

// const PORT = process.env.PORT || 3000;

// connectDB()
//   .then(() => {
//     app.listen(PORT, () => {
//       console.log(`Server is running on port ${PORT}`);
//     })
//   })
//   .catch((err) => {
//     console.log("MongoDB connection error", err);

//   })


// src/index.js
import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import dotenv from 'dotenv';
import {
  initializeBlockchain,
  startCertificateConfirmationListener,
  updatePendingCertificates,
  sendEmailsForConfirmedCertificates,
  checkBlockchainStatus,
  cleanupBlockchainResources
} from './utils/blockchain.js';
import connectDB from './db/mongoose.js';

dotenv.config();

// Create HTTP server and Socket.IO instance
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Make io available globally
app.set('io', io);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;

// Set base URL in environment variables if not already set
if (!process.env.APP_BASE_URL) {
  const protocol = process.env.APP_PROTOCOL || 'http';
  const host = process.env.APP_HOST || `localhost:${PORT}`;
  process.env.APP_BASE_URL = `${protocol}://${host}`;
  console.log(`Setting APP_BASE_URL to ${process.env.APP_BASE_URL}`);
}

// Track all intervals for proper cleanup
const intervals = [];

const startServer = async () => {
  try {
    // 1. First connect to MongoDB
    console.log('🔌 Connecting to database...');
    await connectDB();

    // 2. Initialize blockchain connection
    console.log('⛓️ Initializing blockchain...');
    const blockchainInitialized = await initializeBlockchain();

    if (!blockchainInitialized) {
      throw new Error('Failed to initialize blockchain connection');
    }

    // 3. Start certificate status listeners and update pending certificates
    console.log('📡 Starting certificate status listeners...');
    startCertificateConfirmationListener();

    // 4. Update any existing pending certificates
    console.log('🔍 Checking for pending certificates...');
    await updatePendingCertificates();

    // 4.5 Send emails for any confirmed certificates that need them
    console.log('📧 Checking for confirmed certificates needing email notifications...');
    const emailResults = await sendEmailsForConfirmedCertificates();
    console.log(`Email check complete: ${emailResults.sent} emails sent`);

    // 5. Schedule regular checks for pending certificates
    console.log('⏰ Setting up scheduled certificate checks...');

    // Check every 30 seconds for first 10 minutes after startup (quick updates for new certificates)
    let minuteCount = 0;
    const quickInterval = setInterval(async () => {
      try {
        if (minuteCount > 20) { // Extended to 20 checks
          clearInterval(quickInterval);
          console.log('Quick check interval completed');
          return;
        }
        console.log(`Quick check ${minuteCount + 1}/20 for pending certificates...`);
        await updatePendingCertificates(20); // Check 20 most recent
        minuteCount++;
      } catch (err) {
        console.error('Error in quick certificate check:', err);
      }
    }, 30 * 1000); // Every 30 seconds
    intervals.push(quickInterval);

    // Check every 1 minute for ongoing verification and email sending
    const regularInterval = setInterval(async () => {
      try {
        console.log('Running regular certificate verification check...');
        await updatePendingCertificates();

        // Send emails for any confirmed certificates
        await sendEmailsForConfirmedCertificates();
      } catch (err) {
        console.error('Error in regular certificate check:', err);
      }
    }, 60 * 1000); // Every 1 minute
    intervals.push(regularInterval);

    // Add additional error resilience - run a re-initialization check every 5 minutes
    // This ensures system can recover if blockchain connection is temporarily lost
    const healthCheckInterval = setInterval(async () => {
      try {
        // Check blockchain connection and re-initialize if needed
        const status = await checkBlockchainStatus();
        if (!status.connected || !status.initialized) {
          console.log('🔄 Reconnecting to blockchain (scheduled health check)...');
          await initializeBlockchain();
        }
      } catch (err) {
        console.error('Error in blockchain health check:', err);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
    intervals.push(healthCheckInterval);

    // 6. Start server
    const server = httpServer.listen(PORT, () => {
      console.log(`🗄️  Database host: ${process.env.MONGODB_URI?.split('@').pop() || 'localhost'}`);
      console.log(`📡 Blockchain node: ${process.env.PROVIDER_URL}`);
      console.log(`🔌 WebSocket server ready`);
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // CRITICAL: Remove any existing SIGINT handlers to prevent conflicts
    process.removeAllListeners('SIGINT');

    // Cleanup all intervals when process exits
    process.on('SIGINT', () => {
      console.log('⏹️ Shutting down server...');

      // Clear all intervals tracked in this file
      intervals.forEach(interval => clearInterval(interval));
      console.log('📅 Local scheduled tasks stopped');

      // Clean up blockchain resources (intervals, event listeners, etc.)
      cleanupBlockchainResources();
      console.log('⛓️ Blockchain resources cleaned up');

      // Close the server
      server.close(() => {
        console.log('🔌 Server closed');
        process.exit(0);
      });

      // If server doesn't close in 3 seconds, force exit
      setTimeout(() => {
        console.log('⚠️ Forcing server shutdown');
        process.exit(1);
      }, 3000);
    });

  } catch (error) {
    console.error('‼️ Critical startup failure:', error.message);
    process.exit(1);
  }
};

// Start the application
startServer();