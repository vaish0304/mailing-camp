// Local dev without MongoDB Atlas: spins up an ephemeral in-memory MongoDB
// and boots the API against it. Data is wiped on exit. Never use in production.
import { MongoMemoryServer } from 'mongodb-memory-server';

const mongod = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongod.getUri('mailing_camp_dev');
process.env.PUBLIC_BASE_URL ||= `http://localhost:${process.env.PORT || 8080}`;

// Let the UI run without a Resend account. Compose/preview work; actually
// sending a campaign will fail loudly until you set a real key + verified sender.
if (!process.env.RESEND_API_KEY) {
  process.env.RESEND_API_KEY = 're_local_dev_no_send';
  console.log('⚠  no RESEND_API_KEY — campaign sending will error until you set one');
}
process.env.FROM_EMAIL ||= 'campaigns@example.com';

console.log('⚠  in-memory MongoDB (data is not persisted) —', process.env.MONGODB_URI);

await import('./index.js');

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => { await mongod.stop(); process.exit(0); });
}
