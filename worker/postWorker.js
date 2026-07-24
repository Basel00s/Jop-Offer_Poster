#!/usr/bin/env node
// ============================================================
// Post worker — polls the PostJob queue and posts via Playwright
// ============================================================
// Connects directly to the same MongoDB the main app uses.
// Run with: node postWorker.js
// ============================================================

require('dotenv').config();
const mongoose = require('mongoose');
const { chromium } = require('playwright');

// ── Config ───────────────────────────────────────────────────

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/job-poster';
const MIN_DELAY = parseInt(process.env.MIN_DELAY, 10) || 45;
const MAX_DELAY = parseInt(process.env.MAX_DELAY, 10) || 180;
const COOLDOWN_HOURS = parseInt(process.env.COOLDOWN_HOURS, 10) || 4;

// ── Models (shared with main app) ────────────────────────────

const Account = require('./models/Account');
const Offer = require('./models/Offer');
const Group = require('./models/Group');
const PostJob = require('./models/PostJob');

// ── Helpers ──────────────────────────────────────────────────

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

function isToday(date) {
  if (!date) return false;
  const now = new Date();
  const d = new Date(date);
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function cleanFacebookUrl(url) {
  try {
    const u = new URL(url);
    const storyMatch = u.search.match(/story_fbid=(\d+)/);
    const idMatch = u.search.match(/id=(\d+)/);
    if (storyMatch && idMatch) {
      return `https://www.facebook.com/permalink.php?story_fbid=${storyMatch[1]}&id=${idMatch[1]}`;
    }
    return url.split('__cft__')[0].replace(/[?&]$/, '');
  } catch {
    return url;
  }
}

// ── Account pre-checks ───────────────────────────────────────

async function prepareAccount(account) {
  // Disabled or checkpointed — skip entirely
  if (account.status === 'disabled' || account.status === 'checkpoint') {
    return false;
  }

  // Cooldown — check if cooldownUntil has passed
  if (account.status === 'cooldown') {
    if (account.cooldownUntil && account.cooldownUntil > new Date()) {
      log(`  Account "${account.nickname}" is cooling down until ${account.cooldownUntil.toISOString()} — skipping`);
      return false;
    }
    // Cooldown has expired, reactivate
    log(`  Account "${account.nickname}" cooldown expired — reactivating`);
    account.status = 'active';
    account.cooldownUntil = null;
    await account.save();
  }

  // Lazy daily reset
  if (!isToday(account.dailyCountResetAt)) {
    log(`  Daily reset for "${account.nickname}" (was ${account.dailyCountResetAt || 'never'})`);
    account.dailyPostCount = 0;
    account.dailyCountResetAt = new Date();
    await account.save();
  }

  // Daily cap check
  if (account.dailyPostCount >= account.dailyPostCap) {
    log(`  Account "${account.nickname}" at daily cap (${account.dailyPostCount}/${account.dailyPostCap}) — skipping`);
    return false;
  }

  // Session check
  if (!account.sessionData) {
    log(`  Account "${account.nickname}" has no session data — cannot post`);
    return false;
  }

  return true;
}

// ── Playwright posting ───────────────────────────────────────

async function postToFacebook(account, group, offer) {
  const browser = await chromium.launch({ headless: true });
  let result = { outcome: 'failed', error: '' };

  try {
    const context = await browser.newContext({ storageState: account.sessionData });
    const page = await context.newPage();

    let capturedUrl = null;
    page.on('response', async (response) => {
      if (response.url().includes('graphql') && !capturedUrl) {
        const body = await response.text().catch(() => '');
        if (body.includes('story_create')) {
          const match = body.match(/"url":"(https:\/\/www\.facebook\.com\/permalink\.php[^"]+)"/);
          if (match) capturedUrl = match[1].replace(/\\u0026/g, '&');
        }
      }
    });

    // Navigate to the group
    log(`  Navigating to ${group.url}`);
    await page.goto(group.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // ── Detect checkpoint / captcha ──
    const pageUrl = page.url();
    const pageText = await page.textContent('body').catch(() => '');

    if (
      pageUrl.includes('checkpoint') ||
      pageUrl.includes('captcha') ||
      /confirm.*identity|security.*check|suspicious.*activity/i.test(pageText)
    ) {
      result = { outcome: 'checkpoint', error: 'Facebook checkpoint/captcha detected' };
      await browser.close();
      return result;
    }

    // ── Detect rate-limit / blocked ──
    if (
      /rate.?limit|too many|slow down|try again later|temporarily blocked/i.test(pageText)
    ) {
      result = { outcome: 'rate_limit', error: 'Facebook rate limit detected' };
      await browser.close();
      return result;
    }

    // ── Find and click the post composer ──
    // Facebook group post composers vary, try common selectors
    const composerSelectors = [
      '[aria-label="Write something..."]',
      '[aria-label="Write something to the group..."]',
      '[role="button"]:has-text("Write something")',
      '[data-testid="status-attachment-mentions-input"]',
      '[contenteditable="true"][role="textbox"]',
    ];

    let composer = null;
    for (const sel of composerSelectors) {
      composer = await page.waitForSelector(sel, { timeout: 8000 }).catch(() => null);
      if (composer) break;
    }

    if (!composer) {
      const textLocator = page.locator('[role="button"]').filter({ hasText: "What's on your mind" }).first();
      try {
        await textLocator.waitFor({ timeout: 8000 });
        composer = textLocator;
      } catch {
        composer = null;
      }
    }

    if (!composer) {
      result = { outcome: 'failed', error: 'Could not find post composer on group page' };
      await browser.close();
      return result;
    }

    await composer.click();
    await page.waitForTimeout(2000);

    // ── Type the post content ──
    // Some composers open a modal; find the active text input
    const editorSelectors = [
      '[role="dialog"] [contenteditable="true"][role="textbox"]',
      '[contenteditable="true"][role="textbox"]',
      '[data-testid="status-attachment-mentions-input"]',
    ];

    let editor = null;
    for (const sel of editorSelectors) {
      editor = await page.waitForSelector(sel, { timeout: 8000 }).catch(() => null);
      if (editor) break;
    }

    if (!editor) {
      result = { outcome: 'failed', error: 'Could not find text editor after clicking composer' };
      await browser.close();
      return result;
    }

    // Compose: title line, blank line, then description
    const postText = `${offer.title}\n\n${offer.description}`;
    await editor.click();
    await page.keyboard.type(postText, { delay: 10 });
    await page.waitForTimeout(1500);

    // ── Click the Post button ──
    const postButtonSelectors = [
      '[aria-label="Post"]',
      '[data-testid="react-composer-post-button"]',
      'button:has-text("Post")',
      '[role="dialog"] [aria-label="Post"]',
    ];

    let postButton = null;
    for (const sel of postButtonSelectors) {
      postButton = await page.waitForSelector(sel, { timeout: 8000 }).catch(() => null);
      if (postButton) break;
    }

    if (!postButton) {
      result = { outcome: 'failed', error: 'Could not find Post button' };
      await browser.close();
      return result;
    }

    await postButton.click();
    await page.waitForTimeout(5000);

    // ── Detect post-submission outcome ──
    const afterUrl = page.url();
    const afterText = await page.textContent('body').catch(() => '');

    if (
      /checkpoint|captcha|confirm.*identity|security.*check/i.test(afterText) ||
      afterUrl.includes('checkpoint')
    ) {
      result = { outcome: 'checkpoint', error: 'Checkpoint triggered after posting' };
      await browser.close();
      return result;
    }

    if (/rate.?limit|too many|slow down|try again later|temporarily blocked/i.test(afterText)) {
      result = { outcome: 'rate_limit', error: 'Rate limit triggered after posting' };
      await browser.close();
      return result;
    }

    // Assume success — use GraphQL-intercepted URL if available, else fallback
    let resultUrl;
    if (capturedUrl) {
      resultUrl = cleanFacebookUrl(capturedUrl);
      log(`  Captured post URL via GraphQL: ${resultUrl}`);
    } else {
      resultUrl = group.url;
      log('  Could not capture real post URL via GraphQL — falling back to group URL');
    }
    result = { outcome: 'success', resultUrl };
  } catch (err) {
    log(`  Playwright error: ${err.message}`);
    result = { outcome: 'failed', error: err.message };
  } finally {
    await browser.close();
  }

  return result;
}

// ── Main loop ────────────────────────────────────────────────

async function processNextJob() {
  const job = await PostJob.findOne({ status: 'queued' })
    .sort({ queuedAt: 1 })
    .populate('offer')
    .populate('group')
    .populate('account');

  if (!job) {
    log('No queued jobs found');
    return false;
  }

  log(`Processing job ${job._id}`);
  log(`  Offer: ${job.offer ? job.offer.title : '(missing)'}`);
  log(`  Group: ${job.group ? job.group.name : '(missing)'} (${job.group ? job.group.url : '?'})`);
  log(`  Account: ${job.account ? job.account.nickname : '(missing)'}`);

  // Validate references
  if (!job.offer || !job.group || !job.account) {
    log('  Missing offer, group, or account — marking failed');
    job.status = 'failed';
    job.error = 'Missing referenced offer, group, or account';
    await job.save();
    return true;
  }

  // Account pre-checks
  const ready = await prepareAccount(job.account);
  if (!ready) {
    // If account has no session, fail the job explicitly
    if (!job.account.sessionData) {
      job.status = 'failed';
      job.error = 'no session';
      await job.save();
      log('  Job marked failed: no session');
    }
    return true;
  }

  // Attempt posting
  const result = await postToFacebook(job.account, job.group, job.offer);

  switch (result.outcome) {
    case 'success':
      log('  ✓ Post succeeded');
      job.status = 'posted';
      job.resultUrl = result.resultUrl || '';
      job.postedAt = new Date();
      await job.save();

      job.account.dailyPostCount += 1;
      job.account.lastUsedAt = new Date();
      await job.account.save();
      break;

    case 'checkpoint':
      log('  ✗ Checkpoint detected — disabling account (no auto-recovery)');
      job.status = 'failed';
      job.error = result.error;
      await job.save();

      job.account.status = 'checkpoint';
      await job.account.save();
      break;

    case 'rate_limit':
      log(`  ⚠ Rate limit detected — putting account on ${COOLDOWN_HOURS}h cooldown`);
      job.status = 'failed';
      job.error = result.error;
      await job.save();

      const cooldownUntil = new Date();
      cooldownUntil.setHours(cooldownUntil.getHours() + COOLDOWN_HOURS);
      job.account.status = 'cooldown';
      job.account.cooldownUntil = cooldownUntil;
      await job.account.save();
      break;

    default:
      log(`  ✗ Post failed: ${result.error}`);
      job.status = 'failed';
      job.error = result.error;
      await job.save();
      break;
  }

  return true;
}

async function runLoop() {
  log('Worker started — entering main loop');

  while (true) {
    try {
      const processed = await processNextJob();
      if (!processed) {
        // No queued jobs — wait before checking again
        const idleDelay = randomDelay(MIN_DELAY, MAX_DELAY);
        log(`Queue empty — waiting ${idleDelay}s before next check`);
        await sleep(idleDelay);
      } else {
        // Job processed — wait before next one
        const delay = randomDelay(MIN_DELAY, MAX_DELAY);
        log(`Waiting ${delay}s before next job`);
        await sleep(delay);
      }
    } catch (err) {
      log(`Unexpected error in main loop: ${err.message}`);
      console.error(err);
      // Wait a bit before retrying to avoid tight error loops
      await sleep(30);
    }
  }
}

// ── Entry point ──────────────────────────────────────────────

(async () => {
  log(`Connecting to MongoDB: ${MONGO_URI}`);
  await mongoose.connect(MONGO_URI);
  log('Connected to MongoDB');

  await runLoop();
})();
