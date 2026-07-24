const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    status: { type: String, enum: ['active', 'paused'], default: 'active' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Offer', offerSchema);
