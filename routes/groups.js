const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const { extractGroupIdFromUrl } = require('../utils/extractGroupId');

// GET all groups
router.get('/', async (req, res) => {
  const filter = {};
  if (req.session.role === 'recruiter') {
    filter.owner = req.session.userId;
  } else if (req.query.ownerId) {
    filter.owner = req.query.ownerId;
  }
  let query = Group.find(filter).sort({ createdAt: -1 });
  if (req.session.role === 'owner') {
    query = query.populate('owner', 'name email');
  }
  const groups = await query;
  res.json(groups);
});

// GET single group
router.get('/:id', async (req, res) => {
  const group = await Group.findById(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  res.json(group);
});

// CREATE group
router.post('/', async (req, res) => {
  try {
    const { name, url, notes, status } = req.body;
    if (!name || !url) {
      return res.status(400).json({ error: 'name and url are required' });
    }

    const groupId = extractGroupIdFromUrl(url);
    if (!groupId) {
      return res.status(400).json({ error: 'Invalid Facebook group URL' });
    }

    const group = await Group.create({ owner: req.session.userId, name, url, groupId, notes, status });
    res.status(201).json(group);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE group
router.put('/:id', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.owner.toString() !== req.session.userId && req.session.role !== 'owner') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { name, url, notes, status, accountId } = req.body;
    const updateData = { name, notes, status };
    if (req.body.hasOwnProperty('accountId')) {
      updateData.accountId = accountId || null;
    }
    if (url) {
      const groupId = extractGroupIdFromUrl(url);
      if (!groupId) {
        return res.status(400).json({ error: 'Invalid Facebook group URL' });
      }
      updateData.url = url;
      updateData.groupId = groupId;
    }

    const updated = await Group.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE group
router.delete('/:id', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.owner.toString() !== req.session.userId && req.session.role !== 'owner') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await Group.findByIdAndDelete(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
