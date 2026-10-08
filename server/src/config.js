import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/leadlens',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  scrapeTimeoutMs: parseInt(process.env.SCRAPE_TIMEOUT_MS || '8000', 10),
  scrapeConcurrency: parseInt(process.env.SCRAPE_CONCURRENCY || '2', 10),
  cacheTtlHours: parseInt(process.env.CACHE_TTL_HOURS || '24', 10),
  demoMode: process.env.DEMO_MODE === 'true',
  maxActiveJobs: parseInt(process.env.MAX_ACTIVE_JOBS || '3', 10),
  rateLimitCollectionPerMin: parseInt(process.env.RATE_LIMIT_COLLECTION_PER_MIN || '15', 10),
  userAgent: 'LeadLensBot/1.0 (+https://github.com/caprae-capital/leadlens; contact: bot@leadlens.example)',
  maxBodySizeBytes: 2 * 1024 * 1024, // 2MB response cap
  maxRedirects: 3,

  // AI Research Assistant Configuration
  aiProvider: process.env.AI_PROVIDER || 'gemini',
  aiModel: process.env.AI_MODEL || 'gemini-3.8-flash',
  geminiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
  aiTimeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '10000', 10),
  aiEnabled: process.env.AI_ENABLED !== 'false',
};
