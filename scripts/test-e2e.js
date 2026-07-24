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
    console.log(`    Body: ${JSON.stringify(ctx.body).slice(0, 500)}`);
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
  const cookie = setCookie.split(';')[0];
  const body = await res.json();
  return { res, cookie, body };
}

async function api(method, path, { cookie, body, raw } = {}) {
  const headers = {};
  if (cookie) headers['Cookie'] = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = raw ? null : await res.json().catch(() => null);
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
  // 1. Owner authentication
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
    const { res } = await login(process.env.OWNER_EMAIL, 'wrong-password-999');
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
  // 4. Full CRUD — Offers
  // ==========================================================
  console.log('\n4. As A: full CRUD on Offers');

  let offerCRUD;
  try {
    const { res, json } = await api('POST', '/api/offers', {
      cookie: cookieA,
      body: { title: 'CRUD Offer', description: 'To be deleted' },
    });
    const ctx = { status: res.status, body: json };
    assert(res.status === 201, 'create offer', ctx);
    offerCRUD = json;
  } catch (e) {
    fail('create offer', e);
  }

  if (offerCRUD) {
    try {
      const { res, json } = await api('GET', `/api/offers/${offerCRUD._id}`, { cookie: cookieA });
      const ctx = { status: res.status, body: json };
      assert(res.status === 200, 'GET single offer 200', ctx);
      assert(json.title === 'CRUD Offer', 'GET offer title matches', ctx);
    } catch (e) {
      fail('GET single offer', e);
    }

    try {
      const { res, json } = await api('PUT', `/api/offers/${offerCRUD._id}`, {
        cookie: cookieA,
        body: { title: 'Updated Offer' },
      });
      const ctx = { status: res.status, body: json };
      assert(res.status === 200, 'PUT offer 200', ctx);
      assert(json.title === 'Updated Offer', 'PUT offer title persisted', ctx);
    } catch (e) {
      fail('PUT offer', e);
    }

    try {
      const { res } = await api('DELETE', `/api/offers/${offerCRUD._id}`, { cookie: cookieA });
      assert(res.status === 200, 'DELETE offer 200');
    } catch (e) {
      fail('DELETE offer', e);
    }

    try {
      const { res } = await api('GET', `/api/offers/${offerCRUD._id}`, { cookie: cookieA });
      assert(res.status === 404, 'GET deleted offer 404');
    } catch (e) {
      fail('GET deleted offer 404', e);
    }
  }

  // Create the offerA needed for later tests
  let offerA;
  try {
    const { res, json } = await api('POST', '/api/offers', {
      cookie: cookieA,
      body: { title: 'E2E Offer', description: 'Test offer description' },
    });
    const ctx = { status: res.status, body: json };
    assert(res.status === 201, 'create offerA for later tests', ctx);
    offerA = json;
  } catch (e) {
    fail('create offerA', e);
  }

  // ==========================================================
  // 5. Full CRUD — Groups
  // ==========================================================
  console.log('\n5. As A: full CRUD on Groups');

  let groupCRUD;
  try {
    const { res, json } = await api('POST', '/api/groups', {
      cookie: cookieA,
      body: { name: 'CRUD Group', url: 'https://www.facebook.com/groups/crude2etest/' },
    });
    const ctx = { status: res.status, body: json };
    assert(res.status === 201, 'create group', ctx);
    groupCRUD = json;
  } catch (e) {
    fail('create group', e);
  }

  if (groupCRUD) {
    try {
      const { res, json } = await api('GET', `/api/groups/${groupCRUD._id}`, { cookie: cookieA });
      const ctx = { status: res.status, body: json };
      assert(res.status === 200, 'GET single group 200', ctx);
      assert(json.name === 'CRUD Group', 'GET group name matches', ctx);
    } catch (e) {
      fail('GET single group', e);
    }

    try {
      const { res, json } = await api('PUT', `/api/groups/${groupCRUD._id}`, {
        cookie: cookieA,
        body: { name: 'Updated Group' },
      });
      const ctx = { status: res.status, body: json };
      assert(res.status === 200, 'PUT group 200', ctx);
      assert(json.name === 'Updated Group', 'PUT group name persisted', ctx);
    } catch (e) {
      fail('PUT group', e);
    }

    try {
      const { res } = await api('DELETE', `/api/groups/${groupCRUD._id}`, { cookie: cookieA });
      assert(res.status === 200, 'DELETE group 200');
    } catch (e) {
      fail('DELETE group', e);
    }

    try {
      const { res } = await api('GET', `/api/groups/${groupCRUD._id}`, { cookie: cookieA });
      assert(res.status === 404, 'GET deleted group 404');
    } catch (e) {
      fail('GET deleted group 404', e);
    }
  }

  let groupA;
  try {
    const { res, json } = await api('POST', '/api/groups', {
      cookie: cookieA,
      body: { name: 'E2E Group', url: 'https://www.facebook.com/groups/e2etestgroup/' },
    });
    const ctx = { status: res.status, body: json };
    assert(res.status === 201, 'create groupA for later tests', ctx);
    groupA = json;
  } catch (e) {
    fail('create groupA', e);
  }

  // ==========================================================
  // 6. Full CRUD — Positions
  // ==========================================================
  console.log('\n6. As A: full CRUD on Positions');

  let positionCRUD;
  try {
    const { res, json } = await api('POST', '/api/positions', {
      cookie: cookieA,
      body: { title: 'CRUD Position', description: 'To be deleted' },
    });
    const ctx = { status: res.status, body: json };
    assert(res.status === 201, 'create position', ctx);
    positionCRUD = json;
  } catch (e) {
    fail('create position', e);
  }

  if (positionCRUD) {
    try {
      const { res, json } = await api('GET', `/api/positions/${positionCRUD._id}`, { cookie: cookieA });
      const ctx = { status: res.status, body: json };
      assert(res.status === 200, 'GET single position 200', ctx);
      assert(json.title === 'CRUD Position', 'GET position title matches', ctx);
    } catch (e) {
      fail('GET single position', e);
    }

    try {
      const { res, json } = await api('PUT', `/api/positions/${positionCRUD._id}`, {
        cookie: cookieA,
        body: { title: 'Updated Position' },
      });
      const ctx = { status: res.status, body: json };
      assert(res.status === 200, 'PUT position 200', ctx);
      assert(json.title === 'Updated Position', 'PUT position title persisted', ctx);
    } catch (e) {
      fail('PUT position', e);
    }

    try {
      const { res } = await api('DELETE', `/api/positions/${positionCRUD._id}`, { cookie: cookieA });
      assert(res.status === 200, 'DELETE position 200');
    } catch (e) {
      fail('DELETE position', e);
    }

    try {
      const { res } = await api('GET', `/api/positions/${positionCRUD._id}`, { cookie: cookieA });
      assert(res.status === 404, 'GET deleted position 404');
    } catch (e) {
      fail('GET deleted position 404', e);
    }
  }

  // Create positionA (active) + positionPaused used for visibility tests
  let positionA, positionPaused;
  try {
    const { res, json } = await api('POST', '/api/positions', {
      cookie: cookieA,
      body: { title: 'E2E Position', description: 'Test position' },
    });
    const ctx = { status: res.status, body: json };
    assert(res.status === 201, 'create positionA (active)', ctx);
    positionA = json;
  } catch (e) {
    fail('create positionA', e);
  }

  try {
    const { res, json } = await api('POST', '/api/positions', {
      cookie: cookieA,
      body: { title: 'Paused Position', description: 'Should be hidden', status: 'paused' },
    });
    const ctx = { status: res.status, body: json };
    assert(res.status === 201, 'create paused position', ctx);
    positionPaused = json;
  } catch (e) {
    fail('create paused position', e);
  }

  // ==========================================================
  // 7. Full CRUD — Accounts
  // ==========================================================
  console.log('\n7. As A: full CRUD on Accounts');

  let accountCRUD;
  try {
    const { res, json } = await api('POST', '/api/accounts', {
      cookie: cookieA,
      body: { nickname: `crud-acc-${ts}` },
    });
    const ctx = { status: res.status, body: json };
    assert(res.status === 201, 'create account', ctx);
    accountCRUD = json;
  } catch (e) {
    fail('create account', e);
  }

  if (accountCRUD) {
    try {
      const { res, json } = await api('GET', `/api/accounts/${accountCRUD._id}`, { cookie: cookieA });
      const ctx = { status: res.status, body: json };
      assert(res.status === 200, 'GET single account 200', ctx);
      assert(json.nickname === `crud-acc-${ts}`, 'GET account nickname matches', ctx);
    } catch (e) {
      fail('GET single account', e);
    }

    try {
      const { res, json } = await api('PUT', `/api/accounts/${accountCRUD._id}`, {
        cookie: cookieA,
        body: { nickname: `updated-acc-${ts}` },
      });
      const ctx = { status: res.status, body: json };
      assert(res.status === 200, 'PUT account 200', ctx);
      assert(json.nickname === `updated-acc-${ts}`, 'PUT account nickname persisted', ctx);
    } catch (e) {
      fail('PUT account', e);
    }

    try {
      const { res } = await api('DELETE', `/api/accounts/${accountCRUD._id}`, { cookie: cookieA });
      assert(res.status === 200, 'DELETE account 200');
    } catch (e) {
      fail('DELETE account', e);
    }

    try {
      const { res } = await api('GET', `/api/accounts/${accountCRUD._id}`, { cookie: cookieA });
      assert(res.status === 404, 'GET deleted account 404');
    } catch (e) {
      fail('GET deleted account 404', e);
    }
  }

  let accountA;
  try {
    const { res, json } = await api('POST', '/api/accounts', {
      cookie: cookieA,
      body: { nickname: `e2e-acc-${ts}` },
    });
    const ctx = { status: res.status, body: json };
    assert(res.status === 201, 'create accountA for later tests', ctx);
    accountA = json;
  } catch (e) {
    fail('create accountA', e);
  }

  // ==========================================================
  // 8. Anonymous: public positions + submit candidate
  // ==========================================================
  console.log('\n8. Anonymous public access');

  try {
    const { res, json } = await api('GET', `/api/public/positions/${recruiterA.applySlug}`);
    assert(res.status === 200, 'GET public positions 200');
    const foundActive = Array.isArray(json) && json.some((p) => p._id === positionA._id);
    assert(foundActive, 'active position visible publicly');
    const foundPaused = Array.isArray(json) && json.some((p) => p._id === positionPaused._id);
    assert(!foundPaused, 'paused position NOT visible publicly');
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
  // 9. As A: GET candidates
  // ==========================================================
  console.log('\n9. As A: list candidates');

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
  // 10. Login as recruiterB
  // ==========================================================
  console.log('\n10. Login as recruiterB');

  let cookieB;
  try {
    const { res, cookie, body } = await login(`test-b-${ts}@test.local`, 'passB123');
    assert(res.status === 200 && body.success, 'recruiterB login');
    cookieB = cookie;
  } catch (e) {
    fail('recruiterB login', e);
  }

  // ==========================================================
  // 11. As B: isolation — all lists empty
  // ==========================================================
  console.log('\n11. As B: isolation check (empty lists)');

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
  // 12. Cross-recruiter 403 on PUT/DELETE
  // ==========================================================
  console.log('\n12. As B: cannot modify A\'s resources');

  for (const { label, path, id } of [
    { label: 'offer', path: '/api/offers', id: offerA?._id },
    { label: 'group', path: '/api/groups', id: groupA?._id },
    { label: 'position', path: '/api/positions', id: positionA?._id },
    { label: 'account', path: '/api/accounts', id: accountA?._id },
  ]) {
    if (!id) continue;

    try {
      const { res, json } = await api('PUT', `${path}/${id}`, {
        cookie: cookieB,
        body: { title: 'HACKED' },
      });
      const ctx = { status: res.status, body: json };
      assert(res.status === 403, `PUT A's ${label} → 403`, ctx);
    } catch (e) {
      fail(`PUT A's ${label} → 403`, e);
    }

    try {
      const { res, json } = await api('DELETE', `${path}/${id}`, { cookie: cookieB });
      const ctx = { status: res.status, body: json };
      assert(res.status === 403, `DELETE A's ${label} → 403`, ctx);
    } catch (e) {
      fail(`DELETE A's ${label} → 403`, e);
    }
  }

  // ==========================================================
  // 13. Post-job ownership check (B using A's resources) → 403
  // ==========================================================
  console.log('\n13. As B: post-job ownership check (A\'s resources → 403)');

  if (accountA && offerA && groupA) {
    try {
      const { res, json } = await api('POST', '/api/post-jobs', {
        cookie: cookieB,
        body: {
          accountId: accountA._id,
          groupIds: [groupA._id],
          offerIds: [offerA._id],
        },
      });
      const ctx = { status: res.status, body: json };
      assert(res.status === 403, 'B using A\'s account/group/offer → 403', ctx);
    } catch (e) {
      fail('post-job ownership check', e);
    }
  }

  // ==========================================================
  // 14. Bulk import edge cases (as A)
  // ==========================================================
  console.log('\n14. Bulk import edge cases');

  try {
    const { res, json } = await api('POST', '/api/offers/bulk', {
      cookie: cookieA,
      body: {
        offers: [
          { title: 'Valid One', description: 'Desc one' },
          { title: 'Title with | pipe', description: 'Desc two' },
          { title: '', description: '' },
          { description: 'Missing title' },
        ],
      },
    });
    const ctx = { status: res.status, body: json };
    assert(res.status === 200, 'bulk import 200', ctx);
    assert(json.created === 2, 'bulk created === 2', ctx);
    assert(json.failed === 2, 'bulk failed === 2 (empty + missing title)', ctx);
    assert(Array.isArray(json.failures) && json.failures.length === 2, 'failure reasons present', ctx);
    assert(json.failures.every((f) => f.reason && f.input), 'each failure has reason + input', ctx);
  } catch (e) {
    fail('bulk import edge cases', e);
  }

  // ==========================================================
  // 15. Enum & validation edge cases
  // ==========================================================
  console.log('\n15. Enum & validation edge cases');

  try {
    const { res, json } = await api('POST', `/api/public/candidates/${recruiterA.applySlug}`, {
      body: {
        name: 'Bad Lang',
        phone: '+1234567890',
        graduation: 'Graduate',
        experience: '2 years',
        language: 'English',
        languageLevel: 'Z9',
        nationality: 'Egyptian',
        position: positionA._id,
        recordingUrl: 'https://example.com/r.mp4',
      },
    });
    const ctx = { status: res.status, body: json };
    assert(res.status === 400, 'invalid languageLevel → 400', ctx);
    assert(json.error && json.error.includes('languageLevel'), 'error mentions languageLevel', ctx);
  } catch (e) {
    fail('invalid languageLevel', e);
  }

  try {
    const { res, json } = await api('POST', `/api/public/candidates/${recruiterA.applySlug}`, {
      body: {
        name: 'Bad Grad',
        phone: '+1234567890',
        graduation: 'PhD',
        experience: '2 years',
        language: 'English',
        languageLevel: 'B2',
        nationality: 'Egyptian',
        position: positionA._id,
        recordingUrl: 'https://example.com/r.mp4',
      },
    });
    const ctx = { status: res.status, body: json };
    assert(res.status === 400, 'invalid graduation → 400', ctx);
    assert(json.error && json.error.includes('graduation'), 'error mentions graduation', ctx);
  } catch (e) {
    fail('invalid graduation', e);
  }

  for (const [desc, overrides, expectedField] of [
    ['missing name', { name: '' }, 'name'],
    ['missing phone', { name: 'Test', phone: '' }, 'phone'],
    ['missing experience', { name: 'Test', phone: '+1', experience: '' }, 'experience'],
  ]) {
    try {
      const { res, json } = await api('POST', `/api/public/candidates/${recruiterA.applySlug}`, {
        body: {
          name: 'Test',
          phone: '+1234567890',
          graduation: 'Graduate',
          experience: '2 years',
          language: 'English',
          languageLevel: 'B2',
          nationality: 'Egyptian',
          position: positionA._id,
          recordingUrl: 'https://example.com/r.mp4',
          ...overrides,
        },
      });
      const ctx = { status: res.status, body: json };
      assert(res.status === 400, `${desc} → 400`, ctx);
      assert(json.error && json.error.includes(expectedField), `error names '${expectedField}'`, ctx);
    } catch (e) {
      fail(`${desc}`, e);
    }
  }

  try {
    const { res, json } = await api('POST', '/api/groups', {
      cookie: cookieA,
      body: { name: 'Bad URL Group', url: 'not-a-facebook-url' },
    });
    const ctx = { status: res.status, body: json };
    assert(res.status === 400, 'invalid Facebook group URL → 400', ctx);
    assert(json.error && json.error.toLowerCase().includes('invalid'), 'error mentions invalid', ctx);
  } catch (e) {
    fail('invalid group URL', e);
  }

  // ==========================================================
  // 16. Candidate status transitions
  // ==========================================================
  console.log('\n16. Candidate status transitions');

  if (candidateA) {
    for (const status of ['offer_selected', 'accepted', 'rejected', 'submitted']) {
      try {
        const { res, json } = await api('PUT', `/api/candidates/${candidateA._id}/status`, {
          cookie: cookieA,
          body: { status },
        });
        const ctx = { status: res.status, body: json };
        assert(res.status === 200, `set status to '${status}' 200`, ctx);
        assert(json.status === status, `status is '${status}'`, ctx);
      } catch (e) {
        fail(`set status to '${status}'`, e);
      }
    }

    try {
      const { res, json } = await api('PUT', `/api/candidates/${candidateA._id}/status`, {
        cookie: cookieA,
        body: { status: 'invalid_status' },
      });
      const ctx = { status: res.status, body: json };
      assert(res.status === 400, 'invalid status string → 400', ctx);
    } catch (e) {
      fail('invalid candidate status', e);
    }

    // Attempt to change fields other than status — they should be ignored
    try {
      const { res, json } = await api('PUT', `/api/candidates/${candidateA._id}/status`, {
        cookie: cookieA,
        body: { status: 'accepted', name: 'Hacked Name', phone: 'Hacked Phone' },
      });
      const ctx = { status: res.status, body: json };
      assert(res.status === 200, 'PUT with extra fields 200', ctx);
      assert(json.status === 'accepted', 'status changed', ctx);
      assert(json.name === 'Jane Doe', 'name unchanged despite extra field', ctx);
      assert(json.phone === '+1234567890', 'phone unchanged despite extra field', ctx);
    } catch (e) {
      fail('extra fields ignored in candidate status', e);
    }
  }

  // ==========================================================
  // 17. Recruiter lifecycle (as owner)
  // ==========================================================
  console.log('\n17. Recruiter lifecycle');

  try {
    const { res, json } = await api('POST', '/api/admin/recruiters', {
      cookie: ownerCookie,
      body: { name: 'Dup', email: `test-a-${ts}@test.local`, password: 'x' },
    });
    const ctx = { status: res.status, body: json };
    assert(res.status === 400, 'duplicate email → 400', ctx);
    assert(json.error && json.error.toLowerCase().includes('email'), 'error mentions email', ctx);
  } catch (e) {
    fail('duplicate email', e);
  }

  if (recruiterB) {
    try {
      const { res } = await api('PUT', `/api/admin/recruiters/${recruiterB._id}`, {
        cookie: ownerCookie,
        body: { status: 'disabled' },
      });
      assert(res.status === 200, 'disable recruiterB');
    } catch (e) {
      fail('disable recruiterB', e);
    }

    try {
      const { res } = await login(`test-b-${ts}@test.local`, 'passB123');
      assert(res.status === 401, 'disabled recruiter login fails (401)');
    } catch (e) {
      fail('disabled recruiter login', e);
    }

    try {
      const { res } = await api('PUT', `/api/admin/recruiters/${recruiterB._id}`, {
        cookie: ownerCookie,
        body: { status: 'active' },
      });
      assert(res.status === 200, 're-enable recruiterB');
    } catch (e) {
      fail('re-enable recruiterB', e);
    }

    try {
      const { res, body } = await login(`test-b-${ts}@test.local`, 'passB123');
      assert(res.status === 200 && body.success, 'recruiterB login succeeds after re-enable');
    } catch (e) {
      fail('re-enabled recruiter login', e);
    }
  }

  // ==========================================================
  // 18. Public apply edge cases
  // ==========================================================
  console.log('\n18. Public apply edge cases');

  try {
    const { res } = await api('GET', '/api/public/positions/nonexistent-slug-xyz');
    assert(res.status === 404, 'nonexistent slug → 404');
  } catch (e) {
    fail('nonexistent slug', e);
  }

  // Disable recruiterA, check slug returns 404, then re-enable
  if (recruiterA) {
    try {
      await api('PUT', `/api/admin/recruiters/${recruiterA._id}`, {
        cookie: ownerCookie,
        body: { status: 'disabled' },
      });
      const { res } = await api('GET', `/api/public/positions/${recruiterA.applySlug}`);
      assert(res.status === 404, 'disabled recruiter slug → 404');
    } catch (e) {
      fail('disabled recruiter slug', e);
    }

    try {
      await api('PUT', `/api/admin/recruiters/${recruiterA._id}`, {
        cookie: ownerCookie,
        body: { status: 'active' },
      });
    } catch (e) {
      fail('re-enable recruiterA', e);
    }
  }

  // Owner's own slug (role owner, not recruiter) → 404
  try {
    // The owner also has an applySlug; resolveRecruiter filters by role:'recruiter'
    // so an owner slug should 404. We need the owner's slug — fetch from DB.
    const mongoose = require('mongoose');
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/job-poster';
    await mongoose.connect(uri);
    const User = require('../models/User');
    const ownerUser = await User.findOne({ email: process.env.OWNER_EMAIL.toLowerCase() }).select('applySlug').lean();
    if (ownerUser) {
      const { res } = await api('GET', `/api/public/positions/${ownerUser.applySlug}`);
      assert(res.status === 404, 'owner slug → 404');
    }
    await mongoose.disconnect();
  } catch (e) {
    fail('owner slug → 404', e);
  }

  // ==========================================================
  // 19. Security: no sessionData in Accounts
  // ==========================================================
  console.log('\n19. Security — no sessionData leak in Accounts');

  async function checkNoSessionData(label, cookie) {
    try {
      const { res, json } = await api('GET', '/api/accounts', { cookie });
      assert(res.status === 200, `GET accounts ${label} 200`);
      const bodyStr = JSON.stringify(json);
      assert(!bodyStr.includes('sessionData'), `no sessionData in ${label} list`, { body: json });
      if (Array.isArray(json) && json.length > 0) {
        const { res: res2, json: single } = await api('GET', `/api/accounts/${json[0]._id}`, { cookie });
        assert(res2.status === 200, `GET single account ${label} 200`);
        const singleStr = JSON.stringify(single);
        assert(!singleStr.includes('sessionData'), `no sessionData in ${label} single`, { body: single });
      }
    } catch (e) {
      fail(`sessionData check ${label}`, e);
    }
  }

  await checkNoSessionData('as recruiterA', cookieA);
  await checkNoSessionData('as owner', ownerCookie);

  // ==========================================================
  // 20. As A: post-job, verify, dedup
  // ==========================================================
  console.log('\n20. As A: account, post-job, and dedup');

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
  // 21. Logout, protected routes, admin guard
  // ==========================================================
  console.log('\n21. Auth & access control');

  let loggedOutCookie;
  try {
    const { res } = await api('POST', '/api/auth/logout', { cookie: cookieA });
    assert(res.status === 200, 'logout succeeds');
    loggedOutCookie = cookieA;
  } catch (e) {
    fail('logout', e);
  }

  try {
    const { res } = await api('GET', '/api/offers', { cookie: loggedOutCookie });
    assert(res.status === 401, 'after logout, protected GET returns 401');
  } catch (e) {
    fail('logout GET 401', e);
  }

  try {
    const { res } = await api('POST', '/api/offers', {
      cookie: loggedOutCookie,
      body: { title: 'Should fail', description: 'No session' },
    });
    assert(res.status === 401, 'after logout, protected POST returns 401');
  } catch (e) {
    fail('logout POST 401', e);
  }

  try {
    const { res } = await api('GET', '/api/offers');
    assert(res.status === 401, 'no cookie at all → 401');
  } catch (e) {
    fail('no cookie 401', e);
  }

  // Recruiter accessing admin route → 403
  try {
    const { res } = await api('GET', '/api/admin/recruiters', { cookie: cookieB });
    assert(res.status === 403, 'recruiter GET /api/admin/recruiters → 403');
  } catch (e) {
    fail('recruiter admin 403', e);
  }

  try {
    const { res } = await api('POST', '/api/admin/recruiters', {
      cookie: cookieB,
      body: { name: 'X', email: 'x@x.com', password: 'x' },
    });
    assert(res.status === 403, 'recruiter POST /api/admin/recruiters → 403');
  } catch (e) {
    fail('recruiter admin POST 403', e);
  }

  // /api/auth/me returns correct role
  try {
    const { res, json } = await api('GET', '/api/auth/me', { cookie: ownerCookie });
    assert(res.status === 200, 'auth/me 200 (owner)');
    assert(json.role === 'owner', 'auth/me role is owner');
  } catch (e) {
    fail('auth/me owner role', e);
  }

  // Re-login A since we logged out
  try {
    const { res, cookie, body } = await login(`test-a-${ts}@test.local`, 'passA123');
    assert(res.status === 200 && body.success, 're-login recruiterA');
    cookieA = cookie;
  } catch (e) {
    fail('re-login recruiterA', e);
  }

  try {
    const { res, json } = await api('GET', '/api/auth/me', { cookie: cookieA });
    assert(res.status === 200, 'auth/me 200 (recruiter)');
    assert(json.role === 'recruiter', 'auth/me role is recruiter');
  } catch (e) {
    fail('auth/me recruiter role', e);
  }

  // ==========================================================
  // Teardown: remove all test data from MongoDB
  // ==========================================================
  console.log('\n22. Teardown');

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
