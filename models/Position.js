const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    salary: { type: String, trim: true, default: '' },
    hours: { type: String, trim: true, default: '' },
    languageRequired: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['active', 'paused'], default: 'active' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Position', positionSchema);
