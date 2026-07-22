const express = require('express');
const router = express.Router();
const Group = require('../models/Group');

// Helper to extract group id/slug from Facebook URL
function extractGroupIdFromUrl(url) {
  const regex = /facebook\.com\/groups\/([^/?#]+)/;
  const match = url.match(regex);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

// GET all groups
router.get('/', async (req, res) => {
  const groups = await Group.find().sort({ createdAt: -1 });
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

    const group = await Group.create({ name, url, groupId, notes, status });
    res.status(201).json(group);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE group
router.put('/:id', async (req, res) => {
  try {
    const { name, url, notes, status } = req.body;
    const updateData = { name, notes, status };
    if (url) {
      const groupId = extractGroupIdFromUrl(url);
      if (!groupId) {
        return res.status(400).json({ error: 'Invalid Facebook group URL' });
      }
      updateData.url = url;
      updateData.groupId = groupId;
    }

    const group = await Group.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json(group);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE group
router.delete('/:id', async (req, res) => {
  const group = await Group.findByIdAndDelete(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  res.json({ deleted: true });
});

module.exports = router;
