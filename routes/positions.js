const express = require('express');
const router = express.Router();
const Position = require('../models/Position');

router.get('/', async (req, res) => {
  const filter = {};
  if (req.session.role === 'recruiter') {
    filter.owner = req.session.userId;
  } else if (req.query.ownerId) {
    filter.owner = req.query.ownerId;
  }
  let query = Position.find(filter).sort({ createdAt: -1 });
  if (req.session.role === 'owner') {
    query = query.populate('owner', 'name email');
  }
  const positions = await query;
  res.json(positions);
});

router.get('/:id', async (req, res) => {
  const position = await Position.findById(req.params.id);
  if (!position) return res.status(404).json({ error: 'Position not found' });
  res.json(position);
});

router.post('/', async (req, res) => {
  try {
    const { title, description, salary, hours, languageRequired, status } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'title and description are required' });
    }
    const position = await Position.create({ title, description, salary, hours, languageRequired, status, owner: req.session.userId });
    res.status(201).json(position);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const position = await Position.findById(req.params.id);
    if (!position) return res.status(404).json({ error: 'Position not found' });
    if (position.owner.toString() !== req.session.userId && req.session.role !== 'owner') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { title, description, salary, hours, languageRequired, status } = req.body;
    const updated = await Position.findByIdAndUpdate(
      req.params.id,
      { title, description, salary, hours, languageRequired, status },
      { new: true, runValidators: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const position = await Position.findById(req.params.id);
    if (!position) return res.status(404).json({ error: 'Position not found' });
    if (position.owner.toString() !== req.session.userId && req.session.role !== 'owner') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await Position.findByIdAndDelete(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
