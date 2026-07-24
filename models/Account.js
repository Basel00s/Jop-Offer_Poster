const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    nickname: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    sessionData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'cooldown', 'checkpoint', 'disabled'],
      default: 'active',
    },
    dailyPostCount: {
      type: Number,
      default: 0,
    },
    dailyPostCap: {
      type: Number,
      default: 40,
    },
    lastUsedAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    cooldownUntil: {
      type: Date,
      default: null,
    },
    dailyCountResetAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Account', accountSchema);
