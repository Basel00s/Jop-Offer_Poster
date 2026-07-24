const express = require('express');
const router = express.Router();
const fs = require('fs');
const Account = require('../models/Account');
const Group = require('../models/Group');
const { extractGroupIdFromUrl } = require('../utils/extractGroupId');

function toPublicAccount(account) {
  const doc = account.toObject ? account.toObject() : account;
  const { sessionPath, ...publicFields } = doc;
  return { ...publicFields, hasSession: !!sessionPath };
}

// GET all accounts
router.get('/', async (req, res) => {
  const filter = {};
  if (req.session.role === 'recruiter') {
    filter.owner = req.session.userId;
  } else if (req.query.ownerId) {
    filter.owner = req.query.ownerId;
  }
  let query = Account.find(filter).sort({ createdAt: -1 });
  if (req.session.role === 'owner') {
    query = query.populate('owner', 'name email');
  }
  const accounts = await query;
  res.json(accounts.map(toPublicAccount));
});

// GET single account
router.get('/:id', async (req, res) => {
  const account = await Account.findById(req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  res.json(toPublicAccount(account));
});

// CREATE account
router.post('/', async (req, res) => {
  try {
    const { nickname, status, dailyPostCap, notes } = req.body;
    if (!nickname) {
      return res.status(400).json({ error: 'nickname is required' });
    }
    const account = await Account.create({ nickname, status, dailyPostCap, notes, owner: req.session.userId });
    res.status(201).json(toPublicAccount(account));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE account
router.put('/:id', async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    if (account.owner.toString() !== req.session.userId && req.session.role !== 'owner') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { nickname, status, dailyPostCap, notes } = req.body;
    const updated = await Account.findByIdAndUpdate(
      req.params.id,
      { nickname, status, dailyPostCap, notes },
      { new: true, runValidators: true }
    );
    res.json(toPublicAccount(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE account
router.delete('/:id', async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    if (account.owner.toString() !== req.session.userId && req.session.role !== 'owner') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await Account.findByIdAndDelete(req.params.id);
    // Also delete associated groups
    await Group.deleteMany({ accountId: req.params.id });
    // Delete session file if it exists
    if (account.sessionPath && fs.existsSync(account.sessionPath)) {
      fs.unlinkSync(account.sessionPath);
    }
    res.json({ deleted: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ========== GROUPS FOR ACCOUNT ==========
// Get all groups for an account
router.get('/:id/groups', async (req, res) => {
  const account = await Account.findById(req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  const groups = await Group.find({ accountId: req.params.id }).sort({ createdAt: -1 });
  res.json(groups);
});

// Create a single group for an account
router.post('/:id/groups', async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const { name, url, notes, status } = req.body;
    if (!name || !url) {
      return res.status(400).json({ error: 'name and url are required' });
    }

    const groupId = extractGroupIdFromUrl(url);
    if (!groupId) {
      return res.status(400).json({ error: 'Invalid Facebook group URL' });
    }

    const group = await Group.create({ 
      accountId: req.params.id, 
      name, 
      url, 
      groupId, 
      notes, 
      status 
    });
    res.status(201).json(group);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Bulk create groups for an account
router.post('/:id/groups/bulk', async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const { urls } = req.body;
    if (!Array.isArray(urls)) {
      return res.status(400).json({ error: 'urls must be an array' });
    }

    const results = { created: 0, failed: 0, failures: [] };

    for (const rawUrl of urls) {
      try {
        const url = rawUrl.trim();
        if (!url) {
          throw new Error('Empty URL');
        }

        if (!url.includes('facebook.com/groups/') && !url.includes('facebook.com/share/')) {
          throw new Error('Invalid URL');
        }

        const groupId = extractGroupIdFromUrl(url);
        if (!groupId) {
          throw new Error('Invalid URL');
        }

        await Group.create({
          accountId: req.params.id,
          name: groupId,
          url,
          groupId,
          status: 'active'
        });
        results.created++;
      } catch (err) {
        results.failed++;
        results.failures.push({
          input: rawUrl,
          reason: err.message
        });
      }
    }

    res.json(results);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update a group
router.put('/:accountId/groups/:groupId', async (req, res) => {
  try {
    const { name, notes, status } = req.body;
    const group = await Group.findOneAndUpdate(
      { _id: req.params.groupId, accountId: req.params.accountId },
      { name, notes, status },
      { new: true, runValidators: true }
    );
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json(group);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a group from an account
router.delete('/:accountId/groups/:groupId', async (req, res) => {
  const group = await Group.findOneAndDelete({
    _id: req.params.groupId,
    accountId: req.params.accountId
  });
  if (!group) return res.status(404).json({ error: 'Group not found' });
  res.json({ deleted: true });
});

module.exports = router;
