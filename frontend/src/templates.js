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
const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '');
const DEMO_POSTER = `${PUBLIC_APP_URL}/campaign-media/ai-sales-assistant-demo-thumbnail.png`;

// These are intentionally light on visual and promotional signals. They work
// best when the sender is a real person, the recipient/company data is correct,
// and the message is used for a small, relevant outreach segment. Gmail still
// decides the final inbox category.
const personalEmail = (inner) => `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#202124;font-size:15px;line-height:1.55">${inner}</div>`;

export const TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank',
    subject: '',
    html: '',
  },
  {
    id: 'distributor-whatsapp-demo',
    name: 'Promotional · Distributor Demo',
    deliveryStyle: 'Campaign / likely Promotions',
    requiresTrackedLink: true,
    trackedLinkLabel: 'Tracked video or Drive link',
    subject: '{{company}}: how many WhatsApp sales inquiries wait each day?',
    html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#0a243e;background:#ffffff">
  <div style="padding:34px 34px 12px">
    <p style="margin:0 0 11px;font-size:13px;line-height:18px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#0b8f54">For distributors / wholesalers / retailers</p>
    <h1 style="margin:0 0 17px;font-size:28px;line-height:35px">How many WhatsApp sales inquiries does your team leave waiting each day?</h1>
    <p style="margin:0;font-size:16px;line-height:25px;color:#3d5262">Customers ask about stock, latest pricing and dispatch status throughout the day. Manual checking slows replies and takes your team away from selling.</p>
  </div>
  <div style="padding:8px 34px 16px;font-size:16px;line-height:25px;color:#3d5262"><strong style="color:#0a243e">AI Sales Assistant for WhatsApp</strong> helps distributors reply promptly, share consistent information and keep every inquiry organised while the sales team focuses on customers and closing business.</div>
  <div style="padding:0 34px 25px;font-size:16px;line-height:29px">
    <div><span style="color:#0a9b59;font-weight:700">✓</span>&nbsp; Prompt responses to price, stock and dispatch inquiries</div>
    <div><span style="color:#0a9b59;font-weight:700">✓</span>&nbsp; Consistent and current customer information</div>
    <div><span style="color:#0a9b59;font-weight:700">✓</span>&nbsp; More time for sales and customer relationships</div>
  </div>
  <div style="padding:0 20px 8px"><a href="%%TRACKED_LINK%%" target="_blank" style="display:block;text-decoration:none"><img src="${DEMO_POSTER}" width="560" alt="See the AI Sales Assistant for WhatsApp" style="display:block;width:100%;max-width:560px;height:auto;margin:0 auto;border:0;border-radius:10px" /></a></div>
  <p style="padding:16px 34px 2px;margin:0;text-align:center;font-size:16px;line-height:24px;font-weight:700">See how this can support your current sales process.</p>
  <div style="padding:16px 24px 24px;text-align:center"><a href="https://wa.me/917219411464?text=Hi%2C%20I%20would%20like%20to%20understand%20how%20the%20AI%20Sales%20Assistant%20for%20WhatsApp%20could%20work%20for%20our%20business." target="_blank" style="background:#0b8f54;color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;line-height:22px;padding:13px 25px;border-radius:7px;display:inline-block">Set Up Your WhatsApp Sales Assistant</a></div>
</div>`,
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
    name: 'Personal · First introduction',
    deliveryStyle: 'Personal outreach / lower Promotions signal',
    subject: 'Question about WhatsApp enquiries at {{company}}',
    html: personalEmail(`<p style="margin:0 0 16px">Hi {{first_name}},</p>
    <p style="margin:0 0 16px">I came across {{company}} and wanted to ask a quick question: when someone messages your team on WhatsApp for stock, pricing or dispatch details, is it easy to respond while the enquiry is still active?</p>
    <p style="margin:0 0 16px">We help sales teams use the product and pricing information they already maintain to give customers a faster first response. If this is relevant, would you be open to a short reply with the person who handles this at {{company}}?</p>
    <p style="margin:0">Regards,<br/>AI Sales Assistant</p>`),
  },
  {
    id: 'followup',
    name: 'Personal · Follow-up',
    deliveryStyle: 'Personal outreach / lower Promotions signal',
    subject: 'Following up — quick question for {{company}}',
    html: personalEmail(`<p style="margin:0 0 16px">Hi {{first_name}},</p>
    <p style="margin:0 0 16px">Just following up on my note about handling WhatsApp sales enquiries at {{company}}.</p>
    <p style="margin:0 0 16px">Is improving the response time for product or price questions something your team is looking at this quarter? A simple yes or no is helpful.</p>
    <p style="margin:0">Regards,<br/>AI Sales Assistant</p>`),
  },
  {
    id: 'wholesale-distribution',
    name: 'Personal · Distribution question',
    deliveryStyle: 'Personal outreach / lower Promotions signal',
    subject: 'A question for {{company}}\'s sales team',
    html: personalEmail(`<p style="margin:0 0 16px">Hi {{first_name}},</p>
    <p style="margin:0 0 16px">For distribution businesses, customers often message for price, availability and dispatch details before placing an order. I was curious how {{company}} currently manages those WhatsApp enquiries during busy hours.</p>
    <p style="margin:0 0 16px">We are working with teams that want to make those first replies quicker using their existing catalogue and price information. Would it make sense to send you a brief explanation?</p>
    <p style="margin:0">Regards,<br/>AI Sales Assistant</p>`),
  },
  {
    id: 'industrial-automation',
    name: 'Personal · Technical enquiries',
    deliveryStyle: 'Personal outreach / lower Promotions signal',
    subject: 'Technical product enquiries at {{company}}',
    html: personalEmail(`<p style="margin:0 0 16px">Hi {{first_name}},</p>
    <p style="margin:0 0 16px">I am reaching out because technical buyers often need a prompt first answer on specifications, pricing or availability before a sales engineer can take over.</p>
    <p style="margin:0 0 16px">Does {{company}} receive those questions on WhatsApp today? If so, I can share how teams use their approved product information to make the initial response more consistent.</p>
    <p style="margin:0">Regards,<br/>AI Sales Assistant</p>`),
  },
  {
    id: 'b2b-intro',
    name: 'Personal · B2B question',
    deliveryStyle: 'Personal outreach / lower Promotions signal',
    subject: 'Who handles WhatsApp sales enquiries at {{company}}?',
    html: personalEmail(`<p style="margin:0 0 16px">Hi {{first_name}},</p>
    <p style="margin:0 0 16px">Could you point me to the person responsible for customer enquiries on WhatsApp at {{company}}?</p>
    <p style="margin:0 0 16px">We help B2B sales teams give a quicker first response using the product and pricing information they already use. I only want to send a short note if this is relevant to your team.</p>
    <p style="margin:0">Regards,<br/>AI Sales Assistant</p>`),
  },
  {
    id: 'tamil-nadu',
    name: 'Personal · Tamil Nadu outreach',
    deliveryStyle: 'Personal outreach / lower Promotions signal',
    subject: 'Quick question for {{company}}',
    html: personalEmail(`<p style="margin:0 0 16px">Hi {{first_name}},</p>
    <p style="margin:0 0 16px">I am getting in touch with businesses in {{city}} that handle customer enquiries on WhatsApp.</p>
    <p style="margin:0 0 16px">Would a faster way to answer routine product, price and dispatch questions be useful for {{company}}? If not, I will not follow up.</p>
    <p style="margin:0">Regards,<br/>AI Sales Assistant</p>`),
  },
  {
    id: 'whatsapp-speed-creative',
    name: 'Promotional · WhatsApp Creative',
    deliveryStyle: 'Campaign / likely Promotions',
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

export const DEFAULT_TEMPLATE_ID = 'intro';
