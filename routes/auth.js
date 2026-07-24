const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase(), status: 'active' });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    req.session.userId = user._id.toString();
    req.session.role = user.role;
    res.json({ success: true, role: user.role });
  } catch (err) {
    console.error('[Auth Error]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('[Logout Error]', err);
    }
    res.json({ success: true });
  });
});

router.get('/me', async (req, res) => {
  if (req.session && req.session.userId) {
    const user = await User.findById(req.session.userId).select('name email role applySlug').lean();
    if (user) {
      return res.json({ userId: user._id.toString(), role: user.role, name: user.name, applySlug: user.applySlug });
    }
  }
  res.json({ userId: null, role: null, applySlug: null });
});

module.exports = router;
