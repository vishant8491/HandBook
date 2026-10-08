import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import healthRoutes from './routes/health.js';
import dashboardRoutes from './routes/dashboard.js';
import collectionJobsRoutes from './routes/collectionJobs.js';
import leadsRoutes from './routes/leads.js';
import qualificationSettingsRoutes from './routes/qualificationSettings.js';
import aiRoutes from './routes/ai.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // CORS configuration
  app.use(
    cors({
      origin: [config.clientOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    })
  );

  // Body parsing with safe size bounds
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // API Routes
  app.use('/api', healthRoutes);
  app.use('/api', dashboardRoutes);
  app.use('/api', collectionJobsRoutes);
  app.use('/api', leadsRoutes);
  app.use('/api', qualificationSettingsRoutes);
  app.use('/api', aiRoutes);

  // 404 handler for unknown API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `API endpoint ${req.method} ${req.originalUrl} does not exist.`,
    });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}
