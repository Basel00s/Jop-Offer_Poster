function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.redirect('/login');
}

function requireOwner(req, res, next) {
  if (req.session && req.session.role === 'owner') {
    return next();
  }

  if (req.path.startsWith('/api/')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return res.status(403).send('Forbidden');
}

module.exports = { requireAuth, requireOwner };
