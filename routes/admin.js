const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Offer = require('../models/Offer');
const Group = require('../models/Group');
const Account = require('../models/Account');
const Position = require('../models/Position');
const Candidate = require('../models/Candidate');
const PostJob = require('../models/PostJob');

router.get('/recruiters', async (req, res) => {
  try {
    const recruiters = await User.find({ role: 'recruiter' }).sort({ createdAt: -1 }).lean();

    const stats = await Promise.all(
      recruiters.map(async (r) => {
        const [offers, groups, accounts, positions, candidates, postedJobs, failedJobs] =
          await Promise.all([
            Offer.countDocuments({ owner: r._id }),
            Group.countDocuments({ owner: r._id }),
            Account.countDocuments({ owner: r._id }),
            Position.countDocuments({ owner: r._id }),
            Candidate.countDocuments({ recruiter: r._id }),
            PostJob.countDocuments({ owner: r._id, status: 'posted' }),
            PostJob.countDocuments({ owner: r._id, status: 'failed' }),
          ]);
        return {
          _id: r._id,
          name: r.name,
          email: r.email,
          applySlug: r.applySlug,
          status: r.status,
          createdAt: r.createdAt,
          stats: { offers, groups, accounts, positions, candidates, postedJobs, failedJobs },
        };
      })
    );

    res.json(stats);
  } catch (err) {
    console.error('[Admin] Error listing recruiters:', err.message);
    res.status(500).json({ error: 'Failed to list recruiters' });
  }
});

router.post('/recruiters', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const applySlug = await User.generateApplySlug(name);

    const user = await User.create({ name, email, passwordHash, role: 'recruiter', applySlug });
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      applySlug: user.applySlug,
      status: user.status,
      applyLink: `/apply/${user.applySlug}`,
    });
  } catch (err) {
    console.error('[Admin] Error creating recruiter:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/recruiters/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'disabled'].includes(status)) {
      return res.status(400).json({ error: 'status must be active or disabled' });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).select('name email applySlug status');
    if (!user) return res.status(404).json({ error: 'Recruiter not found' });
    res.json(user);
  } catch (err) {
    console.error('[Admin] Error updating recruiter:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
