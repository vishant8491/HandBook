import mongoose from 'mongoose';

const PerUrlResultSchema = new mongoose.Schema(
  {
    inputUrl: { type: String, required: true },
    normalizedDomain: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'processing', 'success', 'failed', 'cached', 'skipped'],
      default: 'pending',
    },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
    companyName: { type: String, default: '' },
    errorReason: { type: String, default: '' },
    fromCache: { type: Boolean, default: false },
    durationMs: { type: Number, default: 0 },
  },
  { _id: false }
);

const CollectionJobSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'interrupted', 'failed'],
      default: 'pending',
      index: true,
    },
    mode: {
      type: String,
      enum: ['live', 'fixture'],
      default: 'live',
    },
    inputUrls: {
      type: [String],
      required: true,
    },
    totalCount: {
      type: Number,
      required: true,
    },
    processedCount: {
      type: Number,
      default: 0,
    },
    successfulCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
    results: [PerUrlResultSchema],
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    errorMessage: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export const CollectionJob = mongoose.model('CollectionJob', CollectionJobSchema);
