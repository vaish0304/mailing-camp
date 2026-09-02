import { parse as parseCsv } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

/** Canonical recipient fields the tool understands. */
export const FIELDS = ['email', 'first_name', 'last_name', 'company', 'phone', 'city'];

// Header aliases -> canonical field. Compared after lower-casing and stripping
// non-alphanumerics, so "First Name", "first-name" and "FIRSTNAME" all match.
const ALIASES = {
  email: 'email',
  emailaddress: 'email',
  mail: 'email',
  firstname: 'first_name',
  fname: 'first_name',
  givenname: 'first_name',
  name: 'first_name',
  contactname: 'first_name',
  lastname: 'last_name',
  lname: 'last_name',
  surname: 'last_name',
  familyname: 'last_name',
  company: 'company',
  companyname: 'company',
  business: 'company',
  businessname: 'company',
  firm: 'company',
  shop: 'company',
  organisation: 'company',
  organization: 'company',
  phone: 'phone',
  phonenumber: 'phone',
  mobile: 'phone',
  mobileno: 'phone',
  contact: 'phone',
  contactno: 'phone',
  whatsapp: 'phone',
  whatsappnumber: 'phone',
  number: 'phone',
  city: 'city',
  town: 'city',
  location: 'city',
  place: 'city',
  cluster: 'city',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normaliseKey(k) {
  return String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function looksLikeXlsx(filename, buffer) {
  if (/\.xlsx?$/i.test(filename || '')) return true;
  // XLSX is a zip -> starts with "PK"; legacy XLS starts with 0xD0CF11E0
  return buffer && buffer.length > 1 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

function rowsFromXlsx(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
}

function rowsFromCsv(buffer) {
  return parseCsv(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  });
}

/**
 * Parse an uploaded CSV or XLSX buffer into clean recipient rows.
 * Returns { recipients, errors, unmappedHeaders, count }.
 */
export function parseRecipientsFile(buffer, filename) {
  const rawRows = looksLikeXlsx(filename, buffer) ? rowsFromXlsx(buffer) : rowsFromCsv(buffer);

  const errors = [];
  const recipients = [];
  const seen = new Set();
  const headerMap = {}; // originalHeader -> canonical
  const unmappedHeaders = new Set();

  rawRows.forEach((row, i) => {
    const lineNo = i + 2; // +1 for header, +1 for 1-indexing

    const mapped = {};
    for (const [key, value] of Object.entries(row)) {
      let canonical = headerMap[key];
      if (canonical === undefined) {
        canonical = ALIASES[normaliseKey(key)] || null;
        headerMap[key] = canonical;
        if (!canonical && String(key).trim()) unmappedHeaders.add(key);
      }
      if (!canonical) continue;
      const v = String(value ?? '').trim();
      // don't overwrite a real value with a blank from a duplicate-mapped column
      if (v && !mapped[canonical]) mapped[canonical] = v;
    }

    const email = (mapped.email || '').toLowerCase();
    if (!email) {
      errors.push({ line: lineNo, reason: 'missing email' });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      errors.push({ line: lineNo, reason: `invalid email "${mapped.email}"` });
      return;
    }
    if (seen.has(email)) {
      errors.push({ line: lineNo, reason: `duplicate in file "${email}"` });
      return;
    }
    seen.add(email);

    recipients.push({
      email,
      first_name: mapped.first_name || null,
      last_name: mapped.last_name || null,
      company: mapped.company || null,
      phone: mapped.phone || null,
      city: mapped.city || null,
    });
  });

  return {
    recipients,
    errors,
    unmappedHeaders: [...unmappedHeaders],
    count: recipients.length,
  };
}
