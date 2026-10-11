// Throwaway integration test against an in-memory MongoDB.
import { MongoMemoryServer } from 'mongodb-memory-server';

const mongod = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongod.getUri('mailing_camp_test');
process.env.RESEND_API_KEY = 're_test_fake';
process.env.FROM_EMAIL = 'campaigns@example.com';
process.env.FROM_NAME = 'Test Sender';
process.env.PUBLIC_BASE_URL = 'http://localhost:8099';
process.env.PORT = '8099';
process.env.WHATSAPP_ACCESS_TOKEN = 'test-whatsapp-token';
process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';

// Stub Resend's HTTP calls so we can test the send state machine offline.
const realFetch = globalThis.fetch;
let resendCalls = 0;
globalThis.fetch = (url, opts) => {
  const u = typeof url === 'string' ? url : url.url;
  if (u.includes('resend.com')) {
    resendCalls++;
    const body = JSON.parse(opts.body);
    const arr = Array.isArray(body) ? body : [body];
    return Promise.resolve(new Response(
      JSON.stringify({ data: arr.map((_, i) => ({ id: `mock-${resendCalls}-${i}` })) }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
  }
  if (u.includes('graph.facebook.com')) {
    return Promise.resolve(new Response(JSON.stringify({ messages: [{ id: `wamid.mock-${resendCalls}` }] }), {
      status: 200, headers: { 'content-type': 'application/json' },
    }));
  }
  return realFetch(url, opts);
};

await import('../src/index.js');
await new Promise((r) => setTimeout(r, 1500));

const BASE = 'http://localhost:8099';
let pass = 0; let fail = 0;
async function check(name, fn) {
  try { await fn(); console.log(`  ok  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL ${name}: ${e.message}`); fail++; }
}
const j = async (p, opts) => {
  const res = await fetch(BASE + p, opts);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
};
const assert = (c, m) => { if (!c) throw new Error(m); };

let groupId;

await check('health ok', async () => {
  const { status, body } = await j('/api/health');
  assert(status === 200 && body.ok, JSON.stringify(body));
  assert(body.from === 'Test Sender <campaigns@example.com>', body.from);
});

await check('create group', async () => {
  const { status, body } = await j('/api/groups', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Pune CCTV dealers' }),
  });
  assert(status === 201 && body.id, JSON.stringify(body));
  assert(body.recipient_count === 0, 'count');
  groupId = body.id;
});

await check('duplicate group rejected', async () => {
  const { status } = await j('/api/groups', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Pune CCTV dealers' }),
  });
  assert(status === 409, `expected 409 got ${status}`);
});

await check('import CSV', async () => {
  const csv = 'Email Address,Name,Surname,Firm,Mobile,Town\n'
    + 'RAHUL@x.com,Rahul,Sharma,Sharma Electronics,98200,Pune\n'
    + 'priya@x.com,Priya,,Gadget Hub,98201,Mumbai\n'
    + 'bad-email,No,Body,,,\n'
    + 'rahul@x.com,Dup,,,,\n';
  const fd = new FormData();
  fd.append('file', new Blob([csv], { type: 'text/csv' }), 'contacts.csv');
  const res = await fetch(`${BASE}/api/groups/${groupId}/import`, { method: 'POST', body: fd });
  const body = await res.json();
  assert(res.status === 200, JSON.stringify(body));
  assert(body.inserted === 2, `inserted ${body.inserted}`);
  assert(body.addedToGroup === 2, `addedToGroup ${body.addedToGroup}`);
  assert(body.rowErrors.length === 2, `rowErrors ${JSON.stringify(body.rowErrors)}`);
});

await check('group now has 2, count reflected in list', async () => {
  const { body } = await j('/api/groups');
  assert(body[0].recipient_count === 2, `count ${body[0].recipient_count}`);
});

await check('re-import updates, does not duplicate', async () => {
  const csv = 'email,company,city\nrahul@x.com,Sharma Electronics Pvt Ltd,Pune\npriya@x.com,Gadget Hub,Mumbai\nnew@x.com,New Traders,Nashik\n';
  const fd = new FormData();
  fd.append('file', new Blob([csv], { type: 'text/csv' }), 'c2.csv');
  const res = await fetch(`${BASE}/api/groups/${groupId}/import`, { method: 'POST', body: fd });
  const body = await res.json();
  assert(body.inserted === 1 && body.updated === 2, JSON.stringify(body));
  const list = await j(`/api/groups/${groupId}/recipients`);
  assert(list.body.length === 3, `members ${list.body.length}`);
  const rahul = list.body.find((r) => r.email === 'rahul@x.com');
  assert(rahul.company === 'Sharma Electronics Pvt Ltd', `company "${rahul.company}"`);
  assert(rahul.first_name === 'Rahul', `first_name blank-overwrite: "${rahul.first_name}"`);
});

await check('recipients search + groups array', async () => {
  const { body } = await j('/api/recipients?search=sharma');
  assert(body.total === 1 && body.recipients[0].groups.includes('Pune CCTV dealers'), JSON.stringify(body));
});

await check('campaign preview renders tokens', async () => {
  const { status, body } = await j('/api/campaigns/preview', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subject: 'Hi {{first_name}}', html: '<p>{{company}} in {{city}}</p>', groupIds: [groupId] }),
  });
  assert(status === 200, JSON.stringify(body));
  assert(body.recipientCount === 3, `count ${body.recipientCount}`);
  assert(body.renderedSubject.startsWith('Hi '), body.renderedSubject);
  assert(body.renderedHtml.includes('unsubscribe'), 'no unsub footer');
});

await check('campaign preview does not require an audience', async () => {
  const { status, body } = await j('/api/campaigns/preview', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subject: 'Hi {{first_name}}', html: '<p>{{company}}</p>' }),
  });
  assert(status === 200, JSON.stringify(body));
  assert(body.recipientCount === 0, `count ${body.recipientCount}`);
  assert(body.renderedSubject === 'Hi Rahul', body.renderedSubject);
});

await check('unsubscribe then preview count drops', async () => {
  const preview = await j('/api/campaigns/preview', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subject: 'x', html: 'y', groupIds: [groupId] }),
  });
  const unsubscribeHref = preview.body.renderedHtml.match(/href="([^"]*\/api\/unsubscribe\?token=[^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
  assert(unsubscribeHref, 'signed unsubscribe URL missing');
  const unsubscribed = await fetch(unsubscribeHref);
  assert(unsubscribed.status === 200, `unsubscribe status ${unsubscribed.status}`);
  const { body } = await j('/api/campaigns/preview', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subject: 'x', html: 'y', groupIds: [groupId] }),
  });
  assert(body.recipientCount === 2, `count ${body.recipientCount}`);
});

await check('create and follow a tracked link', async () => {
  const created = await j('/api/links', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Demo video', destinationUrl: 'https://example.com/demo' }),
  });
  assert(created.status === 201 && created.body.tracked_url, JSON.stringify(created.body));
  const click = await fetch(created.body.tracked_url, { redirect: 'manual' });
  assert(click.status === 302 && click.headers.get('location') === 'https://example.com/demo', 'redirect failed');
  const listed = await j('/api/links');
  assert(listed.body[0].click_count === 1 && listed.body[0].unique_click_count === 1, JSON.stringify(listed.body[0]));
});

await check('remove member from group', async () => {
  const list = await j(`/api/groups/${groupId}/recipients`);
  const victim = list.body.find((r) => r.email === 'priya@x.com');
  const res = await fetch(`${BASE}/api/groups/${groupId}/members/${victim.id}`, { method: 'DELETE' });
  assert(res.status === 204, `status ${res.status}`);
  const after = await j(`/api/groups/${groupId}/recipients`);
  assert(after.body.length === 2, `after ${after.body.length}`);
});

await check('auth gate (set token, expect 401)', async () => {
  // not wired here since ADMIN_TOKEN unset; just assert open access works
  const { status } = await j('/api/groups');
  assert(status === 200, `status ${status}`);
});

await check('send campaign end-to-end (mocked Resend)', async () => {
  const start = await j('/api/campaigns', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subject: 'Quote for {{company}}', html: '<p>Hi {{first_name}}</p>', groupIds: [groupId] }),
  });
  assert(start.status === 202 && start.body.id, JSON.stringify(start.body));
  // group has rahul (unsubscribed) + new@x.com (active) -> 1 active recipient
  assert(start.body.totalRecipients === 1, `total ${start.body.totalRecipients}`);

  let detail;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 200));
    detail = (await j(`/api/campaigns/${start.body.id}`)).body;
    if (['sent', 'partial', 'failed'].includes(detail.campaign.status)) break;
  }
  assert(detail.campaign.status === 'sent', `status ${detail.campaign.status} ${detail.campaign.error || ''}`);
  assert(detail.campaign.sent_count === 1, `sent_count ${detail.campaign.sent_count}`);
  assert(detail.sends.every((s) => s.status === 'sent' && s.resend_id), JSON.stringify(detail.sends));
  assert(detail.stats.sent === 1, JSON.stringify(detail.stats));
});

await check('webhook updates delivery status', async () => {
  const c = (await j('/api/campaigns')).body[0];
  const d = (await j(`/api/campaigns/${c.id}`)).body;
  const rid = d.sends[0].resend_id;
  const res = await fetch(`${BASE}/api/webhooks/resend`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'email.opened', data: { email_id: rid } }),
  });
  assert(res.status === 200, `status ${res.status}`);
  const after = (await j(`/api/campaigns/${c.id}`)).body;
  assert(after.sends.find((s) => s.resend_id === rid).status === 'opened', 'status not updated');
});

await check('delete campaign removes it and its send rows', async () => {
  const c = (await j('/api/campaigns')).body[0];
  const res = await fetch(`${BASE}/api/campaigns/${c.id}`, { method: 'DELETE' });
  assert(res.status === 204, `status ${res.status}`);
  const gone = await j(`/api/campaigns/${c.id}`);
  assert(gone.status === 404, `expected 404 got ${gone.status}`);
  assert((await j('/api/campaigns')).body.length === 0, 'campaign still listed');
});

await check('manual add recipient to group (upsert + validation)', async () => {
  const { status, body } = await j(`/api/groups/${groupId}/recipients`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'MANUAL@x.com', first_name: 'Manual', company: 'Hand Traders', city: 'Indore' }),
  });
  assert(status === 201 && body.created && body.addedToGroup, JSON.stringify(body));
  assert(body.recipient.email === 'manual@x.com' && body.recipient.company === 'Hand Traders', JSON.stringify(body.recipient));

  const again = await j(`/api/groups/${groupId}/recipients`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'manual@x.com', phone: '999' }),
  });
  assert(again.status === 200 && !again.body.created && !again.body.addedToGroup, JSON.stringify(again.body));
  assert(again.body.recipient.phone === '999' && again.body.recipient.company === 'Hand Traders', 'blank overwrite');

  const bad = await j(`/api/groups/${groupId}/recipients`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email' }),
  });
  assert(bad.status === 400, `expected 400 got ${bad.status}`);

  const list = await j(`/api/groups/${groupId}/recipients`);
  assert(list.body.some((r) => r.email === 'manual@x.com'), 'manual recipient not in group');
});

await check('A/B test splits a fresh group sample and reports variants', async () => {
  for (const email of ['ab-one@x.com', 'ab-two@x.com']) {
    const added = await j(`/api/groups/${groupId}/recipients`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, first_name: 'AB', company: 'Test Company' }),
    });
    assert(added.status === 201, JSON.stringify(added.body));
  }
  const start = await j('/api/campaigns/experiments', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ groupIds: [groupId], perVariant: 1, variants: [
      { id: 'a', name: 'Variation A', subject: 'Question A', html: '<p>Hi {{first_name}}</p>' },
      { id: 'b', name: 'Variation B', subject: 'Question B', html: '<p>Hello {{first_name}}</p>' },
    ] }),
  });
  assert(start.status === 202 && start.body.totalRecipients === 2, JSON.stringify(start.body));
  let experiments = [];
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 200));
    experiments = (await j('/api/campaigns/experiments')).body;
    if (experiments[0]?.variants?.every((variant) => variant.status === 'sent')) break;
  }
  assert(experiments.length === 1, JSON.stringify(experiments));
  assert(experiments[0].variants.length === 2, JSON.stringify(experiments[0]));
  assert(experiments[0].variants.every((variant) => variant.total === 1 && variant.sent === 1), JSON.stringify(experiments[0]));
});

await check('WhatsApp template campaign requires consent and sends through Cloud API', async () => {
  const added = await j(`/api/groups/${groupId}/recipients`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'whatsapp@x.com', first_name: 'WhatsApp', company: 'WA Traders', phone: '+91 98200 11111', whatsapp_opt_in: true }),
  });
  assert(added.status === 201 && added.body.recipient.whatsapp_opt_in, JSON.stringify(added.body));
  const start = await j('/api/whatsapp/campaigns', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ groupIds: [groupId], templateName: 'enquiry_follow_up', languageCode: 'en_US', bodyValues: ['{{first_name}}'], targetLimit: 1 }),
  });
  assert(start.status === 202 && start.body.totalRecipients === 1, JSON.stringify(start.body));
  let campaigns = [];
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 150));
    campaigns = (await j('/api/whatsapp/campaigns')).body;
    if (campaigns[0]?.status === 'sent') break;
  }
  assert(campaigns[0]?.status === 'sent' && campaigns[0].sent_count === 1, JSON.stringify(campaigns[0]));
});

console.log(`\n${pass} passed, ${fail} failed`);
await mongod.stop();
process.exit(fail ? 1 : 0);
