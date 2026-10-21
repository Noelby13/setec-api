import dotenv from 'dotenv';
dotenv.config();

import { app } from './app';
import { pool } from './db/pool';

const PORT = parseInt(process.env.PORT || '3000', 10);

const server = app.listen(PORT, () => {
  console.log(`🚀 SNEPA-SETEC API Server running on http://localhost:${PORT}`);
  console.log(`📁 Static files serving on http://localhost:${PORT}/uploads`);
  console.log(`🩺 Health check available on http://localhost:${PORT}/api/health`);
});

const gracefulShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      await pool.end();
      console.log('PostgreSQL pool disconnected.');
      process.exit(0);
    } catch (err) {
      console.error('Error during pool disconnection:', err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
