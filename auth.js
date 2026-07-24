// Requires an X-Api-Token header (or ?token= query param) matching API_TOKEN.
// If API_TOKEN isn't set (local dev default), the check is skipped entirely.
function requireToken(req, res, next) {
  const expected = process.env.API_TOKEN;
  if (!expected) return next();

  const provided = req.get('x-api-token') || req.query.token;
  if (provided === expected) return next();

  res.status(401).json({ error: 'invalid or missing API token' });
}

module.exports = { requireToken };
