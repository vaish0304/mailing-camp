import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { initDb, pingDb, Recipient } from './db.js';
import { requireAuth, authEnabled } from './auth.js';
import { FROM } from './mailer.js';
import groupsRouter from './routes/groups.js';
import recipientsRouter from './routes/recipients.js';
import campaignsRouter from './routes/campaigns.js';
import hooksRouter from './routes/hooks.js';
import projectsRouter from './routes/projects.js';

const app = express();
app.set('trust proxy', 1);

// Accept a comma-separated list; tolerate trailing slashes / casing so a
// value like "https://app.vercel.app/" still matches the browser's Origin.
const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, '').toLowerCase())
  .filter(Boolean);
const allowAllOrigins = allowedOrigins.includes('*');
app.use(cors({
  origin(origin, cb) {
    if (allowAllOrigins || !origin) return cb(null, true);
    cb(null, allowedOrigins.includes(origin.replace(/\/+$/, '').toLowerCase()));
  },
}));

// Webhooks need the raw body for signature verification -> mount before json()
app.use('/api/webhooks', express.raw({ type: '*/*', limit: '1mb' }), hooksRouter);

app.use(express.json({ limit: '2mb' }));

// --- public endpoints ---
app.get('/api/health', async (_req, res) => {
  try {
    await pingDb();
    res.json({ ok: true, from: FROM, authRequired: authEnabled });
  } catch (e) {
    res.status(503).json({ ok: false, error: String(e.message || e) });
  }
});

// One-click unsubscribe (linked from the email footer + List-Unsubscribe header)
app.get('/api/unsubscribe', async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (email) await Recipient.updateOne({ email }, { unsubscribed: true }).catch(() => {});
  res.set('Content-Type', 'text/html').send(
    `<!doctype html><meta charset="utf-8"><title>Unsubscribed</title>
     <div style="font-family:Arial,sans-serif;max-width:480px;margin:80px auto;text-align:center">
       <h2>You're unsubscribed</h2>
       <p>${email || 'This address'} will no longer receive campaign emails from us.</p>
     </div>`,
  );
});
app.post('/api/unsubscribe', express.urlencoded({ extended: false }), async (req, res) => {
  const email = String(req.query.email || req.body.email || '').trim().toLowerCase();
  if (email) await Recipient.updateOne({ email }, { unsubscribed: true }).catch(() => {});
  res.json({ ok: true });
});

// --- protected API ---
app.use('/api/groups', requireAuth, groupsRouter);
app.use('/api/projects', requireAuth, projectsRouter);
app.use('/api/recipients', requireAuth, recipientsRouter);
app.use('/api/campaigns', requireAuth, campaignsRouter);

// error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'payload too large' });
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'file too large (max 10 MB)' });
  res.status(500).json({ error: String(err?.message || err) });
});

const PORT = process.env.PORT || 8080;
initDb()
  .then(() => app.listen(PORT, () => console.log(`mailing-camp backend on :${PORT} — from ${FROM}`)))
  .catch((e) => { console.error('startup failed:', e); process.exit(1); });
