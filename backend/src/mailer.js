import { Resend } from 'resend';

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
export function unsubscribeUrl(email) {
  if (!BASE_URL) return null;
  return `${BASE_URL}/api/unsubscribe?email=${encodeURIComponent(email)}`;
}

export function withUnsubFooter(html, email) {
  const url = unsubscribeUrl(email);
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
  }));
  const { data, error } = await resend.batch.send(payload);
  if (error) throw new Error(error.message || JSON.stringify(error));
  return data;
}
