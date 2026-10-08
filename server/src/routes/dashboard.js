import express from 'express';
import { Lead } from '../models/Lead.js';
import { CollectionJob } from '../models/CollectionJob.js';
import { QualificationSetting } from '../models/QualificationSetting.js';

const router = express.Router();

router.get('/dashboard', async (req, res, next) => {
  try {
    const [
      totalLeads,
      leadsWithEmail,
      highPriorityLeads,
      leadsMissingContact,
      completedJobs,
      recentJobs,
      topLeads,
      qualificationSetting,
    ] = await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ 'emails.0': { $exists: true } }),
      Lead.countDocuments({ score: { $gte: 75 } }),
      Lead.countDocuments({
        $and: [
          { $or: [{ emails: { $size: 0 } }, { emails: { $exists: false } }] },
          { $or: [{ phones: { $size: 0 } }, { phones: { $exists: false } }] },
        ],
      }),
      CollectionJob.countDocuments({ status: 'completed' }),
      CollectionJob.find().sort({ createdAt: -1 }).limit(5).lean(),
      Lead.find().sort({ score: -1, createdAt: -1 }).limit(6).lean(),
      QualificationSetting.findOne({ isActive: true }).lean(),
    ]);

    const hasConfiguredSettings = Boolean(
      qualificationSetting &&
        (qualificationSetting.targetIndustry || qualificationSetting.targetLocation)
    );

    const latestJob = recentJobs.length > 0 ? recentJobs[0] : null;

    res.json({
      metrics: {
        totalLeads,
        leadsWithEmail,
        highPriorityLeads,
        leadsMissingContact,
        completedJobs,
      },
      hasConfiguredSettings,
      latestJob,
      recentJobs,
      topLeads,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
