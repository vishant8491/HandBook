import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Lead } from '../src/models/Lead.js';
import { CollectionJob } from '../src/models/CollectionJob.js';
import { QualificationSetting } from '../src/models/QualificationSetting.js';
import { calculateLeadScore, computeDataCompleteness } from '../src/services/scorer.js';
import { scrapeAndSaveLead } from '../src/services/scraper.js';
import { processCollectionJob, recoverInterruptedJobs } from '../src/services/jobWorker.js';
import { sanitizeCsvValue, generateLeadsCsv } from '../src/utils/csv.js';
import { sanitizeUrl, normalizeDomain } from '../src/utils/url.js';
import { isPrivateOrReservedIp } from '../src/utils/ssrf.js';

const TEST_DB_URI = 'mongodb://127.0.0.1:27017/leadlens_qa_isolated';

describe('QA Comprehensive Test Suite (Isolated Database)', () => {
  let app;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(TEST_DB_URI);
    // Clear test database collections
    await Lead.deleteMany({});
    await CollectionJob.deleteMany({});
    await QualificationSetting.deleteMany({});

    // Setup initial qualification settings
    await QualificationSetting.create({
      targetIndustry: 'SaaS & Enterprise Software',
      targetLocation: 'San Francisco, CA',
      preferredKeywords: ['b2b', 'cloud', 'software', 'platform', 'ai'],
    });

    app = createApp();
  });

  afterAll(async () => {
    // Clean up test database
    await Lead.deleteMany({});
    await CollectionJob.deleteMany({});
    await QualificationSetting.deleteMany({});
    await mongoose.disconnect();
  });

  describe('Workflow 1: Collection, Normalization & Safeguards', () => {
    it('1.1 Normalizes domains: strips www, lowercases, removes paths and query params', () => {
      expect(normalizeDomain('https://WWW.AlphaCloud.COM/about?ref=product')).toBe('alphacloud.com');
      expect(normalizeDomain('http://sub.domain.org/contact#team')).toBe('sub.domain.org');
      expect(normalizeDomain('   https://saasquatchleads.com/pricing/   ')).toBe('saasquatchleads.com');
      expect(normalizeDomain('invalid_url')).toBe('invalid_url');
    });

    it('1.2 Rejects non-HTTP protocols, embedded credentials, and custom ports', () => {
      expect(sanitizeUrl('ftp://files.example.com')).toBeNull();
      expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
      expect(sanitizeUrl('https://user:pass@company.com')).toBeNull();
      expect(sanitizeUrl('https://company.com:8443')).toBeNull();
      expect(sanitizeUrl('http://valid-site.com')).toBe('http://valid-site.com/');
    });

    it('1.3 Enforces SSRF blocking against private, loopback, and cloud metadata destinations', () => {
      expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('10.0.1.50')).toBe(true);
      expect(isPrivateOrReservedIp('172.16.5.1')).toBe(true);
      expect(isPrivateOrReservedIp('192.168.1.254')).toBe(true);
      expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true); // AWS/GCP metadata
      expect(isPrivateOrReservedIp('::1')).toBe(true); // IPv6 loopback
      expect(isPrivateOrReservedIp('fe80::1')).toBe(true); // IPv6 link-local
      expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false); // Public IP
      expect(isPrivateOrReservedIp('93.184.216.34')).toBe(false);
    });

    it('1.4 Ingests fixture leads, parses JSON-LD, extracts contacts, and saves to isolated DB', async () => {
      const result = await scrapeAndSaveLead('https://acmecloud.example', { isDemo: true });
      expect(result.status).toBe('success');
      expect(result.lead).toBeDefined();
      expect(result.lead.companyName).toBe('Acme Cloud Technologies');
      expect(result.lead.normalizedDomain).toBe('acmecloud.example');
      expect(result.lead.emails).toContain('sales@acmecloud.example');
      expect(result.lead.location).toContain('San Francisco, CA');
      expect(result.lead.industry).toBe('SaaS & Enterprise Software');
      expect(result.lead.score).toBeGreaterThan(70);

      // Verify persistence in MongoDB
      const saved = await Lead.findOne({ normalizedDomain: 'acmecloud.example' });
      expect(saved).not.toBeNull();
      expect(saved.companyName).toBe('Acme Cloud Technologies');
    });

    it('1.5 Deduplication: Repeated scrape of same domain updates without duplicate documents', async () => {
      const initialCount = await Lead.countDocuments();
      // Scrape same domain with forceFresh option
      await scrapeAndSaveLead('https://www.acmecloud.example/contact', { isDemo: true, forceFresh: true });
      const finalCount = await Lead.countDocuments();
      expect(finalCount).toBe(initialCount); // Must remain exactly 1 document
    });

    it('1.6 Freshness Caching: Subsequent request within 24h serves cached lead without re-fetching', async () => {
      const res = await scrapeAndSaveLead('https://acmecloud.example', { isDemo: true });
      expect(res.fromCache).toBe(true);
      expect(res.status).toBe('cached');
    });

    it('1.7 Non-destructive upserts: Preserves existing useful fields during incomplete scrape', async () => {
      // First save lead with phone and description
      const lead = await Lead.findOne({ normalizedDomain: 'acmecloud.example' });
      const originalPhones = lead.phones;

      // Simulate partial update with user metadata
      await scrapeAndSaveLead('https://acmecloud.example', {
        isDemo: true,
        userMetadata: { location: 'San Francisco, CA' },
        forceFresh: true,
      });

      const updated = await Lead.findOne({ normalizedDomain: 'acmecloud.example' });
      expect(updated.phones.length).toBeGreaterThan(0);
      expect(updated.emails.length).toBeGreaterThan(0);
      expect(updated.companyName).toBe('Acme Cloud Technologies');
    });

    it('1.8 Background job worker handles batches with concurrency and survives partial failure', async () => {
      const job = await CollectionJob.create({
        status: 'pending',
        mode: 'fixture',
        inputUrls: [
          'https://medipulse.example',
          'https://novalogistics.example',
          'https://finscale.example',
        ],
        totalCount: 3,
        processedCount: 0,
        successfulCount: 0,
        failedCount: 0,
        results: [
          { inputUrl: 'https://medipulse.example', status: 'pending' },
          { inputUrl: 'https://novalogistics.example', status: 'pending' },
          { inputUrl: 'https://finscale.example', status: 'pending' },
        ],
      });

      await processCollectionJob(job._id);

      const finishedJob = await CollectionJob.findById(job._id);
      expect(finishedJob.status).toBe('completed');
      expect(finishedJob.processedCount).toBe(3);
      expect(finishedJob.successfulCount).toBe(3);
      expect(finishedJob.failedCount).toBe(0);
      expect(finishedJob.results.every((r) => r.status === 'success' || r.status === 'cached')).toBe(true);
    });

    it('1.9 Crash recovery: Interrupted jobs on server restart are marked interrupted', async () => {
      const runningJob = await CollectionJob.create({
        status: 'running',
        mode: 'fixture',
        inputUrls: ['https://unfinished.example'],
        totalCount: 1,
        processedCount: 0,
        results: [{ inputUrl: 'https://unfinished.example', status: 'processing' }],
      });

      await recoverInterruptedJobs();

      const recovered = await CollectionJob.findById(runningJob._id);
      expect(recovered.status).toBe('interrupted');
      expect(recovered.errorMessage).toContain('restarted');
    });
  });

  describe('Workflow 2: Lead Qualification, Scoring & Filtering', () => {
    it('2.1 Deterministic 100-point scoring aligns with target criteria', async () => {
      const settings = await QualificationSetting.findOne({ isActive: true });
      const sampleLead = {
        companyName: 'CloudPlatform Inc',
        description: 'B2B enterprise cloud orchestration software, automated AI pipelines, and modern analytics platform.',
        industry: 'SaaS & Enterprise Software',
        location: 'San Francisco, CA',
        emails: ['contact@cloudplatform.example'],
        phones: ['+1 (415) 555-0199'],
      };

      const scoreResult = calculateLeadScore(sampleLead, settings);
      expect(scoreResult.finalScore).toBe(100);
      expect(scoreResult.priorityBand).toBe('high');
      expect(scoreResult.criteria.length).toBe(6);
    });

    it('2.2 Boundary score tests for Priority Bands (High: 75-100, Med: 40-74, Low: 0-39)', () => {
      const settings = {
        targetIndustry: 'SaaS & Enterprise Software',
        targetLocation: 'San Francisco, CA',
        preferredKeywords: ['b2b', 'cloud'],
        weights: { industry: 30, location: 20, keywords: 20, email: 15, phone: 5, description: 10 },
      };

      // High boundary (>= 75)
      const highLead = {
        companyName: 'High Fit Corp',
        description: 'B2B cloud platform software description for testing.',
        industry: 'SaaS & Enterprise Software', // 30
        location: 'San Francisco, CA', // 20
        emails: ['a@example.com'], // 15
        phones: ['1234567'], // 5
      }; // Earned: 30+20+20(kws)+15+5 = 90 -> High
      expect(calculateLeadScore(highLead, settings).priorityBand).toBe('high');

      // Medium boundary (40-74)
      const medLead = {
        companyName: 'Med Fit Corp',
        description: 'Short text',
        industry: 'Healthcare', // 0
        location: 'San Francisco, CA', // 20
        emails: ['a@example.com'], // 15
        phones: ['1234567'], // 5
      }; // Earned: 20+15+5 = 40 -> Medium
      expect(calculateLeadScore(medLead, settings).finalScore).toBe(40);
      expect(calculateLeadScore(medLead, settings).priorityBand).toBe('medium');

      // Low boundary (< 40)
      const lowLead = {
        companyName: 'Low Fit Corp',
        description: '',
        industry: 'Real Estate', // 0
        location: 'Dallas, TX', // 0
        emails: ['a@example.com'], // 15
        phones: [], // 0
      }; // Earned: 15 -> Low (39 or below)
      expect(calculateLeadScore(lowLead, settings).finalScore).toBe(15);
      expect(calculateLeadScore(lowLead, settings).priorityBand).toBe('low');
    });

    it('2.3 Unconfigured criteria excluded from denominator and normalized', () => {
      const settings = {
        targetIndustry: '', // unconfigured
        targetLocation: '', // unconfigured
        preferredKeywords: [], // unconfigured
        weights: { industry: 30, location: 20, keywords: 20, email: 15, phone: 5, description: 10 },
      };

      const lead = {
        companyName: 'Any Company',
        description: 'Substantive company description with length over 15 characters.',
        emails: ['info@any.example'],
        phones: ['1234567890'],
      };

      const res = calculateLeadScore(lead, settings);
      // Applicable weights: Email(15) + Phone(5) + Desc(10) = 30
      // Earned: 15 + 5 + 10 = 30
      // (30 / 30) * 100 = 100
      expect(res.totalApplicable).toBe(30);
      expect(res.totalEarned).toBe(30);
      expect(res.finalScore).toBe(100);
    });

    it('2.4 Completeness calculation is independent of priority score', () => {
      const fullContact = {
        emails: ['a@example.com'],
        phones: ['1234567'],
        industry: 'SaaS',
        location: 'NY',
        description: 'A full description text.',
      };
      expect(computeDataCompleteness(fullContact).level).toBe('complete');

      const noContact = {
        emails: [],
        phones: [],
        industry: 'SaaS',
        location: 'NY',
      };
      expect(computeDataCompleteness(noContact).level).toBe('firmographic-only');
    });
  });

  describe('Workflow 3: CSV Export & Security Safeguards', () => {
    it('3.1 Neutralizes formula injection / DDE attack payloads in CSV exports', () => {
      expect(sanitizeCsvValue('=cmd|"/c calc"!A0')).toBe('\'=cmd|"/c calc"!A0');
      expect(sanitizeCsvValue('+12345')).toBe('\'+12345');
      expect(sanitizeCsvValue('-SUM(1+1)')).toBe('\'-SUM(1+1)');
      expect(sanitizeCsvValue('@SUM(A1:A10)')).toBe('\'@SUM(A1:A10)');
      expect(sanitizeCsvValue('\t=1+1')).toBe('\'\t=1+1');
      expect(sanitizeCsvValue('Acme Corporation')).toBe('Acme Corporation');
    });

    it('3.2 Generates RFC 4180 compliant quoted CSV with correct headers and data', () => {
      const leads = [
        {
          companyName: '=Malicious Ltd',
          website: 'https://malicious.example',
          industry: 'Fintech',
          location: 'New York, NY',
          emails: ['sec@malicious.example', 'lead@malicious.example'],
          phones: ['+1 (212) 555-0100'],
          score: 85,
          scoreBreakdown: { priorityBand: 'high' },
          outreachStatus: 'shortlisted',
          sourceUrls: ['https://malicious.example'],
          lastScrapedAt: new Date('2026-01-01T12:00:00Z'),
        },
      ];

      const csv = generateLeadsCsv(leads);
      expect(csv).toContain('"Company Name","Website","Industry","Location"');
      expect(csv).toContain("'=Malicious Ltd");
      expect(csv).toContain('"sec@malicious.example; lead@malicious.example"');
      expect(csv).toContain("'+1 (212) 555-0100");
    });
  });
});
