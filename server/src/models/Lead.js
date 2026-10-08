import mongoose from 'mongoose';

const FieldEvidenceSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    sourceUrl: { type: String, default: '' },
    method: { type: String, default: 'unknown' },
    rawValue: { type: String, default: '' },
  },
  { _id: false }
);

const ScoreCriterionSchema = new mongoose.Schema(
  {
    criterion: { type: String, required: true },
    earned: { type: Number, required: true },
    applicable: { type: Number, required: true },
    matched: { type: Boolean, default: false },
    reason: { type: String, default: '' },
  },
  { _id: false }
);

const ScoreBreakdownSchema = new mongoose.Schema(
  {
    totalEarned: { type: Number, default: 0 },
    totalApplicable: { type: Number, default: 100 },
    finalScore: { type: Number, default: 0 },
    priorityBand: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'low',
    },
    criteria: [ScoreCriterionSchema],
    recalculatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const AiSummaryCacheSchema = new mongoose.Schema(
  {
    summaryText: { type: String, default: '' },
    keyObservations: { type: [String], default: [] },
    missingInformation: { type: [String], default: [] },
    referencedSourceIds: { type: [String], default: [] },
    generatedAt: { type: Date, default: null },
    provider: { type: String, default: '' },
    model: { type: String, default: '' },
    inputHash: { type: String, default: '' },
    promptVersion: { type: String, default: '' },
  },
  { _id: false }
);

const AiOutreachDraftCacheSchema = new mongoose.Schema(
  {
    subject: { type: String, default: '' },
    bodyText: { type: String, default: '' },
    sourceFactsUsed: { type: [String], default: [] },
    referencedSourceIds: { type: [String], default: [] },
    offeringUsed: { type: String, default: '' },
    senderNameUsed: { type: String, default: '' },
    generatedAt: { type: Date, default: null },
    provider: { type: String, default: '' },
    model: { type: String, default: '' },
    inputHash: { type: String, default: '' },
    promptVersion: { type: String, default: '' },
  },
  { _id: false }
);

const AiResearchSchema = new mongoose.Schema(
  {
    summary: { type: AiSummaryCacheSchema, default: null },
    outreachDraft: { type: AiOutreachDraftCacheSchema, default: null },
  },
  { _id: false }
);

const LeadSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    website: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedDomain: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    emails: {
      type: [String],
      default: [],
    },
    phones: {
      type: [String],
      default: [],
    },
    industry: {
      type: String,
      default: 'Unknown',
      trim: true,
    },
    industrySource: {
      type: String,
      enum: ['manual', 'keyword-inference', 'unknown'],
      default: 'unknown',
    },
    location: {
      type: String,
      default: 'Unknown',
      trim: true,
    },
    locationSource: {
      type: String,
      enum: ['structured-data', 'manual', 'unknown'],
      default: 'unknown',
    },
    sourceUrls: {
      type: [String],
      default: [],
    },
    fieldEvidence: {
      type: [FieldEvidenceSchema],
      default: [],
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },
    scoreBreakdown: {
      type: ScoreBreakdownSchema,
      default: () => ({}),
    },
    aiResearch: {
      type: AiResearchSchema,
      default: () => ({}),
    },
    outreachStatus: {
      type: String,
      enum: ['new', 'shortlisted', 'contacted', 'not-relevant'],
      default: 'new',
      index: true,
    },
    lastScrapedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isDemo: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for query and sorting performance
LeadSchema.index({ score: -1, createdAt: -1 });
LeadSchema.index({
  companyName: 'text',
  description: 'text',
  industry: 'text',
  location: 'text',
});

export const Lead = mongoose.model('Lead', LeadSchema);
