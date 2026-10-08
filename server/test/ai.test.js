import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Lead } from '../src/models/Lead.js';
import { QualificationSetting } from '../src/models/QualificationSetting.js';
import {
  prepareGroundedSources,
  computeDataHash,
  countWords,
  generateAiSummary,
  generateAiOutreachDraft,
  getAiStatus,
} from '../src/services/aiProvider.js';

const TEST_DB_URI = 'mongodb://127.0.0.1:27017/leadlens_ai_test_isolated';

describe('AI Research Assistant & Safeguards Suite', () => {
  let app;
  let testLead;
  let testSettings;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(TEST_DB_URI);
    await Lead.deleteMany({});
    await QualificationSetting.deleteMany({});

    testSettings = await QualificationSetting.create({
      targetIndustry: 'Cloud Infrastructure',
      targetLocation: 'San Francisco, CA',
      preferredKeywords: ['cloud', 'devops', 'kubernetes'],
    });

    testLead = await Lead.create({
      companyName: 'ScaleGrid Systems',
      website: 'https://scalegrid.io',
      normalizedDomain: 'scalegrid.io',
      industry: 'Cloud Infrastructure',
      industrySource: 'keyword-inference',
      location: 'Austin, TX',
      locationSource: 'structured-data',
      description: 'Fully managed cloud database hosting and automated scaling platform for PostgreSQL and Redis.',
      emails: ['contact@scalegrid.io', 'support@scalegrid.io'],
      phones: ['+1-800-555-0199'],
      score: 85,
      scoreBreakdown: {
        earnedPoints: 85,
        applicablePoints: 100,
        finalScore: 85,
        priorityBand: 'high',
        criteria: [],
      },
      fieldEvidence: [
        {
          field: 'industry',
          sourceUrl: 'https://scalegrid.io',
          method: 'meta-keywords',
          rawValue: 'cloud infrastructure, postgresql hosting',
        },
        {
          field: 'email',
          sourceUrl: 'https://scalegrid.io/contact',
          method: 'mailto-link',
          rawValue: 'contact@scalegrid.io',
        },
      ],
    });

    app = createApp();
  });

  afterAll(async () => {
    await Lead.deleteMany({});
    await QualificationSetting.deleteMany({});
    await mongoose.disconnect();
  });

  describe('1. Grounded Source Extraction & Sanitization', () => {
    it('1.1 Generates stable sequential source IDs (source-1, source-2, ...)', () => {
      const sources = prepareGroundedSources(testLead);
      expect(sources.length).toBeGreaterThan(3);
      expect(sources[0].id).toBe('source-1');
      expect(sources[1].id).toBe('source-2');
      expect(sources.some((s) => s.type === 'website-domain')).toBe(true);
      expect(sources.some((s) => s.type === 'public-emails')).toBe(true);
    });

    it('1.2 Bounds source text and excludes raw executable markup', () => {
      const sources = prepareGroundedSources(testLead);
      for (const s of sources) {
        expect(s.snippet).not.toContain('<script>');
        expect(s.snippet.length).toBeLessThan(500);
      }
    });
  });

  describe('2. Deterministic Hash & Cache Invalidation', () => {
    it('2.1 Computes deterministic SHA-256 hash for identical data', () => {
      const hash1 = computeDataHash({ a: 1, b: 'test' });
      const hash2 = computeDataHash({ a: 1, b: 'test' });
      const hash3 = computeDataHash({ a: 1, b: 'different' });

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });

    it('2.2 Changes hash when company data changes', () => {
      const hashBefore = computeDataHash({
        companyName: testLead.companyName,
        description: testLead.description,
      });
      const hashAfter = computeDataHash({
        companyName: testLead.companyName,
        description: 'New modified company description for testing cache invalidation.',
      });
      expect(hashBefore).not.toBe(hashAfter);
    });
  });

  describe('3. Company Summary AI Generation (Mock Provider)', () => {
    it('3.1 Generates grounded summary within 80 words and structured observations', async () => {
      const res = await generateAiSummary(testLead, { mockClient: true });
      expect(res.enabled).toBe(true);
      expect(res.fromCache).toBe(false);
      expect(res.data).toBeDefined();
      expect(res.data.summaryText).toContain('ScaleGrid Systems');
      expect(countWords(res.data.summaryText)).toBeLessThanOrEqual(80);
      expect(res.data.keyObservations.length).toBeGreaterThan(0);
      expect(res.data.missingInformation.length).toBeGreaterThan(0);
      expect(Array.isArray(res.data.referencedSourceIds)).toBe(true);
    });

    it('3.2 Persists AI summary and reuses cache when input data has not changed', async () => {
      const gen1 = await generateAiSummary(testLead, { mockClient: true });
      testLead.aiResearch = { summary: gen1.data };
      await testLead.save();

      // Second call without forceRegenerate should hit cache
      const gen2 = await generateAiSummary(testLead, { forceRegenerate: false });
      expect(gen2.fromCache).toBe(true);
      expect(gen2.data.summaryText).toBe(gen1.data.summaryText);

      // Call with forceRegenerate should refresh
      const gen3 = await generateAiSummary(testLead, { forceRegenerate: true, mockClient: true });
      expect(gen3.fromCache).toBe(false);
    });
  });

  describe('4. Outreach Draft AI Generation (Mock Provider)', () => {
    it('4.1 Rejects outreach generation when offering description is missing', async () => {
      let err;
      try {
        await generateAiOutreachDraft(testLead, testSettings, { offeringDescription: '' });
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.message).toMatch(/offered|offering/i);
    });

    it('4.2 Generates personalized outreach draft within 120 words with required offering', async () => {
      const offering = 'Automated PostgreSQL backup and failover monitoring suite';
      const sender = 'Alex Rivera';

      const res = await generateAiOutreachDraft(
        testLead,
        testSettings,
        { offeringDescription: offering, senderName: sender },
        { mockClient: true }
      );

      expect(res.enabled).toBe(true);
      expect(res.data.subject).toBeDefined();
      expect(res.data.bodyText).toContain('Alex Rivera');
      expect(res.data.bodyText).toContain(offering);
      expect(countWords(res.data.bodyText)).toBeLessThanOrEqual(120);
      expect(res.data.sourceFactsUsed.length).toBeGreaterThan(0);
    });

    it('4.3 Invalidates outreach cache when user offering changes', async () => {
      const offering1 = 'Service A';
      const offering2 = 'Service B';

      const res1 = await generateAiOutreachDraft(
        testLead,
        testSettings,
        { offeringDescription: offering1 },
        { mockClient: true }
      );

      testLead.aiResearch = testLead.aiResearch || {};
      testLead.aiResearch.outreachDraft = res1.data;
      await testLead.save();

      // Querying with different offering should NOT hit cache
      const res2 = await generateAiOutreachDraft(
        testLead,
        testSettings,
        { offeringDescription: offering2 },
        { mockClient: true, forceRegenerate: false }
      );
      expect(res2.fromCache).toBe(false);
      expect(res2.data.offeringUsed).toBe(offering2);
    });
  });

  describe('5. Safety, Degradation & Deterministic Score Invariance', () => {
    it('5.1 AI research operations never modify deterministic lead qualification score', async () => {
      const originalScore = testLead.score;
      expect(originalScore).toBe(85);

      await generateAiSummary(testLead, { mockClient: true });
      await generateAiOutreachDraft(
        testLead,
        testSettings,
        { offeringDescription: 'Test product' },
        { mockClient: true }
      );

      const refreshedLead = await Lead.findById(testLead._id);
      expect(refreshedLead.score).toBe(85);
    });

    it('5.2 getAiStatus returns clean status object without throwing', () => {
      const status = getAiStatus();
      expect(typeof status.enabled).toBe('boolean');
      expect(typeof status.isConfigured).toBe('boolean');
      expect(typeof status.provider).toBe('string');
      expect(typeof status.model).toBe('string');
    });
  });
});
