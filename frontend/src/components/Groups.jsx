import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Button, Card, Input } from '../ui.jsx';

const TEMPLATE = 'email,first_name,last_name,company,phone,city\n'
  + 'rahul@sharmaelectronics.in,Rahul,Sharma,Sharma Electronics,+91 98200 11111,Pune\n';

function downloadTemplate() {
  const blob = new Blob([TEMPLATE], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mailing-camp-template.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Groups({ notify }) {
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const g = await api.listGroups();
      setGroups(g);
      if (selected) setSelected(g.find((x) => x.id === selected.id) || null);
    } catch (e) { notify(e.message, 'error'); }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function createGroup(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.createGroup(name.trim());
      setName('');
      notify('Group created');
      load();
    } catch (e) { notify(e.message, 'error'); }
  }

  async function removeGroup(g) {
    if (!confirm(`Delete group "${g.name}"? Recipients stay in the database.`)) return;
    try {
      await api.deleteGroup(g.id);
      if (selected?.id === g.id) setSelected(null);
      notify('Group deleted');
      load();
    } catch (e) { notify(e.message, 'error'); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="space-y-4">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-bold text-ink-700">New group</h2>
          <form onSubmit={createGroup} className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pune CCTV dealers" />
            <Button type="submit">Add</Button>
          </form>
          <button onClick={downloadTemplate} className="mt-3 text-xs font-semibold text-forest-700 hover:underline">
            ↓ Download CSV template
          </button>
        </Card>

        <Card className="divide-y divide-cream-200">
          {loading && <p className="p-4 text-sm text-ink-500">Loading…</p>}
          {!loading && groups.length === 0 && <p className="p-4 text-sm text-ink-500">No groups yet.</p>}
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelected(g)}
              className={`flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-cream-50 ${
                selected?.id === g.id ? 'bg-cream-100' : ''
              }`}
            >
              <span>
                <span className="block text-sm font-semibold">{g.name}</span>
                <span className="text-xs text-ink-500">{g.recipient_count} recipients</span>
              </span>
              <span
                onClick={(e) => { e.stopPropagation(); removeGroup(g); }}
                className="text-xs text-ink-500 hover:text-red-600"
              >
                Delete
              </span>
            </button>
          ))}
        </Card>
      </div>

      <div>
        {selected
          ? <GroupDetail group={selected} notify={notify} onChange={load} />
          : <Card className="grid h-full place-items-center p-10 text-sm text-ink-500">Select a group to view recipients and import a CSV.</Card>}
      </div>
    </div>
  );
}

const EMPTY_FORM = { email: '', first_name: '', last_name: '', company: '', city: '', phone: '' };

function GroupDetail({ group, notify, onChange }) {
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  async function load() {
    setLoading(true);
    try {
      setRecipients(await api.groupRecipients(group.id));
    } catch (e) { notify(e.message, 'error'); }
    setLoading(false);
  }
  useEffect(() => { load(); setResult(null); /* eslint-disable-next-line */ }, [group.id]);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const r = await api.importCsv(group.id, file);
      setResult(r);
      notify(`Imported: ${r.inserted} new, ${r.updated} updated, ${r.addedToGroup} added to group`);
      load();
      onChange?.();
    } catch (e) {
      setResult(e.data || { error: e.message });
      notify(e.message, 'error');
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function removeMember(rid) {
    try {
      await api.removeMember(group.id, rid);
      load();
      onChange?.();
    } catch (e) { notify(e.message, 'error'); }
  }

  async function addManual(e) {
    e.preventDefault();
    if (!form.email.trim()) return notify('Email is required', 'error');
    setSaving(true);
    try {
      const r = await api.addRecipient(group.id, form);
      notify(r.created ? `Added ${r.recipient.email}` : (r.addedToGroup ? `${r.recipient.email} added to this group` : `${r.recipient.email} is already in this group`));
      setForm(EMPTY_FORM);
      setShowAdd(false);
      load();
      onChange?.();
    } catch (e) { notify(e.message, 'error'); }
    setSaving(false);
  }

  async function deleteRecipient(r) {
    if (!confirm(`Delete ${r.email} completely? They will be removed from every group.`)) return;
    try {
      await api.deleteRecipient(r.id);
      notify(`Deleted ${r.email}`);
      load();
      onChange?.();
    } catch (e) { notify(e.message, 'error'); }
  }

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">{group.name}</h2>
          <p className="text-xs text-ink-500">{recipients.length} recipients</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAdd((s) => !s)}>
            {showAdd ? 'Close' : '+ Add manually'}
          </Button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={onFile} className="hidden" id="csv-input" />
          <Button variant="gold" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? 'Importing…' : 'Upload CSV / Excel'}
          </Button>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={addManual} className="mb-4 rounded-lg border border-cream-200 bg-cream-50 p-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Input required type="email" placeholder="Email *" value={form.email} onChange={setField('email')} />
            <Input placeholder="First name" value={form.first_name} onChange={setField('first_name')} />
            <Input placeholder="Last name" value={form.last_name} onChange={setField('last_name')} />
            <Input placeholder="Company" value={form.company} onChange={setField('company')} />
            <Input placeholder="City" value={form.city} onChange={setField('city')} />
            <Input placeholder="Phone / WhatsApp" value={form.phone} onChange={setField('phone')} />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add to group'}</Button>
            <span className="text-xs text-ink-500">Existing contacts (same email) are updated, not duplicated.</span>
          </div>
        </form>
      )}

      {result && (
        <div className={`mb-4 rounded-lg border p-3 text-xs ${result.error ? 'border-red-200 bg-red-50 text-red-800' : 'border-cream-200 bg-cream-50 text-ink-700'}`}>
          {result.error && <p className="font-semibold">{result.error}</p>}
          {result.parsed != null && (
            <p>Parsed {result.parsed} rows · {result.inserted} new · {result.updated} updated · {result.addedToGroup} added · {result.alreadyInGroup} already in group</p>
          )}
          {result.unmappedHeaders?.length > 0 && <p className="mt-1">Ignored columns: {result.unmappedHeaders.join(', ')}</p>}
          {result.rowErrors?.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer font-semibold">{result.rowErrors.length} row issue(s)</summary>
              <ul className="mt-1 list-disc pl-5">
                {result.rowErrors.slice(0, 30).map((er, i) => <li key={i}>line {er.line}: {er.reason}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-cream-200 text-xs uppercase text-ink-500">
            <tr>
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Company</th>
              <th className="py-2 pr-3">City</th>
              <th className="py-2 pr-3">Phone</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-100">
            {loading && <tr><td colSpan="6" className="py-4 text-ink-500">Loading…</td></tr>}
            {!loading && recipients.length === 0 && (
              <tr><td colSpan="6" className="py-4 text-ink-500">No recipients yet — add one manually or upload a CSV.</td></tr>
            )}
            {recipients.map((r) => (
              <tr key={r.id} className={r.unsubscribed ? 'opacity-50' : ''}>
                <td className="py-2 pr-3 font-medium">{r.email}{r.unsubscribed && <span className="ml-1 text-xs text-red-600">(unsub)</span>}</td>
                <td className="py-2 pr-3">{[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}</td>
                <td className="py-2 pr-3">{r.company || '—'}</td>
                <td className="py-2 pr-3">{r.city || '—'}</td>
                <td className="py-2 pr-3">{r.phone || '—'}</td>
                <td className="whitespace-nowrap py-2 text-right">
                  <button onClick={() => removeMember(r.id)} className="text-xs text-ink-500 hover:text-forest-700">Remove</button>
                  <button onClick={() => deleteRecipient(r)} className="ml-3 text-xs text-ink-500 hover:text-red-600">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
