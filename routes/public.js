const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Position = require('../models/Position');
const Candidate = require('../models/Candidate');
const { GRADUATION_OPTIONS, CEFR_LEVELS } = require('../models/Candidate');
const { sendNewCandidateNotification } = require('../utils/mailer');

const REQUIRED_FIELDS = [
  'name', 'phone', 'graduation', 'experience',
  'language', 'languageLevel', 'nationality',
  'position', 'recordingUrl',
];

async function resolveRecruiter(slug) {
  const user = await User.findOne({ applySlug: slug, role: 'recruiter', status: 'active' }).select('_id').lean();
  return user;
}

router.get('/offers', async (req, res) => {
  try {
    const offers = await require('../models/Offer').find({ status: 'active' }, '_id title').sort({ createdAt: -1 });
    res.json(offers);
  } catch (err) {
    console.error('[Public] Error fetching offers:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/positions/:slug', async (req, res) => {
  try {
    const recruiter = await resolveRecruiter(req.params.slug);
    if (!recruiter) {
      return res.status(404).json({ error: 'Invalid link' });
    }
    const positions = await Position.find(
      { owner: recruiter._id, status: 'active' },
      '_id title description salary hours languageRequired'
    ).sort({ createdAt: -1 });
    res.json(positions);
  } catch (err) {
    console.error('[Public] Error fetching positions:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/candidates/:slug', async (req, res) => {
  try {
    const recruiter = await resolveRecruiter(req.params.slug);
    if (!recruiter) {
      return res.status(404).json({ error: 'Invalid link' });
    }

    const missing = REQUIRED_FIELDS.filter((f) => !req.body[f] || (typeof req.body[f] === 'string' && !req.body[f].trim()));
    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    if (!GRADUATION_OPTIONS.includes(req.body.graduation)) {
      return res.status(400).json({ error: `Invalid graduation value. Must be one of: ${GRADUATION_OPTIONS.join(', ')}` });
    }

    if (!CEFR_LEVELS.includes(req.body.languageLevel)) {
      return res.status(400).json({ error: `Invalid languageLevel value. Must be one of: ${CEFR_LEVELS.join(', ')}` });
    }

    const position = await Position.findOne({ _id: req.body.position, owner: recruiter._id }).select('title').lean();
    if (!position) {
      return res.status(400).json({ error: 'Invalid position for this recruiter' });
    }

    const candidate = await Candidate.create({
      recruiter: recruiter._id,
      name: req.body.name.trim(),
      phone: req.body.phone.trim(),
      graduation: req.body.graduation,
      experience: req.body.experience.trim(),
      language: req.body.language.trim(),
      languageLevel: req.body.languageLevel,
      nationality: req.body.nationality.trim(),
      position: req.body.position,
      recordingUrl: req.body.recordingUrl.trim(),
    });

    sendNewCandidateNotification(candidate, position.title);

    res.status(201).json({ success: true });
  } catch (err) {
    console.error('[Public] Error creating candidate:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
