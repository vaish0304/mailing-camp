import { Router } from 'express';
import { Webhook } from 'svix';
import { CampaignSend, Recipient, WebhookEvent } from '../db.js';

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
