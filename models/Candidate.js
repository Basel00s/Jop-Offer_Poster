const mongoose = require('mongoose');

const GRADUATION_OPTIONS = ['Graduate', 'Undergraduate', 'Gap Year', 'Drop Out'];
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const candidateSchema = new mongoose.Schema(
  {
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    graduation: { type: String, required: true, enum: GRADUATION_OPTIONS },
    experience: { type: String, required: true, trim: true },
    language: { type: String, required: true, trim: true },
    languageLevel: { type: String, required: true, enum: CEFR_LEVELS },
    nationality: { type: String, required: true, trim: true },
    position: { type: mongoose.Schema.Types.ObjectId, ref: 'Position', required: true },
    recordingUrl: { type: String, required: true, trim: true },
    status: { type: String, enum: ['submitted', 'offer_selected', 'accepted', 'rejected'], default: 'submitted' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Candidate', candidateSchema);
module.exports.GRADUATION_OPTIONS = GRADUATION_OPTIONS;
module.exports.CEFR_LEVELS = CEFR_LEVELS;
