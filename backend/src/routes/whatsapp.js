import { Router } from 'express';
import mongoose from 'mongoose';
import { Group, Recipient, WhatsAppCampaign, WhatsAppSend } from '../db.js';
import { renderTemplate } from '../mailer.js';

const router = Router();
const isId = (value) => mongoose.isValidObjectId(value);
const DAILY_LIMIT = Math.min(Math.max(Number(process.env.WHATSAPP_DAILY_SEND_LIMIT) || 100, 1), 10000);
const SEND_GAP_MS = Math.max(Number(process.env.WHATSAPP_SEND_GAP_MS) || 1000, 1000);
const GRAPH_VERSION = (process.env.WHATSAPP_GRAPH_VERSION || 'v23.0').replace(/^v?/, 'v');
const ACCESS_TOKEN = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
const PHONE_NUMBER_ID = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function configured() { return Boolean(ACCESS_TOKEN && PHONE_NUMBER_ID); }
function normalisePhone(value) { return String(value || '').replace(/\D/g, ''); }
function startOfToday() { const now = new Date(); return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); }
async function dailyUsage() { return WhatsAppSend.countDocuments({ status: { $in: ['sent', 'delivered', 'read'] }, created_at: { $gte: startOfToday() } }); }

router.get('/status', async (_req, res, next) => {
  try {
    const used = await dailyUsage();
    res.json({ configured: configured(), dailyLimit: DAILY_LIMIT, used, remaining: Math.max(DAILY_LIMIT - used, 0), sendGapMs: SEND_GAP_MS, graphVersion: GRAPH_VERSION });
  } catch (error) { next(error); }
});

router.get('/campaigns', async (req, res, next) => {
  try {
    const filter = isId(req.query.projectId) ? { project_id: req.query.projectId } : {};
    res.json((await WhatsAppCampaign.find(filter).sort({ created_at: -1 }).limit(100)).map((campaign) => campaign.toJSON()));
  } catch (error) { next(error); }
});

router.get('/campaigns/:id', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'not found' });
    const campaign = await WhatsAppCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'not found' });
    const sends = await WhatsAppSend.find({ campaign_id: campaign._id }).sort({ phone: 1 });
    res.json({ campaign: campaign.toJSON(), sends: sends.map((send) => send.toJSON()) });
  } catch (error) { next(error); }
});

router.post('/campaigns', async (req, res, next) => {
  try {
    if (!configured()) return res.status(409).json({ error: 'WhatsApp is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID on the backend.' });
    const groupIds = [...new Set((req.body?.groupIds || []).filter(isId).map(String))];
    const templateName = String(req.body?.templateName || '').trim().toLowerCase();
    const languageCode = String(req.body?.languageCode || 'en_US').trim();
    const bodyValues = Array.isArray(req.body?.bodyValues) ? req.body.bodyValues.map((value) => String(value || '').trim()).filter(Boolean).slice(0, 10) : [];
    const projectId = isId(req.body?.projectId) ? req.body.projectId : null;
    const targetLimit = Math.min(Math.max(Number(req.body?.targetLimit) || DAILY_LIMIT, 1), DAILY_LIMIT);
    if (!groupIds.length) return res.status(400).json({ error: 'select at least one audience group' });
    if (!/^[a-z0-9_]{1,512}$/.test(templateName)) return res.status(400).json({ error: 'use the approved Meta template name (lowercase letters, numbers and underscores)' });

    const groups = await Group.find({ _id: { $in: groupIds } }).select('_id').lean();
    if (groups.length !== groupIds.length) return res.status(404).json({ error: 'one or more audience groups were not found' });
    const recipients = await Recipient.find({ groups: { $in: groupIds }, unsubscribed: false, whatsapp_opt_in: true, phone: { $nin: [null, ''] } }).sort({ email: 1 }).lean();
    const uniqueByPhone = new Map();
    for (const recipient of recipients) { const phone = normalisePhone(recipient.phone); if (phone.length >= 8 && !uniqueByPhone.has(phone)) uniqueByPhone.set(phone, recipient); }
    const unique = [...uniqueByPhone.values()];
    const used = await dailyUsage(); const remaining = Math.max(DAILY_LIMIT - used, 0);
    const audience = unique.slice(0, Math.min(targetLimit, remaining));
    if (!audience.length) return res.status(422).json({ error: remaining ? 'No consented contacts with a valid WhatsApp number in these groups' : `Daily WhatsApp limit of ${DAILY_LIMIT} has been reached.` });

    const campaign = await WhatsAppCampaign.create({ project_id: projectId, group_ids: groupIds, template_name: templateName, language_code: languageCode, body_values: bodyValues, status: 'sending', total_recipients: audience.length });
    await WhatsAppSend.insertMany(audience.map((recipient) => ({ campaign_id: campaign._id, recipient_id: recipient._id, phone: normalisePhone(recipient.phone) })));
    runCampaign(campaign._id, audience, { templateName, languageCode, bodyValues }).catch(async (error) => {
      await WhatsAppCampaign.findByIdAndUpdate(campaign._id, { status: 'failed', error: String(error.message || error) }).catch(() => {});
    });
    res.status(202).json({ id: String(campaign._id), totalRecipients: audience.length, dailyRemainingAfterStart: Math.max(remaining - audience.length, 0) });
  } catch (error) { next(error); }
});

async function sendTemplate(phone, recipient, { templateName, languageCode, bodyValues }) {
  const parameters = bodyValues.map((value) => ({ type: 'text', text: renderTemplate(value, recipient) }));
  const template = { name: templateName, language: { code: languageCode } };
  if (parameters.length) template.components = [{ type: 'body', parameters }];
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'template', template }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.error?.message || `Meta API returned ${response.status}`);
  return json?.messages?.[0]?.id || null;
}

async function runCampaign(campaignId, recipients, config) {
  let sent = 0; let failed = 0;
  for (let index = 0; index < recipients.length; index += 1) {
    const recipient = recipients[index]; const phone = normalisePhone(recipient.phone);
    try {
      const messageId = await sendTemplate(phone, recipient, config);
      await WhatsAppSend.updateOne({ campaign_id: campaignId, recipient_id: recipient._id }, { status: 'sent', message_id: messageId });
      sent += 1;
    } catch (error) {
      await WhatsAppSend.updateOne({ campaign_id: campaignId, recipient_id: recipient._id }, { status: 'failed', error: String(error.message || error).slice(0, 500) });
      failed += 1;
    }
    await WhatsAppCampaign.findByIdAndUpdate(campaignId, { sent_count: sent, failed_count: failed });
    if (index + 1 < recipients.length) await sleep(SEND_GAP_MS);
  }
  await WhatsAppCampaign.findByIdAndUpdate(campaignId, { status: failed === 0 ? 'sent' : (sent ? 'partial' : 'failed'), sent_count: sent, failed_count: failed, sent_at: new Date() });
}

export default router;
