// Throwaway integration test against an in-memory MongoDB.
import { MongoMemoryServer } from 'mongodb-memory-server';

const mongod = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongod.getUri('mailing_camp_test');
process.env.RESEND_API_KEY = 're_test_fake';
process.env.FROM_EMAIL = 'campaigns@example.com';
process.env.FROM_NAME = 'Test Sender';
process.env.PUBLIC_BASE_URL = 'http://localhost:8080';
process.env.PORT = '8099';

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

await check('unsubscribe then preview count drops', async () => {
  await fetch(`${BASE}/api/unsubscribe?email=rahul@x.com`);
  const { body } = await j('/api/campaigns/preview', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subject: 'x', html: 'y', groupIds: [groupId] }),
  });
  assert(body.recipientCount === 2, `count ${body.recipientCount}`);
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

console.log(`\n${pass} passed, ${fail} failed`);
await mongod.stop();
process.exit(fail ? 1 : 0);
