const express = require('express');
const router = express.Router();
const Offer = require('../models/Offer');

// GET all offers
router.get('/', async (req, res) => {
  const offers = await Offer.find().sort({ createdAt: -1 });
  res.json(offers);
});

// GET single offer
router.get('/:id', async (req, res) => {
  const offer = await Offer.findById(req.params.id);
  if (!offer) return res.status(404).json({ error: 'Offer not found' });
  res.json(offer);
});

// CREATE offer
router.post('/', async (req, res) => {
  try {
    const { title, description, status } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'title and description are required' });
    }
    const offer = await Offer.create({ title, description, status });
    res.status(201).json(offer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE offer (edit text, pause/activate)
router.put('/:id', async (req, res) => {
  try {
    const { title, description, status } = req.body;
    const offer = await Offer.findByIdAndUpdate(
      req.params.id,
      { title, description, status },
      { new: true, runValidators: true }
    );
    if (!offer) return res.status(404).json({ error: 'Offer not found' });
    res.json(offer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// BULK CREATE offers
router.post('/bulk', async (req, res) => {
  try {
    const { offers } = req.body;
    if (!Array.isArray(offers)) {
      return res.status(400).json({ error: 'offers must be an array' });
    }

    const results = { created: 0, failed: 0, failures: [] };

    for (const offerData of offers) {
      try {
        if (!offerData.title || !offerData.description) {
          throw new Error('Missing title or description');
        }
        await Offer.create({
          title: offerData.title.trim(),
          description: offerData.description.trim(),
          status: 'active'
        });
        results.created++;
      } catch (err) {
        results.failed++;
        results.failures.push({
          input: offerData,
          reason: err.message
        });
      }
    }

    res.json(results);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE offer
router.delete('/:id', async (req, res) => {
  const offer = await Offer.findByIdAndDelete(req.params.id);
  if (!offer) return res.status(404).json({ error: 'Offer not found' });
  res.json({ deleted: true });
});

module.exports = router;
