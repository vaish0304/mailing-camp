// Compact, reply-led outreach templates. Personalisation tokens are rendered
// per recipient and the compliance footer is supplied by the backend.
// These designs deliberately avoid campaign-style headers, large images,
// buttons, and tracked links. Gmail decides the final inbox category.

const personalEmail = (inner) => `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#202124;font-size:15px;line-height:1.55">${inner}</div>`;

export const TEMPLATES = [
  {
    id: 'base-question',
    name: 'Main · Question-first',
    deliveryStyle: 'Personal outreach / lower Promotions signal',
    subject: 'Question about WhatsApp enquiries at {{company}}',
    html: personalEmail(`<p style="margin:0 0 16px">Hi {{first_name}},</p>
      <p style="margin:0 0 16px">I came across {{company}} and wanted to ask a quick question: when someone messages your team on WhatsApp for stock, pricing or dispatch details, is it easy to respond while the enquiry is still active?</p>
      <p style="margin:0 0 16px">We help sales teams use the product and pricing information they already maintain to give customers a faster first response. If this is relevant, would you be open to a short reply with the person who handles this at {{company}}?</p>
      <p style="margin:0">Regards,<br/>AI Sales Assistant</p>`),
  },
  {
    id: 'context-first',
    name: 'Variation A · Context-first',
    deliveryStyle: 'Personal outreach / lower Promotions signal',
    subject: 'A quick question for {{company}}',
    html: personalEmail(`<p style="margin:0 0 16px">Hi {{first_name}},</p>
      <p style="margin:0 0 16px">For businesses handling product enquiries on WhatsApp, price, availability and dispatch questions can arrive faster than the team can answer them.</p>
      <p style="margin:0 0 16px">We are speaking with teams that want to make the first reply quicker using the catalogue and price information they already use. Is that something {{company}} is looking at this year?</p>
      <p style="margin:0">Regards,<br/>AI Sales Assistant</p>`),
  },
  {
    id: 'referral-first',
    name: 'Variation B · Referral-first',
    deliveryStyle: 'Personal outreach / lower Promotions signal',
    subject: 'Who looks after WhatsApp enquiries at {{company}}?',
    html: personalEmail(`<p style="margin:0 0 16px">Hi {{first_name}},</p>
      <p style="margin:0 0 16px">Could you point me to the person responsible for customer enquiries on WhatsApp at {{company}}?</p>
      <p style="margin:0 0 16px">We help B2B sales teams give a more consistent first response to routine product and pricing questions. I only want to send a short explanation if it is relevant to your team.</p>
      <p style="margin:0">Regards,<br/>AI Sales Assistant</p>`),
  },
  {
    id: 'pain-first',
    name: 'Variation C · Response-time',
    deliveryStyle: 'Personal outreach / lower Promotions signal',
    subject: 'A question about response time at {{company}}',
    html: personalEmail(`<p style="margin:0 0 16px">Hi {{first_name}},</p>
      <p style="margin:0 0 16px">When a customer asks for stock or a price on WhatsApp, does the reply ever wait because someone has to check several files or people first?</p>
      <p style="margin:0 0 16px">We help teams bring their existing product and price information into that first response. Would it be useful to compare notes on how {{company}} manages this today?</p>
      <p style="margin:0">Regards,<br/>AI Sales Assistant</p>`),
  },
];

export const DEFAULT_TEMPLATE_ID = 'base-question';
