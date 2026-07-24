const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    groupId: { type: String, required: true, trim: true },
    notes: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['active', 'paused'], default: 'active' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Group', groupSchema);
