import { Router } from 'express';
import { Webhook } from 'svix';
import crypto from 'node:crypto';
import { CampaignSend, Recipient, WebhookEvent, WhatsAppSend } from '../db.js';

const router = Router();
const SECRET = (process.env.RESEND_WEBHOOK_SECRET || '').trim();

// Resend event type -> our campaign_sends.status
const STATUS = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delayed',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
};

// higher rank wins — don't regress "clicked" back to "delivered"
const RANK = { pending: 0, sent: 1, delayed: 1, delivered: 2, opened: 3, clicked: 4, bounced: 5, complained: 5, failed: 5, unsubscribed: 5 };
const WHATSAPP_VERIFY_TOKEN = (process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '').trim();
const META_APP_SECRET = (process.env.META_APP_SECRET || '').trim();

router.get('/whatsapp', (req, res) => {
  if (WHATSAPP_VERIFY_TOKEN && req.query['hub.verify_token'] === WHATSAPP_VERIFY_TOKEN) return res.status(200).send(req.query['hub.challenge']);
  return res.sendStatus(403);
});

router.post('/whatsapp', async (req, res) => {
  try {
    if (META_APP_SECRET) {
      const signature = String(req.get('x-hub-signature-256') || '');
      const expected = `sha256=${crypto.createHmac('sha256', META_APP_SECRET).update(req.body).digest('hex')}`;
      if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return res.sendStatus(401);
    }
    const payload = JSON.parse(req.body.toString('utf8'));
    const statuses = payload?.entry?.flatMap((entry) => entry.changes || []).flatMap((change) => change.value?.statuses || []) || [];
    for (const item of statuses) {
      const status = ['sent', 'delivered', 'read', 'failed'].includes(item.status) ? item.status : null;
      if (!status || !item.id) continue;
      const update = { status, last_event_at: new Date(Number(item.timestamp || 0) * 1000 || Date.now()) };
      if (status === 'failed') update.error = item.errors?.[0]?.title || item.errors?.[0]?.message || 'Meta delivery failed';
      await WhatsAppSend.updateOne({ message_id: item.id }, { $set: update });
    }
    res.sendStatus(200);
  } catch (error) { console.error('WhatsApp webhook error:', error.message); res.sendStatus(400); }
});

// POST /api/webhooks/resend  (mounted with express.raw -> req.body is a Buffer)
router.post('/resend', async (req, res) => {
  try {
    let evt;
    if (SECRET) {
      const wh = new Webhook(SECRET);
      evt = wh.verify(req.body, {
        'svix-id': req.get('svix-id'),
        'svix-timestamp': req.get('svix-timestamp'),
        'svix-signature': req.get('svix-signature'),
      });
    } else {
      evt = JSON.parse(req.body.toString('utf8'));
    }

    const type = evt?.type;
    const emailId = evt?.data?.email_id || evt?.data?.id;
    const newStatus = STATUS[type];
    const eventId = req.get('svix-id') || evt?.id || null;
    const eventData = { provider_event_id: eventId, event_type: type || 'unknown', email_id: emailId || null, payload: evt, processed: false };
    if (eventId && await WebhookEvent.exists({ provider_event_id: eventId })) return res.json({ ok: true, duplicate: true });
    const stored = await WebhookEvent.create(eventData).catch((error) => (error?.code === 11000 ? null : Promise.reject(error)));
    if (!stored) return res.json({ ok: true, duplicate: true });

    if (emailId && newStatus) {
      const send = await CampaignSend.findOne({ resend_id: emailId });
      if (send && (RANK[newStatus] ?? 0) >= (RANK[send.status] ?? 0)) {
        send.status = newStatus;
        const now = new Date(evt?.created_at || Date.now());
        send.last_event_at = now;
        if (newStatus === 'delivered' && !send.delivered_at) send.delivered_at = now;
        if (newStatus === 'opened' && !send.opened_at) send.opened_at = now;
        if (newStatus === 'clicked' && !send.clicked_at) send.clicked_at = now;
        await send.save();
      }
      if (type === 'email.bounced' || type === 'email.complained') {
        const to = Array.isArray(evt?.data?.to) ? evt.data.to[0] : evt?.data?.to;
        if (to) await Recipient.updateOne({ email: String(to).toLowerCase() }, { unsubscribed: true });
      }
    }
    if (stored) { stored.processed = true; await stored.save(); }
    res.json({ ok: true });
  } catch (e) {
    console.error('webhook error:', e.message);
    res.status(400).json({ error: 'invalid webhook' });
  }
});

export default router;
