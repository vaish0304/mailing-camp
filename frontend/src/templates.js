// The video demo is the control. Variants deliberately preserve the same
// video and CTA structure so A/B results isolate message framing instead of
// comparing unrelated email formats. The backend appends the unsubscribe footer.

const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '');
const DEMO_POSTER = `${PUBLIC_APP_URL}/campaign-media/ai-sales-assistant-demo-thumbnail.png`;

const videoTemplate = ({ eyebrow, headline, opening, cta }) => `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#0a243e;background:#ffffff">
  <div style="padding:34px 34px 12px">
    <p style="margin:0 0 11px;font-size:13px;line-height:18px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#0b8f54">${eyebrow}</p>
    <h1 style="margin:0 0 17px;font-size:28px;line-height:35px">${headline}</h1>
    <p style="margin:0;font-size:16px;line-height:25px;color:#3d5262">Hi {{first_name}}, ${opening}</p>
  </div>
  <div style="padding:8px 34px 16px;font-size:16px;line-height:25px;color:#3d5262"><strong style="color:#0a243e">AI Sales Assistant for WhatsApp</strong> helps {{company}} reply promptly, share consistent information and keep every enquiry organised while the sales team focuses on customers.</div>
  <div style="padding:0 34px 25px;font-size:16px;line-height:29px"><div><span style="color:#0a9b59;font-weight:700">✓</span>&nbsp; Faster replies to stock, price and dispatch questions</div><div><span style="color:#0a9b59;font-weight:700">✓</span>&nbsp; Your own catalogue and pricing context</div><div><span style="color:#0a9b59;font-weight:700">✓</span>&nbsp; A clear record for the sales team to follow up</div></div>
  <div style="padding:0 20px 8px"><a href="%%TRACKED_LINK%%" target="_blank" style="display:block;text-decoration:none"><img src="${DEMO_POSTER}" width="560" alt="Watch the AI Sales Assistant WhatsApp demo" style="display:block;width:100%;max-width:560px;height:auto;margin:0 auto;border:0;border-radius:10px" /></a></div>
  <p style="padding:16px 34px 2px;margin:0;text-align:center;font-size:16px;line-height:24px;font-weight:700">${cta}</p>
  <div style="padding:16px 24px 24px;text-align:center"><a href="%%TRACKED_LINK%%" target="_blank" style="background:#0b8f54;color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;line-height:22px;padding:13px 25px;border-radius:7px;display:inline-block">Watch the short demo</a></div>
</div>`;

export const TEMPLATES = [
  {
    id: 'video-control',
    name: 'Main · WhatsApp video demo',
    deliveryStyle: 'Video-demo control',
    requiresTrackedLink: true,
    trackedLinkLabel: 'Tracked demo-video link',
    subject: '{{company}}: how many WhatsApp sales enquiries wait each day?',
    html: videoTemplate({ eyebrow: 'For distributors, wholesalers & retailers', headline: 'How many WhatsApp sales enquiries wait each day?', opening: 'customers ask about stock, latest pricing and dispatch status throughout the day. Manual checking can slow replies when the enquiry is still active.', cta: 'See how the sales workflow works in practice.' }),
  },
  {
    id: 'video-variation-a',
    name: 'Variation A · Lost-order angle',
    deliveryStyle: 'Video-demo variation',
    requiresTrackedLink: true,
    trackedLinkLabel: 'Tracked demo-video link',
    subject: '{{company}}: a late WhatsApp reply can become a lost order',
    html: videoTemplate({ eyebrow: 'For distribution sales teams', headline: 'A customer will not wait for a product reply.', opening: 'when price or availability takes too long to confirm, buyers often ask another supplier. This short video shows a simpler first-response workflow.', cta: 'See the workflow for keeping enquiries moving.' }),
  },
  {
    id: 'video-variation-b',
    name: 'Variation B · Catalogue angle',
    deliveryStyle: 'Video-demo variation',
    requiresTrackedLink: true,
    trackedLinkLabel: 'Tracked demo-video link',
    subject: '{{company}}: put your catalogue to work on WhatsApp',
    html: videoTemplate({ eyebrow: 'For product-led sales teams', headline: 'Your catalogue should help answer the first question.', opening: 'your team already has product and price information; the challenge is making it available when customers message. The video below shows how that can work on WhatsApp.', cta: 'Watch a short catalogue-to-conversation demo.' }),
  },
  {
    id: 'video-variation-c',
    name: 'Variation C · Team-time angle',
    deliveryStyle: 'Video-demo variation',
    requiresTrackedLink: true,
    trackedLinkLabel: 'Tracked demo-video link',
    subject: '{{company}}: reduce the back-and-forth on routine WhatsApp enquiries',
    html: videoTemplate({ eyebrow: 'For busy sales teams', headline: 'Let the team focus on closing, not repeating answers.', opening: 'routine stock, price and dispatch questions can take time away from higher-value customer conversations. This video shows how teams can keep the first response consistent.', cta: 'See the short WhatsApp sales-assistant demo.' }),
  },
];

export const DEFAULT_TEMPLATE_ID = 'video-control';
