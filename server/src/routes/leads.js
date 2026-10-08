import express from 'express';
import { z } from 'zod';
import { Lead } from '../models/Lead.js';
import { QualificationSetting } from '../models/QualificationSetting.js';
import { calculateLeadScore } from '../services/scorer.js';
import { generateLeadsCsv } from '../utils/csv.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { generateAiSummary, generateAiOutreachDraft } from '../services/aiProvider.js';

const router = express.Router();

const QueryLeadsSchema = z.object({
  search: z.string().optional().default(''),
  industry: z.string().optional().default(''),
  location: z.string().optional().default(''),
  minScore: z.coerce.number().min(0).max(100).optional(),
  quickFilter: z
    .enum(['all', 'high-priority', 'has-email', 'missing-contact'])
    .optional()
    .default('all'),
  hasEmail: z.enum(['true', 'false', 'all']).optional().default('all'),
  outreachStatus: z
    .enum(['new', 'shortlisted', 'contacted', 'not-relevant', 'all'])
    .optional()
    .default('all'),
  isDemo: z.enum(['true', 'false', 'all']).optional().default('all'),
  sortBy: z
    .enum(['score', 'companyName', 'createdAt', 'lastScrapedAt'])
    .optional()
    .default('score'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
});

function buildLeadFilter(params) {
  const query = {};

  if (params.search && params.search.trim()) {
    const term = params.search.trim();
    query.$or = [
      { companyName: { $regex: term, $options: 'i' } },
      { description: { $regex: term, $options: 'i' } },
      { industry: { $regex: term, $options: 'i' } },
      { location: { $regex: term, $options: 'i' } },
      { normalizedDomain: { $regex: term, $options: 'i' } },
      { emails: { $elemMatch: { $regex: term, $options: 'i' } } },
    ];
  }

  if (params.industry && params.industry.trim() && params.industry !== 'all') {
    query.industry = { $regex: params.industry.trim(), $options: 'i' };
  }

  if (params.location && params.location.trim() && params.location !== 'all') {
    query.location = { $regex: params.location.trim(), $options: 'i' };
  }

  // Quick Filter preset overrides
  if (params.quickFilter === 'high-priority') {
    query.score = { $gte: 75 };
  } else if (params.quickFilter === 'has-email') {
    query['emails.0'] = { $exists: true };
  } else if (params.quickFilter === 'missing-contact') {
    query.$and = [
      { $or: [{ emails: { $size: 0 } }, { emails: { $exists: false } }] },
      { $or: [{ phones: { $size: 0 } }, { phones: { $exists: false } }] },
    ];
  } else {
    // Normal filters
    if (params.minScore !== undefined && !isNaN(params.minScore) && params.minScore > 0) {
      query.score = { $gte: params.minScore };
    }

    if (params.hasEmail === 'true') {
      query['emails.0'] = { $exists: true };
    } else if (params.hasEmail === 'false') {
      query.$or = [{ emails: { $size: 0 } }, { emails: { $exists: false } }];
    }
  }

  if (params.outreachStatus && params.outreachStatus !== 'all') {
    query.outreachStatus = params.outreachStatus;
  }

  if (params.isDemo === 'true') {
    query.isDemo = true;
  } else if (params.isDemo === 'false') {
    query.isDemo = false;
  }

  return query;
}

// GET /api/leads - Paginated list with lean field projection for high performance
router.get('/leads', validateQuery(QueryLeadsSchema), async (req, res, next) => {
  try {
    const params = req.query;
    const filter = buildLeadFilter(params);
    const page = params.page;
    const limit = params.limit;
    const skip = (page - 1) * limit;

    const sortOption = {};
    sortOption[params.sortBy] = params.sortOrder === 'asc' ? 1 : -1;

    // Use lean query and project out heavy fieldEvidence and aiResearch for table listing
    const [leads, total, distinctIndustries, distinctLocations] = await Promise.all([
      Lead.find(filter)
        .select('-fieldEvidence -aiResearch')
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean(),
      Lead.countDocuments(filter),
      Lead.distinct('industry'),
      Lead.distinct('location'),
    ]);

    res.json({
      leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      facets: {
        industries: distinctIndustries.filter((i) => i && i !== 'Unknown'),
        locations: distinctLocations.filter((l) => l && l !== 'Unknown'),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/leads/:id - Full details including field evidence and AI cache
router.get('/leads/:id', async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Lead with ID ${req.params.id} was not found`,
      });
    }
    res.json({ lead });
  } catch (err) {
    next(err);
  }
});

const UpdateLeadSchema = z.object({
  outreachStatus: z.enum(['new', 'shortlisted', 'contacted', 'not-relevant']).optional(),
  companyName: z.string().min(1).optional(),
  industry: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
});

router.patch('/leads/:id', validateBody(UpdateLeadSchema), async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Lead with ID ${req.params.id} was not found`,
      });
    }

    const { outreachStatus, companyName, industry, location, description } = req.body;

    if (outreachStatus) lead.outreachStatus = outreachStatus;
    if (companyName) lead.companyName = companyName;
    if (description !== undefined) lead.description = description;

    let shouldRecalculate = false;

    if (industry !== undefined && industry !== lead.industry) {
      lead.industry = industry;
      lead.industrySource = 'manual';
      lead.fieldEvidence.push({
        field: 'industry',
        sourceUrl: lead.website,
        method: 'user-manual-edit',
        rawValue: industry,
      });
      shouldRecalculate = true;
    }

    if (location !== undefined && location !== lead.location) {
      lead.location = location;
      lead.locationSource = 'manual';
      lead.fieldEvidence.push({
        field: 'location',
        sourceUrl: lead.website,
        method: 'user-manual-edit',
        rawValue: location,
      });
      shouldRecalculate = true;
    }

    if (shouldRecalculate || companyName || description) {
      const settings = (await QualificationSetting.findOne({ isActive: true })) || {};
      const scoreResult = calculateLeadScore(lead, settings);
      lead.score = scoreResult.finalScore;
      lead.scoreBreakdown = scoreResult;
    }

    await lead.save();
    res.json({ message: 'Lead updated successfully', lead });
  } catch (err) {
    next(err);
  }
});

router.delete('/leads/:id', async (req, res, next) => {
  try {
    const result = await Lead.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Lead with ID ${req.params.id} was not found`,
      });
    }
    res.json({ message: 'Lead deleted successfully' });
  } catch (err) {
    next(err);
  }
});

const ExportSchema = z.object({
  leadIds: z.array(z.string()).optional(),
  filters: z.record(z.any()).optional(),
});

router.post('/leads/export', validateBody(ExportSchema), async (req, res, next) => {
  try {
    const { leadIds, filters } = req.body;
    let leadsToExport = [];

    if (Array.isArray(leadIds) && leadIds.length > 0) {
      leadsToExport = await Lead.find({ _id: { $in: leadIds } }).sort({ score: -1 }).lean();
    } else {
      const filter = buildLeadFilter(filters || {});
      leadsToExport = await Lead.find(filter).sort({ score: -1 }).limit(1000).lean();
    }

    const csvContent = generateLeadsCsv(leadsToExport);
    const filename = `leadlens_export_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
});

// AI Assistant Endpoints
const AiSummarySchema = z.object({
  forceRegenerate: z.boolean().optional().default(false),
  mock: z.boolean().optional().default(false),
});

router.post('/leads/:id/ai-summary', validateBody(AiSummarySchema), async (req, res, next) => {
  let targetLead = null;
  try {
    targetLead = await Lead.findById(req.params.id);
    if (!targetLead) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Lead with ID ${req.params.id} was not found`,
      });
    }

    const { forceRegenerate, mock } = req.body;
    const result = await generateAiSummary(targetLead, { forceRegenerate, mockClient: mock });

    if (!result.enabled) {
      return res.status(200).json(result);
    }

    if (result.data && !result.fromCache) {
      targetLead.aiResearch = targetLead.aiResearch || {};
      targetLead.aiResearch.summary = result.data;
      await targetLead.save();
    }

    res.json(result);
  } catch (err) {
    const isAuth = err.message.includes('401') || err.message.includes('403') || err.message.includes('API key') || err.message.includes('API_KEY_INVALID');
    const isQuota = err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED') || err.message.includes('quota');
    const isTimeout = err.message.includes('timed out');

    let userMessage = err.message || 'Failed to generate AI company summary.';
    if (isAuth) {
      userMessage = 'Invalid or expired Gemini API key. Please check your GEMINI_API_KEY in server/.env.';
    } else if (isQuota) {
      userMessage = 'Gemini API quota or rate limit reached. Please try again later or check your API billing limits.';
    } else if (isTimeout) {
      userMessage = 'AI research request timed out. The provider took too long to respond.';
    }

    res.status(502).json({
      error: 'AI Generation Failed',
      message: userMessage,
      existingData: targetLead?.aiResearch?.summary || null,
    });
  }
});

const AiOutreachSchema = z.object({
  offeringDescription: z.string().min(3, 'Offering description must be at least 3 characters'),
  senderName: z.string().optional(),
  forceRegenerate: z.boolean().optional().default(false),
  mock: z.boolean().optional().default(false),
});

router.post('/leads/:id/ai-outreach', validateBody(AiOutreachSchema), async (req, res, next) => {
  let targetLead = null;
  try {
    targetLead = await Lead.findById(req.params.id);
    if (!targetLead) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Lead with ID ${req.params.id} was not found`,
      });
    }

    const settings = (await QualificationSetting.findOne({ isActive: true })) || {};
    const { offeringDescription, senderName, forceRegenerate, mock } = req.body;

    const result = await generateAiOutreachDraft(
      targetLead,
      settings,
      { offeringDescription, senderName },
      { forceRegenerate, mockClient: mock }
    );

    if (!result.enabled) {
      return res.status(200).json(result);
    }

    if (result.data && !result.fromCache) {
      targetLead.aiResearch = targetLead.aiResearch || {};
      targetLead.aiResearch.outreachDraft = result.data;
      await targetLead.save();
    }

    res.json(result);
  } catch (err) {
    const isAuth = err.message.includes('401') || err.message.includes('403') || err.message.includes('API key') || err.message.includes('API_KEY_INVALID');
    const isQuota = err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED') || err.message.includes('quota');
    const isTimeout = err.message.includes('timed out');

    let userMessage = err.message || 'Failed to generate outreach email draft.';
    if (isAuth) {
      userMessage = 'Invalid or expired Gemini API key. Please check your GEMINI_API_KEY in server/.env.';
    } else if (isQuota) {
      userMessage = 'Gemini API quota or rate limit reached. Please try again later or check your API billing limits.';
    } else if (isTimeout) {
      userMessage = 'Outreach drafting request timed out. The provider took too long to respond.';
    }

    res.status(502).json({
      error: 'AI Generation Failed',
      message: userMessage,
      existingData: targetLead?.aiResearch?.outreachDraft || null,
    });
  }
});

export default router;
