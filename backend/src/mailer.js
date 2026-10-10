import { Resend } from 'resend';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error('FATAL: RESEND_API_KEY is not set');
  process.exit(1);
}
if (!process.env.FROM_EMAIL) {
  console.error('FATAL: FROM_EMAIL is not set');
  process.exit(1);
}

export const resend = new Resend(apiKey);

export const FROM = process.env.FROM_NAME
  ? `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`
  : process.env.FROM_EMAIL;

export const REPLY_TO = (process.env.REPLY_TO || '').trim() || undefined;

const BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
const UNSUBSCRIBE_SECRET = (process.env.UNSUBSCRIBE_SECRET || process.env.ADMIN_TOKEN || apiKey).trim();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BROCHURE_PATH = process.env.BROCHURE_PATH || path.resolve(HERE, '../assets/ai-sales-assistant-brochure.png');

export function brochureAttachment() {
  if (!fs.existsSync(BROCHURE_PATH)) throw new Error(`Brochure file is missing: ${BROCHURE_PATH}`);
  return { filename: 'AI-Sales-Assistant-Brochure.png', content: fs.readFileSync(BROCHURE_PATH) };
}

/** Replace {{token}} placeholders with recipient values (missing -> ""). */
export function renderTemplate(str, recipient) {
  if (!str) return str;
  return str.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_, key) => {
    const token = key.toLowerCase();
    const v = recipient?.[token] ?? recipient?.custom_fields?.[token];
    return v == null ? '' : String(v);
  });
}

/** Append an unsubscribe footer + List-Unsubscribe header target. */
function signUnsubscribe(payload) {
  if (!UNSUBSCRIBE_SECRET) return null;
  return crypto.createHmac('sha256', UNSUBSCRIBE_SECRET).update(payload).digest('base64url');
}

export function unsubscribeToken(email, campaignId = '') {
  if (!UNSUBSCRIBE_SECRET) return null;
  const payload = Buffer.from(JSON.stringify({ e: String(email).toLowerCase(), c: String(campaignId || '') })).toString('base64url');
  return `${payload}.${signUnsubscribe(payload)}`;
}

export function verifyUnsubscribeToken(token) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature || !UNSUBSCRIBE_SECRET) return null;
  const expected = signUnsubscribe(payload);
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return null; }
}

export function unsubscribeUrl(email, campaignId = '') {
  if (!BASE_URL) return null;
  const token = unsubscribeToken(email, campaignId);
  return token ? `${BASE_URL}/api/unsubscribe?token=${encodeURIComponent(token)}` : null;
}

export function withUnsubFooter(html, email, campaignId = '') {
  const url = unsubscribeUrl(email, campaignId);
  if (!url) return html;
  return `${html}
<hr style="margin-top:32px;border:none;border-top:1px solid #e5e7eb" />
<p style="font-size:12px;color:#6b7280;font-family:Arial,sans-serif">
  You received this email because you are a contact of ours.
  <a href="${url}" style="color:#6b7280">Unsubscribe</a>.
</p>`;
}

/**
 * Send up to 100 messages in one Resend batch call.
 * `messages` = [{ to, subject, html, headers? }]
 * Returns { data: [{id}...] } aligned to input order, or throws.
 */
export async function sendBatch(messages) {
  const payload = messages.map((m) => ({
    from: FROM,
    to: m.to,
    subject: m.subject,
    html: m.html,
    replyTo: REPLY_TO,
    headers: m.headers,
    attachments: m.attachments,
  }));
  // Resend's single-email endpoint supports file attachments. Campaigns are
  // already throttled one recipient at a time, so use it when a brochure is selected.
  if (payload.some((message) => message.attachments?.length)) {
    const data = [];
    for (const message of payload) {
      const result = await resend.emails.send(message);
      if (result.error) throw new Error(result.error.message || JSON.stringify(result.error));
      data.push(result.data);
    }
    return { data };
  }
  const { data, error } = await resend.batch.send(payload);
  if (error) throw new Error(error.message || JSON.stringify(error));
  return data;
}
