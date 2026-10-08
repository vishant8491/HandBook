import express from 'express';
import { z } from 'zod';
import { CollectionJob } from '../models/CollectionJob.js';
import { processCollectionJob, getActiveJobsCount } from '../services/jobWorker.js';
import { validateBody } from '../middleware/validate.js';
import { config } from '../config.js';
import { sanitizeUrl, normalizeDomain } from '../utils/url.js';

const router = express.Router();

// In-memory rate limiting tracker for collection endpoint
const rateLimitMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const history = (rateLimitMap.get(ip) || []).filter((time) => now - time < windowMs);

  if (history.length >= config.rateLimitCollectionPerMin) {
    return false;
  }

  history.push(now);
  rateLimitMap.set(ip, history);
  return true;
}

const CreateJobSchema = z.object({
  urls: z
    .array(z.string().min(1))
    .min(1, 'At least 1 URL is required')
    .max(20, 'A maximum of 20 URLs are permitted per collection job'),
  mode: z.enum(['live', 'fixture']).optional().default('live'),
});

router.post('/collection-jobs', validateBody(CreateJobSchema), async (req, res, next) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({
        error: 'Rate Limit Exceeded',
        message: `You have reached the limit of ${config.rateLimitCollectionPerMin} collection requests per minute. Please try again shortly.`,
      });
    }

    if (getActiveJobsCount() >= config.maxActiveJobs) {
      return res.status(429).json({
        error: 'System Busy',
        message: `The server is currently running the maximum allowed concurrent collection jobs (${config.maxActiveJobs}). Please wait for active jobs to complete.`,
      });
    }

    const { urls, mode } = req.body;

    // Deduplicate input URLs by normalized domain
    const seenDomains = new Set();
    const validSanitizedUrls = [];
    const initialResults = [];

    for (const raw of urls) {
      const sanitized = sanitizeUrl(raw);
      const domain = normalizeDomain(raw);

      if (!sanitized || !domain) {
        initialResults.push({
          inputUrl: raw,
          normalizedDomain: domain || 'invalid',
          status: 'skipped',
          errorReason: 'Invalid URL format, protocol, or restricted host',
        });
        continue;
      }

      if (seenDomains.has(domain)) {
        initialResults.push({
          inputUrl: raw,
          normalizedDomain: domain,
          status: 'skipped',
          errorReason: 'Duplicate domain in input batch',
        });
        continue;
      }

      seenDomains.add(domain);
      validSanitizedUrls.push(sanitized);
      initialResults.push({
        inputUrl: sanitized,
        normalizedDomain: domain,
        status: 'pending',
      });
    }

    if (validSanitizedUrls.length === 0) {
      return res.status(400).json({
        error: 'No Valid URLs',
        message: 'None of the provided URLs were valid, non-duplicate public web addresses.',
        results: initialResults,
      });
    }

    const job = await CollectionJob.create({
      status: 'pending',
      mode,
      inputUrls: validSanitizedUrls,
      totalCount: validSanitizedUrls.length,
      processedCount: 0,
      successfulCount: 0,
      failedCount: 0,
      results: initialResults,
    });

    // Launch background worker without blocking HTTP response
    processCollectionJob(job._id).catch((err) => {
      console.error(`[JobWorker] Job ${job._id} processing error:`, err);
    });

    res.status(201).json({
      message: 'Collection job created and queued for processing',
      job,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/collection-jobs', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '10', 10)));
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      CollectionJob.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CollectionJob.countDocuments(),
    ]);

    res.json({
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/collection-jobs/:id', async (req, res, next) => {
  try {
    const job = await CollectionJob.findById(req.params.id).populate('results.leadId');
    if (!job) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Collection job with ID ${req.params.id} was not found`,
      });
    }
    res.json({ job });
  } catch (err) {
    next(err);
  }
});

export default router;
