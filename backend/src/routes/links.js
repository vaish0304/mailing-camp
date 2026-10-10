import crypto from 'node:crypto';
import { Router } from 'express';
import mongoose from 'mongoose';
import { CampaignSend, LinkClick, TrackedLink } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
const BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
const isId = (value) => mongoose.isValidObjectId(value);

function cleanDestination(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
}

const publicUrl = (token) => `${BASE_URL}/api/t/${token}`;

router.get('/t/:token', async (req, res) => {
  const link = await TrackedLink.findOne({ token: req.params.token });
  if (!link) return res.status(404).send('Tracked link not found');
  const sendId = isId(req.query.sid) ? req.query.sid : null;
  const campaignId = isId(req.query.cid) ? req.query.cid : null;
  const fingerprint = crypto.createHash('sha256').update(`${sendId || ''}|${req.get('user-agent') || ''}`).digest('hex');
  const unique = !(await LinkClick.exists({ tracked_link_id: link._id, fingerprint }));
  const now = new Date();
  await Promise.all([
    LinkClick.create({
      tracked_link_id: link._id, campaign_id: campaignId, campaign_send_id: sendId,
      fingerprint, user_agent: String(req.get('user-agent') || '').slice(0, 500),
      referer: String(req.get('referer') || '').slice(0, 500),
    }),
    TrackedLink.updateOne({ _id: link._id }, { $inc: { click_count: 1, unique_click_count: unique ? 1 : 0 }, last_clicked_at: now }),
    sendId ? CampaignSend.updateOne({ _id: sendId }, { status: 'clicked', clicked_at: now, last_event_at: now }) : Promise.resolve(),
  ]);
  res.set('Cache-Control', 'no-store').redirect(302, link.destination_url);
});

router.get('/links', requireAuth, async (req, res, next) => {
  try {
    const query = isId(req.query.projectId) ? { project_id: req.query.projectId } : {};
    const rows = await TrackedLink.find(query).sort({ created_at: -1 }).limit(200);
    res.json(rows.map((row) => ({ ...row.toJSON(), tracked_url: publicUrl(row.token) })));
  } catch (error) { next(error); }
});

router.post('/links', requireAuth, async (req, res, next) => {
  try {
    if (!BASE_URL) return res.status(503).json({ error: 'PUBLIC_BASE_URL is required for tracked links' });
    const destination = cleanDestination(req.body?.destinationUrl);
    if (!destination) return res.status(400).json({ error: 'a valid HTTP or HTTPS destination URL is required' });
    const name = String(req.body?.name || new URL(destination).hostname).trim().slice(0, 120);
    const row = await TrackedLink.create({
      token: crypto.randomBytes(12).toString('base64url'), name, destination_url: destination,
      project_id: isId(req.body?.projectId) ? req.body.projectId : null,
    });
    res.status(201).json({ ...row.toJSON(), tracked_url: publicUrl(row.token) });
  } catch (error) { next(error); }
});

router.delete('/links/:id', requireAuth, async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'not found' });
    const row = await TrackedLink.findByIdAndDelete(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    await LinkClick.deleteMany({ tracked_link_id: row._id });
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
