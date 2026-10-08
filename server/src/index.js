import { createApp } from './app.js';
import { connectDB } from './db.js';
import { config } from './config.js';
import { recoverInterruptedJobs } from './services/jobWorker.js';

async function startServer() {
  try {
    await connectDB();
    await recoverInterruptedJobs();

    const app = createApp();

    const server = app.listen(config.port, () => {
      console.log(`[Server] LeadLens backend running on port ${config.port} (Env: ${process.env.NODE_ENV || 'development'})`);
      console.log(`[Server] Health check: http://localhost:${config.port}/api/health`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
      server.close(() => {
        console.log('[Server] HTTP listener closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('[Server] Fatal startup error:', err.message);
    console.error('\n[Database Error] Please ensure MongoDB is running at', config.mongodbUri);
    process.exit(1);
  }
}

startServer();
