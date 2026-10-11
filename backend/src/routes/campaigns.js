import { Router } from 'express';
import mongoose from 'mongoose';
import { Campaign, CampaignSend, Group, Recipient } from '../db.js';
import {
  FROM, REPLY_TO, brochureAttachment, renderTemplate, sendBatch, withUnsubFooter, unsubscribeUrl,
} from '../mailer.js';

const router = Router();
const DAILY_SEND_LIMIT = Math.min(Math.max(Number(process.env.DAILY_SEND_LIMIT) || 100, 1), 10000);
const SEND_GAP_MS = Math.max(Number(process.env.BATCH_DELAY_MS) || 1000, 1000);
const COMPLETED_STATUSES = ['sent', 'delivered', 'opened', 'clicked', 'delayed', 'unsubscribed'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isId = (v) => mongoose.isValidObjectId(v);

async function recipientsForGroups(groupIds, excludePreviouslySent = false) {
  const recipients = await Recipient.find({ groups: { $in: groupIds }, unsubscribed: false })
    .sort({ email: 1 })
    .lean();
  if (!excludePreviouslySent || !recipients.length) return recipients;

  const groups = await Group.find({ _id: { $in: groupIds } }).select('_id progress_reset_at').lean();
  const resets = new Map(groups.map((group) => [String(group._id), group.progress_reset_at || new Date(0)]));
  const sentRows = await CampaignSend.find({
    recipient_id: { $in: recipients.map((recipient) => recipient._id) },
    status: { $in: COMPLETED_STATUSES },
  }).select('recipient_id created_at').lean();
  const sentAt = new Map();
  for (const row of sentRows) {
    const id = String(row.recipient_id);
    const rows = sentAt.get(id) || [];
    rows.push(row.created_at);
    sentAt.set(id, rows);
  }
  return recipients.filter((recipient) => {
    const selectedGroups = recipient.groups.map(String).filter((id) => resets.has(id));
    return selectedGroups.some((groupId) => !(sentAt.get(String(recipient._id)) || []).some((date) => date >= resets.get(groupId)));
  });
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

// GET /api/campaigns/experiments — grouped performance for template comparisons.
router.get('/experiments', async (_req, res, next) => {
  try {
    const projectId = isId(_req.query?.projectId) ? _req.query.projectId : null;
    const filter = { experiment_id: { $ne: null } };
    if (projectId) filter.project_id = projectId;
    const campaigns = await Campaign.find(filter).sort({ created_at: -1 }).limit(100).lean();
    const ids = campaigns.map((campaign) => campaign._id);
    const rows = ids.length ? await CampaignSend.aggregate([
      { $match: { campaign_id: { $in: ids } } },
      { $group: { _id: { campaign_id: '$campaign_id', status: '$status' }, count: { $sum: 1 } } },
    ]) : [];
    const counts = new Map();
    for (const row of rows) {
      const id = String(row._id.campaign_id);
      const current = counts.get(id) || {};
      current[row._id.status] = row.count;
      counts.set(id, current);
    }
    const grouped = new Map();
    for (const campaign of campaigns) {
      const experiment = grouped.get(campaign.experiment_id) || { id: campaign.experiment_id, created_at: campaign.created_at, variants: [] };
      const statuses = counts.get(String(campaign._id)) || {};
      const sent = Object.entries(statuses).reduce((sum, [status, count]) => sum + (status === 'pending' || status === 'failed' ? 0 : count), 0);
      experiment.variants.push({
        id: String(campaign._id), name: campaign.variant_name || campaign.variant_id || 'Variation', status: campaign.status,
        total: campaign.total_recipients, sent, failed: statuses.failed || 0, delivered: statuses.delivered || 0,
        opened: statuses.opened || 0, clicked: statuses.clicked || 0, bounced: statuses.bounced || 0,
        complained: statuses.complained || 0,
      });
      grouped.set(campaign.experiment_id, experiment);
    }
    res.json([...grouped.values()]);
  } catch (e) { next(e); }
});

// POST /api/campaigns/experiments — split a small, non-overlapping audience sample between variants.
router.post('/experiments', async (req, res, next) => {
  try {
    const groupIds = [...new Set((req.body?.groupIds || []).filter(isId).map(String))];
    const projectId = isId(req.body?.projectId) ? req.body.projectId : null;
    const variants = (req.body?.variants || []).slice(0, 4).map((variant) => ({
      id: String(variant?.id || '').trim().slice(0, 80), name: String(variant?.name || '').trim().slice(0, 120),
      subject: String(variant?.subject || '').trim(), html: String(variant?.html || '').trim(),
    })).filter((variant) => variant.id && variant.name && variant.subject && variant.html);
    if (!groupIds.length) return res.status(400).json({ error: 'select at least one audience group' });
    if (variants.length < 2) return res.status(400).json({ error: 'select at least two complete template variations' });

    const perVariant = Math.min(Math.max(Number(req.body?.perVariant) || 5, 1), 25);
    const audience = await recipientsForGroups(groupIds, true);
    const usedToday = await dailyUsage();
    const remainingToday = Math.max(DAILY_SEND_LIMIT - usedToday, 0);
    const capacity = Math.min(audience.length, remainingToday, perVariant * variants.length);
    const recipientsPerVariant = Math.floor(capacity / variants.length);
    if (!recipientsPerVariant) return res.status(422).json({ error: 'Not enough eligible contacts or daily sending capacity for every selected variation' });

    const experimentId = new mongoose.Types.ObjectId().toString();
    const recipients = audience.slice(0, recipientsPerVariant * variants.length);
    const created = [];
    for (let index = 0; index < variants.length; index += 1) {
      const variant = variants[index];
      const sample = recipients.slice(index * recipientsPerVariant, (index + 1) * recipientsPerVariant);
      const campaign = await Campaign.create({
        subject: variant.subject, html: variant.html, from_email: FROM, reply_to: REPLY_TO || null,
        group_ids: groupIds, project_id: projectId, experiment_id: experimentId, variant_id: variant.id,
        variant_name: variant.name, status: 'sending', total_recipients: sample.length,
        audience_count: sample.length, deferred_count: 0,
      });
      await CampaignSend.insertMany(sample.map((recipient) => ({ campaign_id: campaign._id, recipient_id: recipient._id, email: recipient.email })));
      created.push({ campaign, sample, variant });
    }

    // Run the variants one after another so every recipient send retains the configured gap.
    runExperiment(created).catch(async (error) => {
      console.error(`experiment ${experimentId} failed:`, error);
      await Campaign.updateMany({ experiment_id: experimentId, status: 'sending' }, { $set: { status: 'failed', error: String(error.message || error) } }).catch(() => {});
    });
    res.status(202).json({ id: experimentId, perVariant: recipientsPerVariant, totalRecipients: recipients.length, variants: created.map(({ campaign, variant }) => ({ id: String(campaign._id), name: variant.name })) });
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
    const recipients = groupIds.length
      ? await recipientsForGroups(groupIds, Boolean(req.body?.excludePreviouslySent))
      : [];
    const sample = recipients[0] || {
      email: 'sample@example.com', first_name: 'Rahul', company: 'Sharma Electronics', city: 'Pune',
    };
    res.json({
      recipientCount: recipients.length,
      sampleRecipient: sample,
      renderedSubject: renderTemplate(req.body?.subject || '', sample),
      renderedHtml: withUnsubFooter(renderTemplate(req.body?.html || '', sample), sample.email),
      attachments: req.body?.attachBrochure ? [{ filename: 'AI-Sales-Assistant-Brochure.png', type: 'image/png' }] : [],
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
      attachments: req.body?.attachBrochure ? [brochureAttachment()] : undefined,
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
      attach_brochure: Boolean(req.body?.attachBrochure),
    });

    await CampaignSend.insertMany(
      recipients.map((r) => ({ campaign_id: campaign._id, recipient_id: r._id, email: r.email })),
    );

    // fire-and-forget; frontend polls GET /api/campaigns/:id
    runCampaign(campaign._id, { subject, html, attachBrochure: Boolean(req.body?.attachBrochure) }, recipients).catch(async (e) => {
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

async function runCampaign(campaignId, { subject, html, attachBrochure }, recipients) {
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i += 1) {
    const chunk = recipients.slice(i, i + 1);
    const sendRows = await CampaignSend.find({ campaign_id: campaignId, email: { $in: chunk.map((r) => r.email) } }).lean();
    const sendByEmail = new Map(sendRows.map((row) => [row.email, row]));
    const messages = chunk.map((r) => {
      const sendRow = sendByEmail.get(r.email);
      const unsub = unsubscribeUrl(r.email, campaignId);
      let renderedHtml = renderTemplate(html, r);
      if (sendRow) {
        renderedHtml = renderedHtml.replace(/href=(['"])(https?:\/\/[^'"\s>]+\/api\/t\/[A-Za-z0-9_-]+)([^'"]*)\1/gi, (_m, quote, url, query) => {
          const separator = query.includes('?') ? '&amp;' : '?';
          return `href=${quote}${url}${query}${separator}cid=${campaignId}&amp;sid=${sendRow._id}${quote}`;
        });
      }
      return {
        to: r.email,
        subject: renderTemplate(subject, r),
        html: withUnsubFooter(renderedHtml, r.email, campaignId),
        attachments: attachBrochure ? [brochureAttachment()] : undefined,
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

async function runExperiment(items) {
  for (const { campaign, sample, variant } of items) {
    await runCampaign(campaign._id, { subject: variant.subject, html: variant.html, attachBrochure: false }, sample);
  }
}

export default router;
