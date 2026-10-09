/**
 * One-off / repeatable importer for the consolidated contact workbook.
 *
 * Usage:
 *   MONGODB_URI='mongodb+srv://...' node src/import-consolidated.mjs --file /absolute/path/to/consolidated_records.xlsx
 *   MONGODB_URI='placeholder' node src/import-consolidated.mjs --file /absolute/path/to/consolidated_records.xlsx --dry-run
 */
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';
import { Group, Recipient, initDb, mongoose } from './db.js';

const args = process.argv.slice(2);
const fileIndex = args.indexOf('--file');
const sourceFile = fileIndex >= 0 ? args[fileIndex + 1] : null;
const dryRun = args.includes('--dry-run');

if (!sourceFile) throw new Error('Use --file /absolute/path/to/consolidated_records.xlsx');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DNC_RE = /\b(cancel(?:led)?|do\s*not\s*contact|unsubscribe[ds]?|opt(?:ed)?\s*out)\b/i;

const GROUPS = {
  wholesale: 'Wholesale & Distribution',
  retail: 'Retail & Fashion Businesses',
  dealers: 'Electrical & Channel Dealers',
  automation: 'Industrial Automation & Manufacturing',
  electrical: 'Electrical, Electronics & Cable',
  tamilNadu: 'Tamil Nadu Business Leaders',
  association: 'B2B Associations & Members',
  education: 'Education & Training',
  finance: 'Finance & Professional Services',
  realEstate: 'Real Estate & Infrastructure',
  manufacturing: 'Manufacturing & Industrial',
  services: 'Professional & Business Services',
};

function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function splitName(value) {
  const parts = text(value).replace(/^(mr|mrs|ms|dr|shri)\.?\s+/i, '').split(' ').filter(Boolean);
  return { first_name: parts[0] || '', last_name: parts.slice(1).join(' ') };
}

function groupsFor(source, profession, company, other) {
  const groups = new Set();
  const sourceKey = text(source).toLowerCase();
  const haystack = `${profession} ${company} ${other}`.toLowerCase();

  if (sourceKey.includes('ai sales db 1')) groups.add(GROUPS.wholesale);
  if (sourceKey.includes('ai sales db 2')) groups.add(GROUPS.retail);
  if (sourceKey.includes('dealer')) groups.add(GROUPS.dealers);
  if (sourceKey.includes('automation')) groups.add(GROUPS.automation);
  if (sourceKey.includes('elasia')) groups.add(GROUPS.electrical);
  if (sourceKey.includes('tamil nadu')) groups.add(GROUPS.tamilNadu);
  if (sourceKey.includes('assocham')) groups.add(GROUPS.association);

  if (/educat|school|college|university|training|institute/.test(haystack)) groups.add(GROUPS.education);
  if (/bank|finance|nbfc|insurance|stock|account|audit|tax|chartered/.test(haystack)) groups.add(GROUPS.finance);
  if (/construction|real estate|infrastructure|builder|architect|property/.test(haystack)) groups.add(GROUPS.realEstate);
  if (/manufactur|industrial|engineering|factory|exporter|automation/.test(haystack)) groups.add(GROUPS.manufacturing);
  if (/service provider|consult|legal|professional firm|law firm|advocate/.test(haystack)) groups.add(GROUPS.services);
  return groups;
}

function setIfPresent(target, key, value) {
  const clean = text(value);
  if (clean && !target[key]) target[key] = clean;
}

function parseWorkbook() {
  const workbook = XLSX.readFile(sourceFile, { raw: false });
  const sheet = workbook.Sheets['Consolidated Records'] || workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('The workbook has no readable worksheet');

  // Row 3 contains column labels; the first two rows are the workbook title and note.
  const rows = XLSX.utils.sheet_to_json(sheet, { range: 2, defval: '', raw: false });
  const contacts = new Map();
  const stats = { sourceRows: rows.length, validRows: 0, invalidRows: 0, dncContacts: 0 };

  for (const row of rows) {
    const email = text(row['Email ID']).toLowerCase();
    if (!EMAIL_RE.test(email)) { stats.invalidRows += 1; continue; }
    stats.validRows += 1;

    const existing = contacts.get(email) || { email, groups: new Set(), dnc: false };
    const name = splitName(row['Contact Person']);
    setIfPresent(existing, 'first_name', name.first_name);
    setIfPresent(existing, 'last_name', name.last_name);
    setIfPresent(existing, 'company', row['Company Name']);
    setIfPresent(existing, 'phone', row['Contact Number']);
    setIfPresent(existing, 'city', row.City);

    for (const group of groupsFor(row['Source Sheet'], row.Profession, row['Company Name'], row['Other Data'])) existing.groups.add(group);
    if (DNC_RE.test(`${row['Other Data']} ${row.Profession}`)) existing.dnc = true;
    contacts.set(email, existing);
  }

  stats.dncContacts = [...contacts.values()].filter((contact) => contact.dnc).length;
  return { contacts, stats };
}

async function ensureGroups(groupNames) {
  const groups = await Promise.all([...groupNames].map(async (name) => Group.findOneAndUpdate(
    { name },
    { $setOnInsert: { name, description: 'Imported from consolidated_records.xlsx for mailing-campaign targeting.' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )));
  return new Map(groups.map((group) => [group.name, group._id]));
}

async function importContacts(contacts) {
  const allGroupNames = new Set([...contacts.values()].flatMap((contact) => [...contact.groups]));
  const groupIds = await ensureGroups(allGroupNames);
  const operations = [...contacts.values()].map((contact) => {
    const $set = {};
    for (const field of ['first_name', 'last_name', 'company', 'phone', 'city']) {
      if (contact[field]) $set[field] = contact[field];
    }
    if (contact.dnc) $set.unsubscribed = true;
    return {
      updateOne: {
        filter: { email: contact.email },
        update: {
          $set,
          $addToSet: { groups: { $each: [...contact.groups].map((name) => groupIds.get(name)) } },
        },
        upsert: true,
      },
    };
  });

  const result = { matched: 0, modified: 0, inserted: 0 };
  for (let i = 0; i < operations.length; i += 500) {
    const batch = await Recipient.bulkWrite(operations.slice(i, i + 500), { ordered: false });
    result.matched += batch.matchedCount || 0;
    result.modified += batch.modifiedCount || 0;
    result.inserted += batch.upsertedCount || 0;
  }
  return { ...result, groupsCreatedOrReused: groupIds.size };
}

const { contacts, stats } = parseWorkbook();
const groupCounts = [...contacts.values()].reduce((counts, contact) => {
  for (const group of contact.groups) counts[group] = (counts[group] || 0) + 1;
  return counts;
}, {});

console.log(JSON.stringify({
  file: path.basename(sourceFile),
  ...stats,
  uniqueContacts: contacts.size,
  targetGroups: groupCounts,
}, null, 2));

if (dryRun) process.exit(0);

try {
  await initDb();
  const result = await importContacts(contacts);
  console.log(JSON.stringify({ importComplete: true, ...result }, null, 2));
} finally {
  await mongoose.disconnect();
}
