// Predefined email templates shown in the Compose tab.
// Body is HTML; {{first_name}} {{last_name}} {{company}} {{city}} {{phone}} {{email}}
// are replaced per recipient at send time. The unsubscribe footer is added
// automatically by the backend — don't include one here.

const shell = (inner) => `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#14231d">
  <div style="background:#0a2e23;padding:22px 32px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;color:#fefcf7;font-size:19px;letter-spacing:.3px">AI Sales Assistant</h1>
  </div>
  <div style="border:1px solid #f3ead4;border-top:none;padding:30px 32px;border-radius:0 0 8px 8px">
${inner}
  </div>
</div>`;

const button = (label, href) => `<a href="${href}" style="display:inline-block;background:#cc9a2b;color:#071f18;text-decoration:none;padding:12px 26px;border-radius:6px;font-weight:bold;font-size:14px">${label}</a>`;

export const TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank',
    subject: '',
    html: '',
  },
  {
    id: 'test',
    name: 'Test email',
    subject: 'Test email from Mailing Camp',
    html: shell(`    <p style="font-size:16px;margin:0 0 14px">Hi {{first_name}},</p>
    <p style="font-size:14px;line-height:1.65;margin:0 0 18px">
      This is a <strong>test email</strong> from Mailing Camp. If it landed in your inbox,
      the Resend integration is configured correctly and campaigns are ready to send. ✅
    </p>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 22px;font-size:13px">
      <tr><td style="padding:9px 0;border-bottom:1px solid #f3ead4;color:#5c6b63">Recipient</td>
          <td style="padding:9px 0;border-bottom:1px solid #f3ead4;text-align:right">{{email}}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #f3ead4;color:#5c6b63">Company</td>
          <td style="padding:9px 0;border-bottom:1px solid #f3ead4;text-align:right">{{company}}</td></tr>
      <tr><td style="padding:9px 0;color:#5c6b63">City</td>
          <td style="padding:9px 0;text-align:right">{{city}}</td></tr>
    </table>
    ${button('Visit our site', 'https://aisales-assistant2.netlify.app/')}
    <p style="font-size:13px;color:#5c6b63;margin:24px 0 0">— Team AI Sales Assistant</p>`),
  },
  {
    id: 'intro',
    name: 'Cold intro',
    subject: 'Reply to every WhatsApp price inquiry in seconds',
    html: shell(`    <p style="font-size:16px;margin:0 0 14px">Hi {{first_name}},</p>
    <p style="font-size:14px;line-height:1.65;margin:0 0 14px">
      Distributors like {{company}} get 200–1,000+ price inquiries a day on WhatsApp.
      Our AI sales assistant reads each one, checks your Excel price list, and sends an
      accurate quotation instantly — no missed leads, no manual errors.
    </p>
    <ul style="font-size:14px;line-height:1.7;margin:0 0 18px;padding-left:20px">
      <li>Instant WhatsApp quotations from your own catalog</li>
      <li>Every inquiry logged, assigned and tracked</li>
      <li>Setup in days, not months — no CRM training</li>
    </ul>
    ${button('Book a 10-minute demo', 'https://aisales-assistant2.netlify.app/')}
    <p style="font-size:13px;color:#5c6b63;margin:24px 0 0">— Team AI Sales Assistant</p>`),
  },
  {
    id: 'followup',
    name: 'Follow-up',
    subject: 'Following up — quick question for {{company}}',
    html: shell(`    <p style="font-size:16px;margin:0 0 14px">Hi {{first_name}},</p>
    <p style="font-size:14px;line-height:1.65;margin:0 0 14px">
      Just following up on my note about the WhatsApp AI sales assistant for {{company}}.
      Worth a quick look to see how it fits your inquiry workflow in {{city}}?
    </p>
    <p style="font-size:14px;line-height:1.65;margin:0 0 18px">
      Happy to send a short video or set up a call — whatever's easier.
    </p>
    ${button('See how it works', 'https://aisales-assistant2.netlify.app/')}
    <p style="font-size:13px;color:#5c6b63;margin:24px 0 0">— Team AI Sales Assistant</p>`),
  },
];

export const DEFAULT_TEMPLATE_ID = 'test';
