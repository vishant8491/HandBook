import express from 'express';
import { z } from 'zod';
import { QualificationSetting } from '../models/QualificationSetting.js';
import { Lead } from '../models/Lead.js';
import { calculateLeadScore } from '../services/scorer.js';
import { validateBody } from '../middleware/validate.js';

const router = express.Router();

const UpdateSettingsSchema = z.object({
  targetIndustry: z.string().optional().default(''),
  targetLocation: z.string().optional().default(''),
  preferredKeywords: z.array(z.string()).optional().default([]),
  weights: z
    .object({
      industry: z.number().min(0).max(100).optional(),
      location: z.number().min(0).max(100).optional(),
      keywords: z.number().min(0).max(100).optional(),
      email: z.number().min(0).max(100).optional(),
      phone: z.number().min(0).max(100).optional(),
      description: z.number().min(0).max(100).optional(),
    })
    .optional(),
});

router.get('/qualification-settings', async (req, res, next) => {
  try {
    let settings = await QualificationSetting.findOne({ isActive: true });
    if (!settings) {
      settings = await QualificationSetting.create({
        targetIndustry: 'SaaS & Enterprise Software',
        targetLocation: 'San Francisco, CA',
        preferredKeywords: ['b2b', 'software', 'platform', 'cloud', 'enterprise', 'ai'],
      });
    }
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

router.put('/qualification-settings', validateBody(UpdateSettingsSchema), async (req, res, next) => {
  try {
    const { targetIndustry, targetLocation, preferredKeywords, weights } = req.body;

    let settings = await QualificationSetting.findOne({ isActive: true });
    if (!settings) {
      settings = new QualificationSetting();
    }

    if (targetIndustry !== undefined) settings.targetIndustry = targetIndustry.trim();
    if (targetLocation !== undefined) settings.targetLocation = targetLocation.trim();
    if (preferredKeywords !== undefined) {
      settings.preferredKeywords = preferredKeywords.map((k) => k.trim()).filter(Boolean);
    }
    if (weights) {
      settings.weights = { ...settings.weights, ...weights };
    }

    await settings.save();

    // Synchronously recalculate scores for all leads in the database
    const leads = await Lead.find({});
    let updatedCount = 0;

    const bulkOps = leads.map((lead) => {
      const scoreResult = calculateLeadScore(lead, settings);
      updatedCount += 1;
      return {
        updateOne: {
          filter: { _id: lead._id },
          update: {
            $set: {
              score: scoreResult.finalScore,
              scoreBreakdown: scoreResult,
            },
          },
        },
      };
    });

    if (bulkOps.length > 0) {
      await Lead.bulkWrite(bulkOps);
    }

    res.json({
      message: `Qualification settings updated and ${updatedCount} leads recalculated.`,
      settings,
      recalculatedLeadsCount: updatedCount,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
