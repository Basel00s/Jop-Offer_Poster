const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const Account = require('../models/Account');
const Group = require('../models/Group');

// Ensure sessions directory exists
const SESSIONS_DIR = path.join(__dirname, '..', 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

function toPublicAccount(account) {
  const doc = account.toObject ? account.toObject() : account;
  const { sessionPath, ...publicFields } = doc;
  return publicFields;
}

// GET all accounts
router.get('/', async (req, res) => {
  const accounts = await Account.find().sort({ createdAt: -1 });
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
    const account = await Account.create({ nickname, status, dailyPostCap, notes });
    res.status(201).json(toPublicAccount(account));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE account
router.put('/:id', async (req, res) => {
  try {
    const { nickname, status, dailyPostCap, notes } = req.body;
    const account = await Account.findByIdAndUpdate(
      req.params.id,
      { nickname, status, dailyPostCap, notes },
      { new: true, runValidators: true }
    );
    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json(toPublicAccount(account));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE account
router.delete('/:id', async (req, res) => {
  const account = await Account.findByIdAndDelete(req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  // Also delete associated groups
  await Group.deleteMany({ accountId: req.params.id });
  // Delete session file if it exists
  if (account.sessionPath && fs.existsSync(account.sessionPath)) {
    fs.unlinkSync(account.sessionPath);
  }
  res.json({ deleted: true });
});

// Start Facebook login flow and save session
router.post('/:id/session', async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const sessionPath = path.join(SESSIONS_DIR, `${account._id}.json`);

    // Launch Chromium in headful mode so user can login
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to Facebook
    await page.goto('https://www.facebook.com', { waitUntil: 'networkidle' });

    // Wait for user to login, then we'll just wait a bit and let user press OK? Wait no, how do we know when they're done?
    // Let's add a simple prompt in the console, or wait for user to navigate to their profile or something?
    // Alternatively, just tell the user to login, and when they're done, they can press Ctrl+C? But that would terminate the server.
    // Wait, let's instead wait for the user to navigate to facebook.com/home.php or something, or just add a 5-minute timeout, but that's not good.
    // Let's just add a simple message, and then wait for the browser to be closed by the user!
    console.log(`[Session Setup] Please login to Facebook in the opened browser. When you're done, close the browser.`);

    // Wait for browser to be closed
    await new Promise((resolve) => {
      browser.on('disconnected', resolve);
    });

    // Save storage state
    await context.storageState({ path: sessionPath });
    await browser.close();

    // Update account with session path
    account.sessionPath = sessionPath;
    await account.save();

    res.json({ success: true, message: 'Session saved successfully' });
  } catch (err) {
    console.error('[Session Setup Error]', err);
    res.status(500).json({ error: 'Failed to save session: ' + err.message });
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

// Helper to extract group id/slug from Facebook URL
function extractGroupIdFromUrl(url) {
  const regex = /facebook\.com\/groups\/([^/?#]+)/;
  const match = url.match(regex);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

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

        if (!url.includes('facebook.com/groups/')) {
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
