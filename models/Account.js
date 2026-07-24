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
    sessionPath: {
      type: String,
      default: '',
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
  },
  { timestamps: true }
);

module.exports = mongoose.model('Account', accountSchema);
