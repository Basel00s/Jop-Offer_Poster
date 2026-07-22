const mongoose = require('mongoose');

const postJobSchema = new mongoose.Schema(
  {
    offer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer',
      required: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
    },
    status: {
      type: String,
      enum: ['queued', 'posted', 'pending_approval', 'failed', 'skipped'],
      default: 'queued',
    },
    resultUrl: {
      type: String,
      default: '',
    },
    error: {
      type: String,
      default: '',
    },
    queuedAt: {
      type: Date,
      default: Date.now,
    },
    postedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PostJob', postJobSchema);
