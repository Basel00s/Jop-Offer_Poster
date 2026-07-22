# Job Poster

Manage job offers and target Facebook groups, as a base for automated posting later.

Stack: Node.js + Express + MongoDB (Mongoose) on the backend, plain HTML/CSS/JS on the frontend.

## What's here right now

- **Offers** — add, edit, pause, delete job offers (title + description)
- **Groups** — add, edit, pause, delete the Facebook groups you post into (name, URL, notes)

Both are stored in MongoDB so the Playwright posting worker (next step) can just read
`status: active` offers and groups and post them — no code changes needed there.

## Setup

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
