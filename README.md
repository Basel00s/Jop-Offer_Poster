# Job Poster

Manage job offers and target Facebook groups, as a base for automated posting later.

Stack: Node.js + Express + MongoDB (Mongoose) on the backend, plain HTML/CSS/JS on the frontend.

## What's here right now

- **Offers** — add, edit, pause, delete job offers (title + description)
- **Groups** — add, edit, pause, delete the Facebook groups you post into (name, URL, notes)

Both are stored in MongoDB so the Playwright posting worker (next step) can just read
`status: active` offers and groups and post them — no code changes needed there.

## Setup (local — no Docker)

1. Install MongoDB locally, or get a free connection string from MongoDB Atlas.
2. `npm install`
3. `cp .env.example .env` and set `MONGO_URI` (and `PORT` if you want something other than 3000).
4. `npm start` (or `npm run dev` to auto-restart on file changes).
5. Open `http://localhost:3000`.

## Project structure

```
job-poster/
├── server.js          # Express app entrypoint
├── db.js              # Mongo connection
├── models/
│   ├── Offer.js        # title, description, status
│   └── Group.js        # name, url, notes, status
├── routes/
│   ├── offers.js        # /api/offers CRUD
│   └── groups.js        # /api/groups CRUD
├── public/             # vanilla frontend, served statically by Express
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
└── playwright/          # empty for now — the posting worker goes here next
```

## API

| Method | Path              | Body                                    |
|--------|-------------------|------------------------------------------|
| GET    | /api/offers       | —                                        |
| POST   | /api/offers       | `{ title, description, status? }`       |
| PUT    | /api/offers/:id   | `{ title, description, status }`        |
| DELETE | /api/offers/:id   | —                                        |
| GET    | /api/groups       | —                                        |
| POST   | /api/groups       | `{ name, url, notes?, status? }`         |
| PUT    | /api/groups/:id   | `{ name, url, notes, status }`           |
| DELETE | /api/groups/:id   | —                                        |

## Next step (not built yet)

A `playwright/` worker that:
- Loads `active` offers and `active` groups from Mongo
- Posts each offer into each group with randomized delays
- Logs each attempt (success/pending-approval/failed) back to Mongo
- Backs off automatically if it hits a checkpoint/captcha page

Say the word when you want that built — it'll reuse the same session-storage pattern
your old JARVIS project used (`storage_state` from a logged-in browser context) so you
don't have to re-login every run.

## Docker

The app runs in two modes that share the same `sessions/` folder, so you can switch between them without re-authenticating Facebook accounts.

### Architecture

```
Host machine (has a screen)

npm run dev                  docker compose up
┌──────────────────┐        ┌──────────────────────────┐
│  Node server      │        │  app container           │
│  (headful         │        │  (headless Chromium      │
│   Chromium        │        │   for future posting)    │
│   for login)      │        │                          │
└───────┬──────────┘        └────────────┬─────────────┘
        │                                 │
        ├────── sessions/ (shared) ───────┤
        │                                 │
        │         ┌───────────────────────┴──────┐
        └─────────┤  mongo container              │
                  │  (mongodb://mongo:            │
                  │   27017/job-poster)           │
                  └──────────────────────────────┘
```

### (a) Adding / re-logging a Facebook account (one-time — run on the host)

The Facebook login step **must** run directly on your machine with a visible screen — it opens a real Chromium window for manual authentication. Do **not** try to do this inside Docker.

```bash
# Ensure MongoDB is running locally (or use Atlas)
npm install
cp .env.example .env
npm run dev
```

Then go to the Accounts page in the app and click "Connect Facebook" for any account. A Chromium window opens — log into Facebook manually, then click the "Done — Save Session" button. The session file is saved to `sessions/<accountId>.json` on your host.

### (b) Running the full app day-to-day (Docker)

Once accounts are connected, run everything with Docker:

```bash
docker compose up --build
```

The app is available at `http://localhost:3000`. The future posting engine runs headless Chromium inside the container using the saved session files.

### (c) Both modes share the same sessions

- When you run `npm run dev` locally, sessions are stored in `./sessions/` on your host.
- When you run `docker compose up`, the `./sessions` directory on your host is mounted at `/app/sessions` inside the container.
- Login once locally, then the container picks up the same sessions without re-authentication.
- You can switch back and forth freely — no conflicts.

### Environment variables for Docker

Your `.env` file works as-is. The `docker-compose.yml` overrides `MONGO_URI` to use `mongo` (the Docker service name) instead of `localhost`. All other variables (`SESSION_SECRET`, `SITE_PASSWORD`) come from `.env`.

## Database backups

A backup script is provided at `scripts/backup-mongo.sh`. It runs `mongodump` against the `mongo` container, saves a timestamped `.archive` to `backups/`, and prunes archives older than 14 days.

Schedule it daily via the host's crontab (example — runs at 3am):

```cron
0 3 * * * cd /path/to/job-poster && bash scripts/backup-mongo.sh
```
