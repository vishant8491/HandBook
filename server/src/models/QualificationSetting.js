import mongoose from 'mongoose';

const QualificationSettingSchema = new mongoose.Schema(
  {
    targetIndustry: {
      type: String,
      default: '',
      trim: true,
    },
    targetLocation: {
      type: String,
      default: '',
      trim: true,
    },
    preferredKeywords: {
      type: [String],
      default: ['b2b', 'software', 'platform', 'ai', 'cloud', 'enterprise'],
    },
    weights: {
      industry: { type: Number, default: 30 },
      location: { type: Number, default: 20 },
      keywords: { type: Number, default: 20 },
      email: { type: Number, default: 15 },
      phone: { type: Number, default: 5 },
      description: { type: Number, default: 10 },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const QualificationSetting = mongoose.model(
  'QualificationSetting',
  QualificationSettingSchema
);
