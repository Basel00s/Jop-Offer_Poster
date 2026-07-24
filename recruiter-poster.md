# Project Journey & Technical Log — Recruiter Poster

## Project Overview

Recruiter Poster is a recruitment automation SaaS that enables high-volume job posting to Facebook Groups. The core workflow: an **Owner** creates **Recruiters**, who each manage their own **Accounts** (Facebook profiles), **Groups** (Facebook Groups they post into), **Offers** (job ad copy), and **Positions** (job descriptions visible on a public apply page). Candidates apply via a recruiter-specific public URL, and the recruiter can triage them through a status pipeline (submitted → offer_selected → accepted / rejected). The **Dashboard** composer lets a recruiter select an account, groups, and offers to bulk-create **PostJobs** — queued records that a background agent (planned) executes via Playwright to post the offer into each group.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript 6, React Router v6, Tailwind CSS v4 (slate/violet light theme), Vite 8 |
| **Backend** | Node.js 20, Express 4, express-session (cookie-based auth) |
| **Database** | MongoDB 7, Mongoose 8 |
| **Email** | Nodemailer (SMTP, optional) |
| **Containerization** | Docker (multi-stage build), Docker Compose |
| **CI/CD** | GitHub Actions (MongoDB service, E2E test suite, build & deploy) |
| **Deployment** | Railway (production) + MongoDB Atlas |
| **Testing** | Custom E2E test suite (vanilla `fetch`, 22 test sections) |
| **Planned** | Playwright local agent for automated Facebook posting |

---

## Development Journey & Problem Solving

### 1. The Offers.js Owner Validation Bug

**Problem:** When creating an offer via `routes/offers.js`, the original code used `await Offer.create({...})` with the owner set in the constructor. This bypassed a subtle Mongoose validation: `create()` applies defaults but I had the owner assignment happening *after* the `new Offer()` call. If the schema's `owner` field was required and I used `create()`, passing `owner` in the spread was fine. But during a refactor I switched to `new Offer()` + `offer.owner = ...` + `offer.save()` to be explicit about the owner being set server-side (not from request body). The bug: the `owner` field was required in the schema, and if the `save()` failed silently or the `owner` wasn't set before `save()`, the offer would either save without an owner or throw.

**Fix:** I standardized to `new Offer({ title, description, status })` then explicitly set `offer.owner = req.session.userId` before `await offer.save()`. This guarantees the owner is always the authenticated user, never from the request body. The same pattern was applied consistently across all resource routes (Groups, Positions, Accounts).

**Lesson:** Always set ownership server-side from the session, never trust the client. Use `new Model()` + explicit assignment + `save()` for clarity.

---

### 2. Docker Caching and Network (ECONNRESET) Issues

**Problem:** The Docker build was slow because every code change invalidated the entire `npm install` cache. Additionally, the production container was using `npm install` instead of `npm ci`, which could install slightly different dependency versions. On Railway, the app experienced intermittent `ECONNRESET` errors connecting to MongoDB Atlas, and the Node process would crash without proper retry logic.

**Fix:**
- Restructured the Dockerfile into a multi-stage build: **Stage 1** (`node:20-bookworm`) builds the React client with `npm install` after copying only `package*.json` first (layer caching). **Stage 2** (`node:20-slim`) copies only the production dependencies, using `npm ci --omit=dev` for deterministic, reproducible installs. This cut build times by ~60%.
- Added `restart: unless-stopped` to both services in `docker-compose.yml` so the app auto-recovers from transient network failures.
- The MongoDB connection in `db.js` uses `mongoose.connect()` without additional retry logic because Railway's restart policy handles pod recycling.

**Lesson:** Multi-stage builds with correct layer ordering are essential for fast CI. `npm ci` guarantees reproducible installs. Always configure container restart policies for cloud deployments.

---

### 3. Comprehensive E2E Test Suite and GitHub Actions CI/CD

**Problem:** The project had no automated tests. Manual testing was error-prone and every deployment risked regressions. I needed a CI pipeline that ran against a real MongoDB instance and validated all critical API behaviors.

**Fix:** I wrote a 1045-line E2E test suite at `scripts/test-e2e.js` using only Node's built-in `fetch` (no test framework dependency). It covers 22 sections:

1. Owner authentication (login, wrong password)
2. Recruiter creation (as owner)
3. Recruiter login
4–7. Full CRUD on Offers, Groups, Positions, Accounts (create, read, update, delete, verify 404 after delete)
8. Anonymous public access (active positions visible, paused hidden, candidate submission)
9. Recruiter candidate listing
10–11. Multi-recruiter isolation (B sees A's data? no — empty lists)
12. Cross-recruiter 403 on PUT/DELETE
13. Post-job ownership validation
14. Bulk import edge cases (empty titles, pipes, missing fields)
15. Enum validation (invalid languageLevel, graduation, missing required fields, bad group URL)
16. Candidate status transitions (full cycle: submitted → offer_selected → accepted → rejected → submitted)
17. Recruiter lifecycle (disable → login fails → re-enable → login succeeds)
18. Public apply edge cases (nonexistent slug, disabled recruiter slug → 404, owner slug → 404)
19. Security: no `sessionPath` leak in Accounts API
20. Post-job creation, verification, and dedup (24h window)
21. Auth & access control (logout, protected routes, admin guard, `/api/auth/me` role check)
22. Teardown (deletes all test data)

The CI pipeline in `.github/workflows/ci.yml`:
- Spins up a MongoDB 7 service container
- Installs backend + frontend deps, builds the React app
- Seeds the owner account via `scripts/seed-owner.js`
- Starts the server, waits for readiness with a retry loop
- Runs the full E2E suite
- Reports pass/fail count and exits with appropriate code

**Lesson:** A self-contained E2E test suite with zero external test dependencies is incredibly valuable for a small team. It runs in CI exactly as it runs locally. The 22-section structure forced me to handle every edge case methodically.

---

### 4. UI Overhaul: Dark Mode → Modern Light SaaS Theme

**Problem:** The original UI was a dark-themed design with custom color tokens (`bg-bg-900`, `text-text-primary`, `border-border`, etc.). It felt dated and wasn't matching the modern SaaS look I wanted for the portfolio.

**Fix:** Migrated from Tailwind CSS v3 (with custom `theme.extend` in `tailwind.config.js`) to **Tailwind CSS v4** with the `@tailwindcss/vite` plugin. This eliminated the need for a config file entirely. I refactored the entire design system:

- **Colors:** Replaced the custom dark palette (`bg-900`, `bg-600`, `accent`, `danger`, etc.) with Tailwind's built-in slate and violet scale. The sidebar uses `bg-white border-r border-slate-200`, tables use `bg-white border-slate-200`, cards use `bg-white shadow-sm`.
- **Typography:** Changed font to Inter with `system-ui` fallback. Used `text-slate-900` for primary text, `text-slate-500` for secondary, `text-slate-400` for muted.
- **Components:** Rewrote `Card`, `Button`, `Table`, `Input`, `StatusPill`, `Modal`, `Toast`, and `MultiSelect` to use consistent slate/violet classes. Added subtle hover effects (`hover:-translate-y-0.5`, `hover:shadow-md`) for a polished feel.
- **Animations:** Defined `fade-in`, `slide-up`, `scale-in`, `toast-in`, `pulse-soft`, and `stagger-fade` keyframes in `index.css`. Applied them consistently across pages and components.

**Lesson:** Tailwind v4 with `@import "tailwindcss"` is a massive simplification. The built-in color palette is more cohesive than custom tokens. Animations should be subtle and purposeful.

---

### 5. Modal Overflow Bug → Inline Page Panels

**Problem:** The original UI used a `<Modal>` component for all create/edit forms. On mobile and even desktop, when a form had many fields (e.g., Account edit with group linking), the modal content would overflow its `max-h-[85vh]` container. The scrollbar would either appear on the wrong element or the content would be cut off. I added `min-h-0 flex-1 overflow-y-auto` to the modal body, which fixed scrolling but created a poor UX — long forms in modals feel cramped.

**Fix:** I replaced all modal-based forms with **inline page panels**. Instead of a modal overlay, the create/edit form renders as a card directly in the page flow, positioned between the page header and the table. This pattern (`showForm` boolean state driving a conditional `<div className="rounded-xl border ...">`) is used consistently across Offers, Groups, Positions, Accounts, and AdminRecruiters pages. The benefits:
- Full viewport height available for complex forms (e.g., Account edit with group linking checkboxes)
- No z-index or overlay issues
- Natural page scroll behavior
- The user sees context (the table below) while editing

**Lesson:** Inline panels are almost always better than modals for data-entry forms. Modals should be reserved for confirmations, short messages, or single-field inputs.

---

### 6. Apply Form Validation Issues

The public apply page (`client/src/pages/Apply.tsx`) went through several iterations of bugs:

#### 6a. Blank Buttons

**Problem:** The submit buttons on Login.tsx and Apply.tsx used raw `<button>` elements with custom CSS classes (`bg-accent text-white`). These classes depended on custom Tailwind tokens that may not have resolved correctly after the Tailwind v4 migration. The buttons rendered but the text was invisible — the `text-white` on a `bg-accent` background where `accent` resolved to a light color, or the custom tokens weren't generated.

**Fix:** Replaced all raw `<button>` elements with the app's `<Button>` component, which uses standard Tailwind classes (`bg-violet-600 text-white`). The `<Button>` component properly passes `children` and supports `className` for overrides. Login and Apply now import and use `<Button>`.

**Lesson:** Always use the designated component abstraction. Raw HTML elements with custom CSS are brittle across theme changes.

#### 6b. Input Masking for Phone and Nationality

**Problem:** Users could enter alphabetic characters in the Phone field and numeric characters in the Nationality field, leading to invalid data being submitted. The backend would accept these because the schema didn't have format validation.

**Fix:** Added client-side input masking inside the generic `set(field)` onChange handler:
- `if (field === 'phone') value = value.replace(/\D/g, '')` — strips any non-digit character
- `if (field === 'nationality') value = value.replace(/[0-9]/g, '')` — strips any digit

The sanitized value is set into both the form state and the displayed input value (since `<input value={form.phone}>` is controlled). This gives instant feedback with no jarring cursor jumps.

**Lesson:** Input masking is best done in the onChange handler before state update. Separate validation concerns from formatting concerns.

#### 6c. The Voca.ro URL Shortlink Validation Bug

**Problem:** The recording URL validation required the URL to contain `'vocaroo'`, `'soundcloud'`, or `'youtube'`. However, Vocaroo's URL shortener produces links like `https://voca.ro/abc123`, which does **not** contain the string `'vocaroo'`. Valid links were blocked with a confusing error message.

**Fix:** Simplified the validation to only require that the URL starts with `http://` or `https://`. Removed the domain-name substring check entirely. The validation now reads:
```ts
if (!url.startsWith('http://') && !url.startsWith('https://'))
  e.recordingUrl = 'Link must start with http:// or https://';
```

This accepts any valid web URL, including shortlinks, YouTube, SoundCloud, or any recording platform the recruiter might use.

**Lesson:** Over-validating user input creates false negatives. Validate only what's essential for the system to function, not what you *assume* the input format should be.

#### 6d. Stale hasErrors State

**Problem:** The `hasErrors` variable was computed from the `errors` React state, which was updated asynchronously via `setErrors()`. When a user fixed a validation error, `setErrors({})` was called, but until the next render, `hasErrors` (computed from the stale `errors` state) remained `true`, keeping the submit button disabled. This created a frustrating UX where the button stayed gray after the user corrected the input.

**Fix:** Changed `hasErrors` to be computed **synchronously** from the live `form` state on every render:
```ts
const hasErrors = Object.keys(validate(form)).length > 0;
```
This eliminates the one-render lag. The `errors` state is still used for displaying error text under fields (with `touched` tracking to avoid showing errors on untouched fields), but the button's disabled state is always derived from the current form data.

**Lesson:** Derived state should always be computed synchronously in the render function, not stored in state. State should only hold the source of truth, not computed values.

---

### 7. Owner's Recruiter Column in Candidates Table

**Problem:** The Owner view of the Candidates table didn't show which Recruiter each candidate belonged to. Since the Owner manages multiple recruiters, they needed to see this at a glance.

**Fix:**
- The backend (`routes/candidates.js`) already had `.populate('recruiter', 'name')` in the GET route — this was added earlier but not yet surfaced in the UI.
- Updated the `Candidate` TypeScript interface in `client/src/lib/types.ts` to allow `recruiter: string | { _id: string; name: string }` (union type for populated vs. unpopulated).
- In `Candidates.tsx`, used `useOutletContext` to get the current user's `role`. If `role === 'owner'`, a Recruiter column is conditionally spread into the columns array:
```ts
const recruiterCol = role === 'owner'
  ? [{ key: 'recruiter', header: 'Recruiter', render: (c: Candidate) => {
      const r = c.recruiter;
      return r && typeof r === 'object' ? r.name : '-';
    }}]
  : [];
```
This pattern (conditional column via spread) is reused across Offers, Groups, Positions, and Accounts tables.

**Lesson:** The Outlet context pattern in React Router is ideal for passing global auth state (role, userId) to nested route components without prop drilling.

---

### 8. Deployment to Railway with MongoDB Atlas

**Problem:** The production deployment required:
- Building the React app and serving it as static files from Express
- Connecting to MongoDB Atlas from a Railway container
- Seeding the owner account in the cloud database
- Handling session cookies across HTTP/HTTPS boundaries

**Fix:**
- The Express server (`server.js`) serves the built React app from `client/dist` as static files with `index: false` to prevent automatic index.html serving (auth is enforced via a catch-all route with `requireAuth`).
- Public routes (`/login`, `/apply/:slug`) are served before the auth check.
- The `secure` cookie flag is set based on `NODE_ENV === 'production'`, so Railway's HTTPS works correctly.
- Seeding the cloud DB: `MONGO_URI` is set to the Atlas connection string in Railway's environment variables. Running `node scripts/seed-owner.js` locally with `MONGO_URI` pointing to Atlas creates the owner directly in the cloud database.
- The Dockerfile `CMD ["node", "server.js"]` works with Railway's `PORT` environment variable (default 3000).

**Lesson:** A single Docker image that serves both API and SPA simplifies deployment. The Express catch-all pattern with `requireAuth` ensures all SPA routes are protected without client-side routing gymnastics.

---

### 9. Middleware: requireAuth and requireOwner

**Problem:** The auth middleware initially used `req.path` instead of `req.originalUrl` to determine if a request was an API call or a page navigation. This broke under certain reverse-proxy configurations (Railway) where `req.path` didn't include the full URL.

**Fix:** Changed from `req.path` to `req.originalUrl` in both `requireAuth` and `requireOwner`:
```js
if (req.originalUrl.startsWith('/api/')) {
  return res.status(401).json({ error: 'Unauthorized' });
}
return res.redirect('/login');
```

This is robust across all deployment environments because `originalUrl` preserves the full path as received by Express, while `req.path` can be affected by mount points.

**Lesson:** Always use `req.originalUrl` for path-based routing decisions in middleware. `req.path` is relative to the mount point of the router, which can change.

---

## Future Architecture: The Playwright Local Agent

The current system queues PostJobs in the database but has no automated executor. The planned architecture:

```
┌─────────────────────────────────────────────────────┐
│                  Railway (Cloud)                     │
│  ┌─────────┐   ┌──────────┐   ┌──────────────────┐ │
│  │ Express  │──▶│ MongoDB  │──▶│ PostJobs (queue) │ │
│  │ API +    │   │ Atlas    │   │ status: 'queued' │ │
│  │ React    │   │          │   │                  │ │
│  └─────────┘   └──────────┘   └────────┬─────────┘ │
│                                        │            │
└────────────────────────────────────────┼────────────┘
                                         │ poll via REST API
                                         ▼
┌─────────────────────────────────────────────────────┐
│              Local Machine (User's PC)               │
│  ┌───────────────────────────────────────────────┐  │
│  │  Playwright Agent (Node.js daemon)             │  │
│  │                                                │  │
│  │  1. Poll GET /api/post-jobs?status=queued      │  │
│  │  2. For each job:                              │  │
│  │     a. Load account session (cookie file)      │  │
│  │     b. Launch Playwright browser (headless)    │  │
│  │     c. Navigate to Facebook Group              │  │
│  │     d. Paste offer text, attach media, post    │  │
│  │     e. PUT /api/post-jobs/:id/status (posted)  │  │
│  │     f. Or mark as 'failed' with error message  │  │
│  │  3. Respect dailyPostCap per account           │  │
│  │  4. Wait random delay between posts            │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Why local?** Facebook aggressively blocks automated posting from datacenter IPs. Running Playwright on the user's own machine with their real browser fingerprint, cookies, and residential IP avoids detection entirely. The agent will be a simple Node.js CLI tool that:
- Reads account session files saved by the user's real browser
- Polls the Railway API at a configurable interval
- Executes posts with human-like timing (random delays, typing simulation)
- Reports results back to the API

This keeps the cloud architecture stateless and simple — just a CRUD API and a database — while the complex browser automation runs locally.

---

## Git History Summary

```
9f38e31 Fix URL validation to accept any http/https link, update position card styling
223994e Fix blank buttons, add user info, recruiter column, and form validation
aab492f Add route guard, apply-link button, and account-group linking
8e50683 Replace popup forms with inline page panels
81e82a2 Fix modal overflow: add min-h-0 flex-1 to scrollable body
6c5a671 Fix requireAuth/requireOwner to use req.originalUrl instead of req.path
c1706b0 Add post-job ownership check, fix silent errors, add recruiter tags, expand e2e tests
34e9945 Remove unused Playwright dependency from package.json
95ccdf3 Optimize for production deployment
00eed49 Refactor frontend UI to modern light SaaS theme
136167b my first commit
```

Each commit tells a story of a specific problem diagnosed and solved — from deployment optimization to UI refactoring to validation edge-case hardening. The project evolved from a functional but rough MVP into a production-ready SaaS with comprehensive test coverage, polished UI, and thoughtful architecture decisions guided by real-world deployment experience.
