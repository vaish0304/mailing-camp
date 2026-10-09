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
  {
    id: 'wholesale-distribution',
    name: 'Wholesale & Distribution',
    subject: '{{company}}: respond to every product enquiry while it is still warm',
    html: shell(`    <p style="font-size:16px;margin:0 0 14px">Hi {{first_name}},</p>
    <p style="font-size:14px;line-height:1.65;margin:0 0 14px">
      For a distributor, a delayed reply to a WhatsApp product enquiry can mean a lost order.
      AI Sales Assistant turns your catalogue and price list into fast, consistent quotations — even during busy hours.
    </p>
    <div style="margin:0 0 18px;padding:16px 18px;background:#f8f4e8;border-left:4px solid #cc9a2b;border-radius:4px">
      <p style="margin:0;font-size:14px;line-height:1.6"><strong>Built for channel businesses:</strong> answer price, availability and product questions quickly, while keeping your team focused on closing orders.</p>
    </div>
    ${button('See the workflow', 'https://aisales-assistant2.netlify.app/?utm_source=mailing-camp&utm_medium=email&utm_campaign=wholesale')}
    <p style="font-size:13px;color:#5c6b63;margin:24px 0 0">Would a brief 10-minute walkthrough be useful for {{company}}?</p>
    <p style="font-size:13px;color:#5c6b63;margin:12px 0 0">— Team AI Sales Assistant</p>`),
  },
  {
    id: 'industrial-automation',
    name: 'Industrial & Automation',
    subject: 'Faster, more accurate replies to technical product enquiries',
    html: shell(`    <p style="font-size:16px;margin:0 0 14px">Hi {{first_name}},</p>
    <p style="font-size:14px;line-height:1.65;margin:0 0 14px">
      Technical buyers expect clear answers on specifications, products and commercial details. AI Sales Assistant helps {{company}} respond to WhatsApp enquiries using your approved product information and price data.
    </p>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 18px;font-size:14px">
      <tr><td style="padding:10px 0;border-bottom:1px solid #f3ead4">Use your own catalogue and price list</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #f3ead4">Give prospects a prompt, consistent first response</td></tr>
      <tr><td style="padding:10px 0">Track enquiries so the sales team can follow up</td></tr>
    </table>
    ${button('Explore the solution', 'https://aisales-assistant2.netlify.app/?utm_source=mailing-camp&utm_medium=email&utm_campaign=industrial')}
    <p style="font-size:13px;color:#5c6b63;margin:24px 0 0">If faster enquiry handling is a priority this quarter, I would be glad to show you how it works.</p>
    <p style="font-size:13px;color:#5c6b63;margin:12px 0 0">— Team AI Sales Assistant</p>`),
  },
  {
    id: 'b2b-intro',
    name: 'B2B Business Intro',
    subject: 'A simpler way for {{company}} to keep up with WhatsApp enquiries',
    html: shell(`    <p style="font-size:16px;margin:0 0 14px">Hi {{first_name}},</p>
    <p style="font-size:14px;line-height:1.65;margin:0 0 14px">
      When customer questions arrive across WhatsApp, it is easy for a promising enquiry to wait too long. AI Sales Assistant helps teams reply quickly with the right product and pricing context.
    </p>
    <p style="font-size:14px;line-height:1.65;margin:0 0 18px">
      It is designed to work with the information your business already uses — product catalogues, price lists and your sales workflow — without forcing a complex CRM rollout.
    </p>
    ${button('Book a short introduction', 'https://aisales-assistant2.netlify.app/?utm_source=mailing-camp&utm_medium=email&utm_campaign=b2b-intro')}
    <p style="font-size:13px;color:#5c6b63;margin:24px 0 0">Best regards,<br/>Team AI Sales Assistant</p>`),
  },
  {
    id: 'tamil-nadu',
    name: 'Tamil Nadu Businesses',
    subject: '{{company}}: make every WhatsApp enquiry easier to manage',
    html: shell(`    <p style="font-size:16px;margin:0 0 14px">Hi {{first_name}},</p>
    <p style="font-size:14px;line-height:1.65;margin:0 0 14px">
      We are introducing AI Sales Assistant to growing businesses that want to give customers a quicker response without adding avoidable manual work.
    </p>
    <p style="font-size:14px;line-height:1.65;margin:0 0 18px">
      The assistant can use {{company}}'s own product information and price list to support your team with faster WhatsApp quotations and enquiry follow-up.
    </p>
    ${button('Request a walkthrough', 'https://aisales-assistant2.netlify.app/?utm_source=mailing-camp&utm_medium=email&utm_campaign=tamil-nadu')}
    <p style="font-size:13px;color:#5c6b63;margin:24px 0 0">— Team AI Sales Assistant</p>`),
  },
  {
    id: 'whatsapp-speed-creative',
    name: 'WhatsApp Speed Creative',
    subject: '{{company}}: every late WhatsApp reply can cost an order',
    html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#14231d;background:#ffffff">
  <img src="https://mailing-camp.vercel.app/campaign-media/whatsapp-distributor-phone-v1.png" alt="Customer wait nahi karta. Late reply equals lost order. AI Sales Assistant helps distributors reply faster on WhatsApp." width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none" />
  <div style="padding:28px 28px 8px">
    <p style="font-size:17px;line-height:1.55;margin:0 0 14px">Hi {{first_name}},</p>
    <p style="font-size:15px;line-height:1.65;margin:0 0 18px">For {{company}}, every product enquiry deserves a quick, accurate reply. AI Sales Assistant uses your catalogue and price list to help your team answer stock, price and dispatch questions on WhatsApp.</p>
    ${button('Request a demo on WhatsApp', 'https://aisales-assistant2.netlify.app/?utm_source=mailing-camp&utm_medium=email&utm_campaign=whatsapp-speed-creative')}
    <p style="font-size:13px;line-height:1.55;color:#5c6b63;margin:22px 0 0">Reply to this email to arrange a short walkthrough for your sales team.</p>
    <p style="font-size:13px;color:#5c6b63;margin:12px 0 0">— Team AI Sales Assistant</p>
  </div>
</div>`,
  },
];

export const DEFAULT_TEMPLATE_ID = 'test';
