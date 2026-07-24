const express = require('express');
const router = express.Router();
const Candidate = require('../models/Candidate');

router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const role = req.session.role;
    if (role === 'recruiter') {
      filter.recruiter = req.session.userId;
    } else if (req.query.ownerId) {
      filter.recruiter = req.query.ownerId;
    }

    const candidates = await Candidate.find(filter)
      .populate('position', 'title')
      .populate('recruiter', 'name')
      .sort({ createdAt: -1 });
    res.json(candidates);
  } catch (err) {
    console.error('[Candidates] Error listing:', err.message);
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['submitted', 'offer_selected', 'accepted', 'rejected'];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const role = req.session.role;
    if (role === 'recruiter') {
      if (candidate.recruiter.toString() !== req.session.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    candidate.status = status;
    await candidate.save();

    const populated = await Candidate.findById(candidate._id)
      .populate('position', 'title')
      .populate('recruiter', 'name');

    res.json(populated);
  } catch (err) {
    console.error('[Candidates] Error updating status:', err.message);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

module.exports = router;
