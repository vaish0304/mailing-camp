import { Router } from 'express';
import mongoose from 'mongoose';
import { Campaign, CampaignSend, Recipient } from '../db.js';
import {
  FROM, REPLY_TO, renderTemplate, sendBatch, withUnsubFooter, unsubscribeUrl,
} from '../mailer.js';

const router = Router();
const DAILY_SEND_LIMIT = Math.min(Math.max(Number(process.env.DAILY_SEND_LIMIT) || 100, 1), 10000);
const SEND_GAP_MS = Math.max(Number(process.env.BATCH_DELAY_MS) || 1000, 1000);
const COMPLETED_STATUSES = ['sent', 'delivered', 'opened', 'clicked', 'delayed'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isId = (v) => mongoose.isValidObjectId(v);

async function recipientsForGroups(groupIds, excludePreviouslySent = false) {
  const filter = { groups: { $in: groupIds }, unsubscribed: false };
  if (excludePreviouslySent) {
    const completedIds = await CampaignSend.distinct('recipient_id', { status: { $in: COMPLETED_STATUSES }, recipient_id: { $ne: null } });
    if (completedIds.length) filter._id = { $nin: completedIds };
  }
  return Recipient.find(filter)
    .sort({ email: 1 })
    .lean();
}

function startOfToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function dailyUsage() {
  return CampaignSend.countDocuments({
    status: { $in: COMPLETED_STATUSES },
    created_at: { $gte: startOfToday() },
  });
}

router.get('/limits', async (_req, res, next) => {
  try {
    const used = await dailyUsage();
    res.json({ dailyLimit: DAILY_SEND_LIMIT, used, remaining: Math.max(DAILY_SEND_LIMIT - used, 0), sendGapMs: SEND_GAP_MS });
  } catch (e) { next(e); }
});

// GET /api/campaigns
router.get('/', async (_req, res, next) => {
  try {
    const rows = await Campaign.find().sort({ created_at: -1 }).limit(100);
    res.json(rows.map((c) => c.toJSON()));
  } catch (e) { next(e); }
});

// GET /api/campaigns/:id
router.get('/:id', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'not found' });
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'not found' });

    const [sends, statsAgg] = await Promise.all([
      CampaignSend.find({ campaign_id: campaign._id }).sort({ email: 1 }),
      CampaignSend.aggregate([
        { $match: { campaign_id: campaign._id } },
        { $group: { _id: '$status', n: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      campaign: campaign.toJSON(),
      sends: sends.map((s) => s.toJSON()),
      stats: Object.fromEntries(statsAgg.map((s) => [s._id, s.n])),
    });
  } catch (e) { next(e); }
});

// DELETE /api/campaigns/:id  (removes the campaign + its per-recipient send rows)
router.delete('/:id', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'not found' });
    const campaign = await Campaign.findByIdAndDelete(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'not found' });
    await CampaignSend.deleteMany({ campaign_id: campaign._id });
    res.status(204).end();
  } catch (e) { next(e); }
});

// POST /api/campaigns/preview  { subject, html, groupIds, excludePreviouslySent? }
router.post('/preview', async (req, res, next) => {
  try {
    const groupIds = (req.body?.groupIds || []).filter(isId);
    if (!groupIds.length) return res.status(400).json({ error: 'groupIds required' });
    const recipients = await recipientsForGroups(groupIds, Boolean(req.body?.excludePreviouslySent));
    const sample = recipients[0] || {
      email: 'sample@example.com', first_name: 'Rahul', company: 'Sharma Electronics', city: 'Pune',
    };
    res.json({
      recipientCount: recipients.length,
      sampleRecipient: sample,
      renderedSubject: renderTemplate(req.body?.subject || '', sample),
      renderedHtml: withUnsubFooter(renderTemplate(req.body?.html || '', sample), sample.email),
    });
  } catch (e) { next(e); }
});

// POST /api/campaigns/test  { subject, html, email }
router.post('/test', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'email required' });
    const ctx = { email, first_name: 'Rahul', last_name: 'Sharma', company: 'Sharma Electronics', city: 'Pune', phone: '' };
    const data = await sendBatch([{
      to: email,
      subject: `[TEST] ${renderTemplate(req.body?.subject || '(no subject)', ctx)}`,
      html: withUnsubFooter(renderTemplate(req.body?.html || '', ctx), email),
    }]);
    res.json({ ok: true, id: data?.data?.[0]?.id });
  } catch (e) { next(e); }
});

// POST /api/campaigns  { subject, html, groupIds, projectId?, targetLimit?, excludePreviouslySent? }
router.post('/', async (req, res, next) => {
  try {
    const subject = String(req.body?.subject || '').trim();
    const html = String(req.body?.html || '').trim();
    const groupIds = [...new Set((req.body?.groupIds || []).filter(isId).map(String))];
    const projectId = isId(req.body?.projectId) ? req.body.projectId : null;
    if (!subject) return res.status(400).json({ error: 'subject is required' });
    if (!html) return res.status(400).json({ error: 'html body is required' });
    if (!groupIds.length) return res.status(400).json({ error: 'select at least one group' });

    const excludePreviouslySent = req.body?.excludePreviouslySent !== false;
    const audience = await recipientsForGroups(groupIds, excludePreviouslySent);
    if (!audience.length) return res.status(422).json({ error: excludePreviouslySent ? 'All active contacts in those groups have already been mailed' : 'those groups have no active recipients' });
    const usedToday = await dailyUsage();
    const remainingToday = Math.max(DAILY_SEND_LIMIT - usedToday, 0);
    if (!remainingToday) return res.status(429).json({ error: `Daily limit of ${DAILY_SEND_LIMIT} emails has been reached. Try again tomorrow.` });
    const requestedLimit = Math.min(Math.max(Number(req.body?.targetLimit) || remainingToday, 1), DAILY_SEND_LIMIT);
    const recipients = audience.slice(0, Math.min(requestedLimit, remainingToday));

    const campaign = await Campaign.create({
      subject, html, from_email: FROM, reply_to: REPLY_TO || null,
      group_ids: groupIds, project_id: projectId, status: 'sending', total_recipients: recipients.length,
      audience_count: audience.length, deferred_count: Math.max(audience.length - recipients.length, 0),
    });

    await CampaignSend.insertMany(
      recipients.map((r) => ({ campaign_id: campaign._id, recipient_id: r._id, email: r.email })),
    );

    // fire-and-forget; frontend polls GET /api/campaigns/:id
    runCampaign(campaign._id, { subject, html }, recipients).catch(async (e) => {
      console.error(`campaign ${campaign._id} failed:`, e);
      await Campaign.findByIdAndUpdate(campaign._id, { status: 'failed', error: String(e.message || e) }).catch(() => {});
    });

    res.status(202).json({
      id: String(campaign._id), status: 'sending', totalRecipients: recipients.length,
      audienceCount: audience.length, deferredCount: campaign.deferred_count,
      excludesPreviouslySent: excludePreviouslySent,
      dailyRemainingAfterStart: Math.max(remainingToday - recipients.length, 0),
    });
  } catch (e) { next(e); }
});

async function runCampaign(campaignId, { subject, html }, recipients) {
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i += 1) {
    const chunk = recipients.slice(i, i + 1);
    const messages = chunk.map((r) => {
      const unsub = unsubscribeUrl(r.email);
      return {
        to: r.email,
        subject: renderTemplate(subject, r),
        html: withUnsubFooter(renderTemplate(html, r), r.email),
        headers: unsub
          ? { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
          : undefined,
      };
    });

    try {
      const data = await sendBatch(messages);
      const ids = data?.data || [];
      await Promise.all(chunk.map((r, j) => CampaignSend.updateOne(
        { campaign_id: campaignId, email: r.email },
        { status: 'sent', resend_id: ids[j]?.id || null },
      )));
      sent += chunk.length;
    } catch (e) {
      const msg = String(e.message || e).slice(0, 500);
      await CampaignSend.updateMany(
        { campaign_id: campaignId, email: { $in: chunk.map((r) => r.email) } },
        { status: 'failed', error: msg },
      );
      failed += chunk.length;
    }

    await Campaign.findByIdAndUpdate(campaignId, { sent_count: sent, failed_count: failed });
    if (i + 1 < recipients.length) await sleep(SEND_GAP_MS);
  }

  await Campaign.findByIdAndUpdate(campaignId, {
    status: failed === 0 ? 'sent' : (sent === 0 ? 'failed' : 'partial'),
    sent_count: sent,
    failed_count: failed,
    sent_at: new Date(),
  });
  console.log(`campaign ${campaignId} done: ${sent} sent, ${failed} failed`);
}

export default router;
