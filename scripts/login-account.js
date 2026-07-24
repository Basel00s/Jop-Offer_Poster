#!/usr/bin/env node
// ============================================================
// Interactive login script for a single Facebook account
// ============================================================
// Usage:
//   JOB_POSTER_EMAIL=owner@example.com JOB_POSTER_PASSWORD=secret \
//   node scripts/login-account.js --nickname "My Account" --apiBase http://localhost:3000
//
// Opens a visible Chromium window, lets you log in to Facebook
// manually, then saves the session back to the API.
// ============================================================

require('dotenv').config();

const { chromium } = require('playwright');
const readline = require('readline');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    args[key] = argv[i + 1];
  }
  return args;
}

const { nickname, apiBase } = parseArgs(process.argv);
const email = process.env.JOB_POSTER_EMAIL;
const password = process.env.JOB_POSTER_PASSWORD;

if (!nickname || !apiBase) {
  console.error('Usage: node scripts/login-account.js --nickname <name> --apiBase <url>');
  console.error('Env vars JOB_POSTER_EMAIL and JOB_POSTER_PASSWORD must also be set.');
  process.exit(1);
}

if (!email || !password) {
  console.error('Missing required environment variables JOB_POSTER_EMAIL and/or JOB_POSTER_PASSWORD.');
  process.exit(1);
}

function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, () => resolve());
  });
}

(async () => {
  let browser;

  try {
    // Step 1: Log in to the API
    console.log(`[1/5] Logging in to ${apiBase} as ${email}...`);
    const loginRes = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!loginRes.ok) {
      const body = await loginRes.json().catch(() => ({}));
      throw new Error(`Login failed (${loginRes.status}): ${body.error || 'unknown error'}`);
    }
    const setCookie = loginRes.headers.get('set-cookie') || '';
    const cookie = setCookie.split(';')[0];
    if (!cookie) throw new Error('No session cookie received');
    console.log('  ✓ Logged in successfully');

    // Step 2: Fetch accounts and find the matching one
    console.log(`[2/5] Looking up account "${nickname}"...`);
    const accountsRes = await fetch(`${apiBase}/api/accounts`, {
      headers: { Cookie: cookie },
    });
    if (!accountsRes.ok) {
      throw new Error(`Failed to fetch accounts (${accountsRes.status})`);
    }
    const accounts = await accountsRes.json();
    const account = accounts.find((a) => a.nickname === nickname);
    if (!account) {
      const available = accounts.map((a) => a.nickname).join(', ') || '(none)';
      throw new Error(`No account with nickname "${nickname}". Available: ${available}`);
    }
    console.log(`  ✓ Found account ${account._id}`);

    // Step 3: Launch browser
    console.log('[3/5] Launching Chromium...');
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Step 4: Navigate to Facebook and wait for manual login
    console.log('[4/5] Navigating to facebook.com...');
    await page.goto('https://www.facebook.com/');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    await askQuestion(rl, '\n  Log in manually, then press Enter here when done: ');
    rl.close();

    // Step 5: Capture session and POST it to the API
    console.log('[5/5] Capturing session and saving to API...');
    const storageState = await context.storageState();

    const sessionRes = await fetch(`${apiBase}/api/accounts/${account._id}/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({ sessionData: storageState }),
    });
    if (!sessionRes.ok) {
      const body = await sessionRes.json().catch(() => ({}));
      throw new Error(`Failed to save session (${sessionRes.status}): ${body.error || 'unknown error'}`);
    }

    console.log('  ✓ Session saved successfully');

    await browser.close();
    browser = null;
    console.log('\nDone. Browser closed.');
  } catch (err) {
    console.error(`\n✗ Error: ${err.message}`);
    if (browser) await browser.close();
    process.exit(1);
  }
})();
