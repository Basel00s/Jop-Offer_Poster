# Job Poster — Architecture & Codex Build Plan

Stack (unchanged from the starting point): Node.js + Express + MongoDB (Mongoose) backend,
plain HTML/CSS/JS frontend, Playwright (JS) for automation. Multi-page site, not an SPA.

---

## 1. Pages

| Page | File | Purpose |
|---|---|---|
| Dashboard / Post | `public/dashboard.html` | Home page. Nav to everything. Account health strip at the top (active/cooling down/checkpointed, front and center). The "Post" composer: pick account(s), group(s), offer(s) → queues PostJobs. Filterable post history/log below (by account, status). |
| Accounts | `public/accounts.html` | List/add/edit/pause/delete Facebook accounts (metadata only — never raw session data). Includes dailyPostCap setting. |
| Offers | `public/offers.html` | CRUD, plus bulk-import (paste or CSV) since offers change often. |
| Groups | `public/groups.html` | CRUD. |
| Candidates | `public/candidates.html` | List/add candidates, view pipeline status, generate/copy their apply link. |

All pages share `public/css/style.css` and a small shared nav markup/JS include.

## 2. Data model (MongoDB collections)

### Account
```
nickname       String, required, unique
sessionPath    String   // path to the Playwright storage_state file on disk — never sent to frontend
status         enum: active | cooldown | checkpoint | disabled
dailyPostCount Number, default 0   // reset daily by the worker
dailyPostCap   Number, default 40  // soft limit the worker respects — settable per account on the Accounts page
lastUsedAt     Date
notes          String
timestamps
```
Rationale: the web app CRUDs everything here except `sessionPath`'s contents — that file is
created/refreshed by a separate CLI script, not through HTTP. `dailyPostCap` is exposed as
an editable field so the worker self-limits without you tracking counts by hand.

### Offer
```
title, description, status: active|paused, timestamps
```
Bulk import: a paste-box (one offer per line, or title/description separated by a delimiter)
or CSV upload that creates many Offer docs in one request — see Prompt 3b below.

### Group
```
name, url, notes, status: active|paused, timestamps
```

### PostJob
```
offer     ObjectId ref Offer
group     ObjectId ref Group
account   ObjectId ref Account
status    enum: queued | posted | pending_approval | failed | skipped
resultUrl String
error     String
queuedAt  Date
postedAt  Date
```
Rationale: this is both the work queue (status: queued) and the history log (everything
else). Clicking "Post" with N offers × M groups × 1 account creates N×M queued rows; the
worker processes them one at a time with delay/cooldown logic instead of firing them all at
once. The same collection powers the dashboard's history/log view — query by `account` and/or
`status` to answer "what actually posted vs. pending vs. failed, per account."

### Candidate
```
name          String, required
contact       String   // phone or email, candidate's choice
targetLanguage String
applyToken    String, unique, indexed   // random token for their public link
videoUrl      String   // set once they submit
status        enum: invited | video_submitted | offer_selected
selectedOffer ObjectId ref Offer
timestamps
```
Rationale: kept intentionally minimal — extend once you share the fuller spec for the
candidate-facing site.

## 3. Backend structure

```
job-poster/
├── server.js
├── db.js
├── models/
│   ├── Offer.js  Group.js   (existing)
│   ├── Account.js
│   ├── PostJob.js
│   └── Candidate.js
├── routes/
│   ├── offers.js  groups.js   (existing — offers.js gains a bulk-import endpoint)
│   ├── accounts.js       # metadata CRUD only
│   ├── postJobs.js       # POST bulk-create from dashboard selection, GET history/queue
│   └── candidates.js     # admin CRUD + public apply-token routes
├── scripts/
│   └── login-account.js  # standalone: opens real browser, you log in, saves session
├── worker/
│   └── postWorker.js     # polls PostJob queue, runs Playwright, respects cooldowns/caps
├── public/
│   ├── dashboard.html  accounts.html  offers.html  groups.html  candidates.html
│   ├── css/style.css
│   └── js/ (one file per page + shared nav.js)
└── apply/                # public candidate-facing routes/pages — placeholder for now
```

## 4. Post flow (dashboard)

1. Dashboard loads `GET /api/accounts` on page load and renders a health strip: one pill per
   account showing its `status` (active/cooldown/checkpoint/disabled) and
   `dailyPostCount`/`dailyPostCap` — this sits above everything else on the page.
2. User selects one or more accounts, one or more groups, one or more offers.
3. `POST /api/post-jobs` with the three ID arrays → server creates a queued `PostJob` for
   every combination.
4. `worker/postWorker.js` runs continuously (or on a cron tick), picks the oldest `queued`
   job whose account isn't in cooldown/checkpoint and is under its daily cap, posts it via
   Playwright, updates status, waits a randomized delay, moves to the next.
5. Dashboard's history/log section polls `GET /api/post-jobs?status=&account=` (both filters
   optional) so you can see, per account, what posted vs. is pending group-admin approval vs.
   failed.

## 5. Account session lifecycle

1. Run `node scripts/login-account.js --nickname acc-1`.
2. Script launches a real (non-headless) browser, you log into Facebook manually.
3. On success, it saves `storage_state` to `sessions/acc-1.json` and creates/updates the
   `Account` document with `status: active` and `sessionPath` pointing at that file.
4. The web UI never touches the file directly — only the worker reads it, and only to
   launch a Playwright context.

## 6. Candidate-facing site (placeholder — refine once you give full details)

- `GET /apply/:token` → public page: shows candidate their status. If new, shows a form
  (confirm details, pick language) + in-browser video recording (MediaRecorder API) capped
  at 60s, uploaded to the server and saved to disk; `videoUrl` saved on the Candidate doc.
- After submission, same page shows active offers (optionally filtered by `targetLanguage`)
  for them to pick one → `selectedOffer` saved, status → `offer_selected`.
- Recruiter side: `candidates.html` shows this same status per candidate and lets you copy
  their `/apply/:token` link to send.

---

## 7. Prompt sequence (for Cursor's Agent/Composer mode)

Paste these one at a time, in order, inside the `job-poster` repo. Each assumes the previous
one has been applied. Use Agent/Composer mode (not inline edit) for any prompt that touches
more than one file.

**Prompt 1 — Account model + routes**
> In this Express + Mongoose project, add a new `Account` model in `models/Account.js` with
> fields: nickname (String, required, unique), sessionPath (String), status (enum:
> active/cooldown/checkpoint/disabled, default active), dailyPostCount (Number, default 0),
> dailyPostCap (Number, default 40), lastUsedAt (Date), notes (String), and timestamps.
> Add `routes/accounts.js` with GET all, GET one, POST, PUT, DELETE — following the same
> pattern as `routes/offers.js`. The PUT route should allow editing dailyPostCap. Never
> accept or return `sessionPath` in the POST/PUT body from the client — that field is only
> ever set by a separate script. Mount the router in `server.js` at `/api/accounts`.

**Prompt 2 — Accounts page (frontend)**
> Create `public/accounts.html` and `public/js/accounts.js`, following the exact structure
> and style of the existing `offers.html`/`app.js` pattern (form card to add/edit, table
> listing, status pill, edit/delete buttons). Fields shown and editable: nickname, status,
> dailyPostCap, notes. lastUsedAt shown read-only. Do not show or edit sessionPath anywhere
> in the UI. Reuse `public/css/style.css` — don't add new stylesheets.

**Prompt 3 — Split into multi-page site with shared nav**
> Refactor this project from a single tabbed `index.html` into separate pages:
> `dashboard.html`, `accounts.html`, `offers.html`, `groups.html`, `candidates.html` (create
> candidates.html as an empty shell for now). Extract the current Offers/Groups tab content
> into their own pages using their existing forms/tables/JS almost unchanged. Create a small
> shared nav (e.g. `public/js/nav.js` that injects a nav bar, or repeated markup) linking all
> five pages, matching the current dark theme in style.css. Rename the current index.html's
> role: dashboard.html becomes the new home page.

**Prompt 3b — Bulk import offers**
> On `offers.html`, add a "Bulk import" option next to the existing "+ New Offer" button. It
> opens a textarea where the user pastes multiple offers, one per line, in the format
> `Title | Description`. On submit, POST the parsed array to a new endpoint
> `POST /api/offers/bulk` in `routes/offers.js` that accepts `{ offers: [{title,
> description}] }` and inserts them all (default status active), returning how many were
> created and how many lines failed to parse (with the reason). Show that result to the user
> and refresh the offers table.

**Prompt 4 — PostJob model + bulk-create + history endpoint**
> Add a `PostJob` model in `models/PostJob.js`: offer (ObjectId ref Offer), group (ObjectId
> ref Group), account (ObjectId ref Account), status (enum: queued/posted/pending_approval/
> failed/skipped, default queued), resultUrl (String), error (String), queuedAt (Date,
> default now), postedAt (Date). Add `routes/postJobs.js` with: POST `/api/post-jobs` that
> accepts `{ accountIds: [], groupIds: [], offerIds: [] }` and creates one PostJob per
> combination (account × group × offer); GET `/api/post-jobs` with optional `?status=` and
> `?account=` query filters (combinable), sorted newest first, populated with offer title,
> group name, account nickname. Mount at `/api/post-jobs`.

**Prompt 5 — Dashboard: account health strip**
> On `dashboard.html`, add a health strip at the very top of the page, above everything
> else: fetch `GET /api/accounts` and render one pill per account showing its nickname,
> status (styled distinctly for active/cooldown/checkpoint/disabled — cooldown and
> checkpoint should stand out visually, e.g. amber/red), and `dailyPostCount`/`dailyPostCap`
> as text like "12/40". Poll this every 15-30 seconds so it stays current while the worker
> runs.

**Prompt 6 — Dashboard: post composer**
> Below the health strip on `dashboard.html`, build a "Post" section: three multi-select
> lists (accounts, groups, offers — only showing status: active items, fetched from their
> respective APIs), and a Post button that calls `POST /api/post-jobs` with the selected
> IDs, then shows a success message with how many jobs were queued.

**Prompt 7 — Dashboard: filterable post history/log**
> Below the post composer on `dashboard.html`, add a history/log table showing PostJob
> entries (offer title, group name, account nickname, status pill, postedAt or queuedAt,
> and error text if failed). Add two filter dropdowns above the table: one for status (all/
> queued/posted/pending_approval/failed/skipped) and one for account (all + each account
> nickname), both driving the query params on `GET /api/post-jobs`. Poll every few seconds
> for live updates while filters stay applied.

**Prompt 8 — Candidate model + admin routes**
> Add a `Candidate` model in `models/Candidate.js`: name (String, required), contact
> (String), targetLanguage (String), applyToken (String, unique, indexed — generate with
> crypto.randomBytes(16).toString('hex') on creation), videoUrl (String), status (enum:
> invited/video_submitted/offer_selected, default invited), selectedOffer (ObjectId ref
> Offer), timestamps. Add `routes/candidates.js` with GET all, GET one, POST (name, contact,
> targetLanguage — auto-generates applyToken), PUT, DELETE, following the existing route
> patterns. Mount at `/api/candidates`.

**Prompt 9 — Candidates page (frontend)**
> Build out `candidates.html` and `public/js/candidates.js` following the established
> pattern: form to add a candidate (name, contact, targetLanguage), table listing all
> candidates with status pill and a "Copy apply link" button that copies
> `${window.location.origin}/apply/${applyToken}` to the clipboard, plus edit/delete.

**Prompt 10 — placeholder, hold until you give full spec**
> (Don't run yet.) Scaffold public routes under `/apply/:token` for the candidate-facing
> flow: GET renders a page showing candidate status; if status is "invited", show a form to
> confirm details plus in-browser video recording (MediaRecorder API, 60s cap) that uploads
> to a new `POST /apply/:token/video` endpoint, saving the file to `uploads/candidates/` and
> updating videoUrl + status on the Candidate doc. After video submission, show active
> offers (optionally filtered by targetLanguage) as selectable cards; selecting one calls
> `POST /apply/:token/select-offer` and updates selectedOffer + status.

Login script and worker (build after the above, once accounts/post-jobs exist):

**Prompt 11 — Login script**
> Add `scripts/login-account.js`, a standalone Node script (not part of the Express server)
> that takes a `--nickname` CLI arg, launches Playwright Chromium headless:false, navigates
> to facebook.com, waits (e.g. for a keypress in the terminal) while the user logs in
> manually, then saves `context.storageState()` to `sessions/<nickname>.json` and
> upserts an Account document with that nickname, sessionPath, and status: active.

**Prompt 12 — Post worker**
> Add `worker/postWorker.js`, a standalone Node script that loops: find the oldest PostJob
> with status "queued" whose account.status is "active" and account.dailyPostCount <
> account.dailyPostCap; load that account's session via Playwright storage_state; attempt
> the Facebook post using the logic from the old facebook_post.py as a reference (translated
> to Playwright JS); on success set PostJob status "posted" + resultUrl, increment
> account.dailyPostCount; on a detected checkpoint/captcha page, set the account's status to
> "checkpoint" and requeue or skip the job instead of retrying; on other errors set status
> "failed" + error message; wait a randomized delay (e.g. 45–180s) between jobs.
