require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const connectDB = require('./db');

const { requireAuth, requireOwner } = require('./middleware/auth');
const authRouter = require('./routes/auth');
const publicRouter = require('./routes/public');
const offersRouter = require('./routes/offers');
const groupsRouter = require('./routes/groups');
const accountsRouter = require('./routes/accounts');
const postJobsRouter = require('./routes/postJobs');
const candidatesRouter = require('./routes/candidates');
const positionsRouter = require('./routes/positions');
const adminRouter = require('./routes/admin');

const app = express();

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
  }
}));

app.use(cors());
app.use(express.json());

// Serve SPA static assets (JS, CSS, images — not sensitive, no auth needed)
// `index: false` prevents auto-serving index.html for `/`, so auth is enforced
// on page routes via the catch-all below.
app.use(express.static(path.join(__dirname, 'client', 'dist'), { index: false }));

// Auth routes - no auth required
app.use('/api/auth', authRouter);

// Public routes - no auth required
app.use('/api/public', publicRouter);

// SPA public pages (no auth)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});
app.get('/apply/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

// Protected API routes
app.use('/api/offers', requireAuth, offersRouter);
app.use('/api/groups', requireAuth, groupsRouter);
app.use('/api/accounts', requireAuth, accountsRouter);
app.use('/api/post-jobs', requireAuth, postJobsRouter);
app.use('/api/candidates', requireAuth, candidatesRouter);
app.use('/api/positions', requireAuth, positionsRouter);
app.use('/api/admin', requireAuth, requireOwner, adminRouter);

// SPA fallback — catch-all for protected SPA routes (dashboard, accounts, etc.)
// express.static has already tried to serve a real file; if none matched and
// the path isn't an API route, serve index.html so React Router can handle it.
app.get('*', requireAuth, (req, res) => {
  if (req.path.startsWith('/api/')) return;
  if (path.extname(req.path)) return;
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`[Server] Running at http://localhost:${PORT}`);
  });
});
