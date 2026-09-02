const TOKEN = (process.env.ADMIN_TOKEN || '').trim();

/**
 * Bearer-token gate. If ADMIN_TOKEN is unset the API is open (local dev only).
 */
export function requireAuth(req, res, next) {
  if (!TOKEN) return next();
  const header = req.get('authorization') || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (provided && provided === TOKEN) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

export const authEnabled = Boolean(TOKEN);
