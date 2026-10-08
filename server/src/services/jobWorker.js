import { CollectionJob } from '../models/CollectionJob.js';
import { scrapeAndSaveLead } from './scraper.js';
import { config } from '../config.js';
import { normalizeDomain } from '../utils/url.js';

let activeJobsCount = 0;

export async function recoverInterruptedJobs() {
  try {
    const res = await CollectionJob.updateMany(
      { status: 'running' },
      {
        $set: {
          status: 'interrupted',
          errorMessage: 'Server was restarted while collection job was running',
          completedAt: new Date(),
        },
      }
    );
    if (res.modifiedCount > 0) {
      console.log(`[JobWorker] Marked ${res.modifiedCount} interrupted collection job(s).`);
    }
  } catch (err) {
    console.error('[JobWorker] Failed to recover interrupted jobs:', err.message);
  }
}

/**
 * Executes a collection job asynchronously with concurrency control
 */
export async function processCollectionJob(jobId) {
  const job = await CollectionJob.findById(jobId);
  if (!job) return;

  job.status = 'running';
  job.startedAt = new Date();
  await job.save();

  activeJobsCount += 1;

  try {
    const isFixtureMode = job.mode === 'fixture';
    const urls = job.inputUrls;

    // Concurrency pool helper
    const concurrency = Math.max(1, config.scrapeConcurrency || 2);
    let index = 0;

    async function worker() {
      while (index < urls.length) {
        const currentIndex = index++;
        const targetUrl = urls[currentIndex];
        const domain = normalizeDomain(targetUrl);

        // Find correct result item by targetUrl
        let resultIndex = job.results.findIndex((r) => r.inputUrl === targetUrl);
        if (resultIndex === -1) {
          resultIndex = currentIndex;
        }

        // Update item status to processing
        if (job.results[resultIndex]) {
          job.results[resultIndex].status = 'processing';
          job.results[resultIndex].normalizedDomain = domain;
        }

        await CollectionJob.updateOne(
          { _id: job._id, 'results.inputUrl': targetUrl },
          {
            $set: {
              'results.$.status': 'processing',
              'results.$.normalizedDomain': domain,
            },
          }
        );

        try {
          const scrapeResult = await scrapeAndSaveLead(targetUrl, {
            isDemo: isFixtureMode,
          });

          if (job.results[resultIndex]) {
            job.results[resultIndex].status = scrapeResult.fromCache ? 'cached' : 'success';
            job.results[resultIndex].leadId = scrapeResult.lead._id;
            job.results[resultIndex].companyName = scrapeResult.lead.companyName;
            job.results[resultIndex].fromCache = scrapeResult.fromCache;
            job.results[resultIndex].durationMs = scrapeResult.durationMs;
          }
          job.successfulCount += 1;
        } catch (err) {
          if (job.results[resultIndex]) {
            job.results[resultIndex].status = 'failed';
            job.results[resultIndex].errorReason = err.message || 'Scrape failed';
          }
          job.failedCount += 1;
        }

        job.processedCount += 1;

        // Persist progress
        await CollectionJob.updateOne(
          { _id: job._id },
          {
            $set: {
              processedCount: job.processedCount,
              successfulCount: job.successfulCount,
              failedCount: job.failedCount,
              [`results.${resultIndex}`]: job.results[resultIndex],
            },
          }
        );
      }
    }

    // Run parallel workers
    const workers = Array.from({ length: Math.min(concurrency, urls.length) }, () => worker());
    await Promise.all(workers);

    job.status = 'completed';
    job.completedAt = new Date();
    await job.save();
  } catch (err) {
    job.status = 'failed';
    job.errorMessage = err.message || 'Fatal error processing collection job';
    job.completedAt = new Date();
    await job.save();
  } finally {
    activeJobsCount = Math.max(0, activeJobsCount - 1);
  }
}

export function getActiveJobsCount() {
  return activeJobsCount;
}
