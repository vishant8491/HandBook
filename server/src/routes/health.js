import express from 'express';
import { isDbConnected } from '../db.js';
import { getActiveJobsCount } from '../services/jobWorker.js';

const router = express.Router();

router.get('/health', (req, res) => {
  const dbStatus = isDbConnected();

  const healthData = {
    status: dbStatus ? 'healthy' : 'degraded',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      connected: dbStatus,
      type: 'MongoDB',
    },
    system: {
      activeCollectionJobs: getActiveJobsCount(),
      nodeVersion: process.version,
      memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    },
  };

  const statusCode = dbStatus ? 200 : 503;
  res.status(statusCode).json(healthData);
});

export default router;
