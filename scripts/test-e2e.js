#!/usr/bin/env node
// ============================================================
// End-to-end test suite for the job-poster API
// ============================================================
// Run with:  node scripts/test-e2e.js
// while the app is up (docker compose up -d), with OWNER_EMAIL
// and OWNER_PASSWORD set to match your real seeded owner account.
//
// Optional: MONGO_URI (defaults to mongodb://localhost:27017/job-poster)
//           TEST_BASE_URL (defaults to http://localhost:3000)
// ============================================================

require('dotenv').config();

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';

if (!process.env.OWNER_EMAIL || !process.env.OWNER_PASSWORD) {
  console.error('Set OWNER_EMAIL and OWNER_PASSWORD env vars to a valid owner account.');
  process.exit(1);
}

let passed = 0;
let failed = 0;

function ok(label) {
  passed++;
  console.log(`  ✓ ${label}`);
}

function fail(label, err, ctx) {
  failed++;
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`  ✗ ${label} — ${msg}`);
  if (ctx && ctx.status != null) {
    console.log(`    Status: ${ctx.status}`);
  }
  if (ctx && ctx.body != null) {
    console.log(`    Body: ${JSON.stringify(ctx.body)}`);
  }
}

// ── helpers ──────────────────────────────────────────────────

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const cookie = setCookie.split(';')[0]; // "connect.sid=s%3A..."
  const body = await res.json();
  return { res, cookie, body };
}

async function api(method, path, { cookie, body } = {}) {
  const headers = {};
  if (cookie) headers['Cookie'] = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { res, json };
}

function assert(condition, label, ctx) {
  if (condition) {
    ok(label);
  } else {
    fail(label, new Error('assertion failed'), ctx);
  }
}

// ── suite ────────────────────────────────────────────────────

(async () => {
  const ts = Date.now();

  // ==========================================================
  // 1. Owner login: success + wrong-password 401
  // ==========================================================
  console.log('\n1. Owner authentication');

  let ownerCookie;
  try {
    const { res, cookie, body } = await login(process.env.OWNER_EMAIL, process.env.OWNER_PASSWORD);
    assert(res.status === 200 && body.success, 'owner login succeeds');
    ownerCookie = cookie;
  } catch (e) {
    fail('owner login succeeds', e);
  }

  try {
    const { res, body } = await login(process.env.OWNER_EMAIL, 'wrong-password-999');
    assert(res.status === 401, 'wrong password returns 401');
  } catch (e) {
    fail('wrong password returns 401', e);
  }

  // ==========================================================
  // 2. Create two recruiters as owner
  // ==========================================================
  console.log('\n2. Create recruiters');

  let recruiterA, recruiterB;
  try {
    const { res, json } = await api('POST', '/api/admin/recruiters', {
      cookie: ownerCookie,
      body: { name: 'TestA', email: `test-a-${ts}@test.local`, password: 'passA123' },
    });
    assert(res.status === 201, 'create recruiterA');
    recruiterA = json;
  } catch (e) {
    fail('create recruiterA', e);
  }

  try {
    const { res, json } = await api('POST', '/api/admin/recruiters', {
      cookie: ownerCookie,
      body: { name: 'TestB', email: `test-b-${ts}@test.local`, password: 'passB123' },
    });
    assert(res.status === 201, 'create recruiterB');
    recruiterB = json;
  } catch (e) {
    fail('create recruiterB', e);
  }

  // ==========================================================
  // 3. Login as recruiterA
  // ==========================================================
  console.log('\n3. Login as recruiterA');

  let cookieA;
  try {
    const { res, cookie, body } = await login(`test-a-${ts}@test.local`, 'passA123');
    assert(res.status === 200 && body.success, 'recruiterA login');
    cookieA = cookie;
  } catch (e) {
    fail('recruiterA login', e);
  }

  // ==========================================================
  // 4. As A: create Offer, Group, Position
  // ==========================================================
  console.log('\n4. As A: create resources');

  let offerA, groupA, positionA;
  try {
    const { res, json } = await api('POST', '/api/offers', {
      cookie: cookieA,
      body: { title: 'E2E Offer', description: 'Test offer description' },
    });
    const ctx = { status: res.status, body: json };
    assert(res.status === 201, 'create offer', ctx);
    offerA = json;
  } catch (e) {
    fail('create offer', e);
  }

  try {
    const { res, json } = await api('POST', '/api/groups', {
      cookie: cookieA,
      body: { name: 'E2E Group', url: 'https://www.facebook.com/groups/e2etestgroup/' },
    });
    const ctx = { status: res.status, body: json };
    assert(res.status === 201, 'create group', ctx);
    groupA = json;
  } catch (e) {
    fail('create group', e);
  }

  try {
    const { res, json } = await api('POST', '/api/positions', {
      cookie: cookieA,
      body: { title: 'E2E Position', description: 'Test position' },
    });
    const ctx = { status: res.status, body: json };
    assert(res.status === 201, 'create position', ctx);
    positionA = json;
  } catch (e) {
    fail('create position', e);
  }

  // ==========================================================
  // 5. Anonymous: public positions + submit candidate
  // ==========================================================
  console.log('\n5. Anonymous public access');

  try {
    const { res, json } = await api('GET', `/api/public/positions/${recruiterA.applySlug}`);
    assert(res.status === 200, 'GET public positions');
    const found = Array.isArray(json) && json.some((p) => p._id === positionA._id);
    assert(found, 'created position visible publicly');
  } catch (e) {
    fail('public positions check', e);
  }

  try {
    const { res, json } = await api('POST', `/api/public/candidates/${recruiterA.applySlug}`, {
      body: {
        name: 'Jane Doe',
        phone: '+1234567890',
        graduation: 'Graduate',
        experience: '2 years',
        language: 'English',
        languageLevel: 'B2',
        nationality: 'Egyptian',
        position: positionA._id,
        recordingUrl: 'https://example.com/recording.mp4',
      },
    });
    assert(res.status === 201, 'submit candidate publicly');
  } catch (e) {
    fail('submit candidate publicly', e);
  }

  // ==========================================================
  // 6. As A: GET candidates — should be exactly one
  // ==========================================================
  console.log('\n6. As A: list candidates');

  let candidateA;
  try {
    const { res, json } = await api('GET', '/api/candidates', { cookie: cookieA });
    assert(res.status === 200, 'GET candidates 200');
    assert(Array.isArray(json) && json.length === 1, 'exactly one candidate');
    candidateA = json[0];
  } catch (e) {
    fail('list candidates', e);
  }

  // ==========================================================
  // 7. Login as recruiterB
  // ==========================================================
  console.log('\n7. Login as recruiterB');

  let cookieB;
  try {
    const { res, cookie, body } = await login(`test-b-${ts}@test.local`, 'passB123');
    assert(res.status === 200 && body.success, 'recruiterB login');
    cookieB = cookie;
  } catch (e) {
    fail('recruiterB login', e);
  }

  // ==========================================================
  // 8. As B: isolation — all four lists empty
  // ==========================================================
  console.log('\n8. As B: isolation check (empty lists)');

  for (const [label, path] of [
    ['offers', '/api/offers'],
    ['groups', '/api/groups'],
    ['positions', '/api/positions'],
    ['candidates', '/api/candidates'],
  ]) {
    try {
      const { res, json } = await api('GET', path, { cookie: cookieB });
      assert(res.status === 200, `GET ${label} 200`);
      assert(Array.isArray(json) && json.length === 0, `${label} list empty for B`);
    } catch (e) {
      fail(`${label} isolation`, e);
    }
  }

  // ==========================================================
  // 9. As B: PUT + DELETE on A's offer → 403
  // ==========================================================
  console.log('\n9. As B: cannot modify A\'s offer');

  if (offerA) {
    try {
      const { res, json } = await api('PUT', `/api/offers/${offerA._id}`, {
        cookie: cookieB,
        body: { title: 'HACKED' },
      });
      const ctx = { status: res.status, body: json };
      assert(res.status === 403, 'PUT A\'s offer → 403', ctx);
    } catch (e) {
      fail('PUT A\'s offer → 403', e);
    }

    try {
      const { res, json } = await api('DELETE', `/api/offers/${offerA._id}`, { cookie: cookieB });
      const ctx = { status: res.status, body: json };
      assert(res.status === 403, 'DELETE A\'s offer → 403', ctx);
    } catch (e) {
      fail('DELETE A\'s offer → 403', e);
    }
  }

  // ==========================================================
  // 10. As B: PUT candidate status on A's candidate → 403
  // ==========================================================
  console.log('\n10. As B: cannot change A\'s candidate status');

  if (candidateA) {
    try {
      const { res } = await api('PUT', `/api/candidates/${candidateA._id}/status`, {
        cookie: cookieB,
        body: { status: 'accepted' },
      });
      assert(res.status === 403, 'PUT A\'s candidate status → 403');
    } catch (e) {
      fail('PUT A\'s candidate status → 403', e);
    }
  }

  // ==========================================================
  // 11. Owner: GET /api/admin/recruiters → stats
  // ==========================================================
  console.log('\n11. Owner: recruiter stats');

  try {
    const { res, json } = await api('GET', '/api/admin/recruiters', { cookie: ownerCookie });
    assert(res.status === 200, 'GET admin/recruiters 200');
    const statsA = Array.isArray(json) && json.find((r) => r._id === recruiterA._id);
    assert(statsA, 'recruiterA found in list');
    if (statsA) {
      assert(statsA.stats.offers === 1, 'stats.offers === 1');
      assert(statsA.stats.groups === 1, 'stats.groups === 1');
      assert(statsA.stats.positions === 1, 'stats.positions === 1');
      assert(statsA.stats.candidates === 1, 'stats.candidates === 1');
    }
  } catch (e) {
    fail('owner stats check', e);
  }

  // ==========================================================
  // 12. As A: account + post-job + dedup
  // ==========================================================
  console.log('\n12. As A: account, post-job, and dedup');

  let accountA;
  try {
    const { res, json } = await api('POST', '/api/accounts', {
      cookie: cookieA,
      body: { nickname: `e2e-acc-${ts}` },
    });
    assert(res.status === 201, 'create account');
    accountA = json;
  } catch (e) {
    fail('create account', e);
  }

  if (accountA && offerA && groupA) {
    try {
      const { res, json } = await api('POST', '/api/post-jobs', {
        cookie: cookieA,
        body: {
          accountId: accountA._id,
          groupIds: [groupA._id],
          offerIds: [offerA._id],
        },
      });
      const ctx = { status: res.status, body: json };
      assert(res.status === 201, 'POST post-jobs 201', ctx);
      assert(json.created === 1, 'created === 1', ctx);
      assert(json.skipped === 0, 'skipped === 0 (first time)', ctx);
    } catch (e) {
      fail('create post-job', e);
    }

    // verify the queued job via GET
    try {
      const { res, json } = await api('GET', '/api/post-jobs', { cookie: cookieA });
      const ctx = { status: res.status, body: json };
      assert(res.status === 200, 'GET post-jobs 200', ctx);
      const match = Array.isArray(json) && json.find(
        (j) => j.offer === offerA._id && j.group === groupA._id && j.account === accountA._id
      );
      assert(!!match, 'queued job matches ids', ctx);
    } catch (e) {
      fail('verify post-job', e);
    }

    // duplicate → created===0, skipped===1
    try {
      const { res, json } = await api('POST', '/api/post-jobs', {
        cookie: cookieA,
        body: {
          accountId: accountA._id,
          groupIds: [groupA._id],
          offerIds: [offerA._id],
        },
      });
      const ctx = { status: res.status, body: json };
      assert(res.status === 201, 'POST post-jobs (dup) 201', ctx);
      assert(json.created === 0, 'created === 0 (duplicate)', ctx);
      assert(json.skipped === 1, 'skipped === 1 (duplicate)', ctx);
    } catch (e) {
      fail('duplicate post-job', e);
    }
  }

  // ==========================================================
  // 13. As A: PUT candidate status → accepted
  // ==========================================================
  console.log('\n13. As A: update own candidate status');

  if (candidateA) {
    try {
      const { res, json } = await api('PUT', `/api/candidates/${candidateA._id}/status`, {
        cookie: cookieA,
        body: { status: 'accepted' },
      });
      assert(res.status === 200, 'PUT own candidate status 200');
      assert(json.status === 'accepted', 'status updated to accepted');
    } catch (e) {
      fail('PUT own candidate status', e);
    }
  }

  // ==========================================================
  // Teardown: remove all test data from MongoDB
  // ==========================================================
  console.log('\n14. Teardown');

  try {
    const mongoose = require('mongoose');
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/job-poster';
    await mongoose.connect(uri);

    const Offer = require('../models/Offer');
    const Group = require('../models/Group');
    const Position = require('../models/Position');
    const Candidate = require('../models/Candidate');
    const Account = require('../models/Account');
    const PostJob = require('../models/PostJob');
    const User = require('../models/User');

    const recruiterIds = [recruiterA?._id, recruiterB?._id].filter(Boolean);

    if (recruiterIds.length) {
      const offerIds = (await Offer.find({ owner: { $in: recruiterIds } }).select('_id').lean()).map((o) => o._id);

      await Promise.all([
        Offer.deleteMany({ owner: { $in: recruiterIds } }),
        Group.deleteMany({ owner: { $in: recruiterIds } }),
        Position.deleteMany({ owner: { $in: recruiterIds } }),
        Account.deleteMany({ owner: { $in: recruiterIds } }),
        Candidate.deleteMany({ recruiter: { $in: recruiterIds } }),
        PostJob.deleteMany({ owner: { $in: recruiterIds } }),
        PostJob.deleteMany({ offer: { $in: offerIds } }),
        User.deleteMany({ _id: { $in: recruiterIds } }),
      ]);
    }

    await mongoose.disconnect();
    ok('teardown complete');
  } catch (e) {
    fail('teardown', e);
  }

  // ==========================================================
  // Summary
  // ==========================================================
  console.log(`\n${'='.repeat(50)}`);
  console.log(`PASSED: ${passed}  FAILED: ${failed}`);
  console.log('='.repeat(50));
  process.exit(failed > 0 ? 1 : 0);
})();
