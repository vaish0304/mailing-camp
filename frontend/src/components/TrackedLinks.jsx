import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Button, Card, Input } from '../ui.jsx';

const validUrl = (value) => /^https?:\/\//i.test(value.trim());
const when = (value) => value ? new Date(value).toLocaleString() : 'No clicks yet';

export default function TrackedLinks({ notify, project }) {
  const [links, setLinks] = useState([]);
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => setLinks(await api.listLinks(project.id)), [project.id]);
  useEffect(() => { load().catch((error) => notify(error.message, 'error')); }, [load, notify]);

  async function createLink(event) {
    event.preventDefault();
    if (!validUrl(destination)) return notify('Enter a valid HTTP or HTTPS destination URL', 'error');
    setBusy('create');
    try {
      const created = await api.createLink({ name: name.trim(), destinationUrl: destination.trim(), projectId: project.id });
      setLinks((rows) => [created, ...rows]); setName(''); setDestination('');
      await navigator.clipboard?.writeText(created.tracked_url);
      notify('Tracked link created and copied');
    } catch (error) { notify(error.message, 'error'); }
    setBusy('');
  }

  async function remove(link) {
    if (!confirm(`Delete the tracked link "${link.name}" and its click history?`)) return;
    setBusy(link.id);
    try { await api.deleteLink(link.id); setLinks((rows) => rows.filter((row) => row.id !== link.id)); notify('Tracked link deleted'); }
    catch (error) { notify(error.message, 'error'); }
    setBusy('');
  }

  return <div className="space-y-5">
    <Card className="p-5">
      <div className="mb-4"><h2 className="font-display text-xl font-bold text-ink-900">Tracked link generator</h2><p className="mt-1 text-sm text-ink-500">Create a measurable link for a video, Drive file, website or any other destination. Use the generated URL in your email template.</p></div>
      <form onSubmit={createLink} className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name, e.g. Product demo" />
        <Input required value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="https://drive.google.com/..." />
        <Button type="submit" disabled={busy === 'create'}>{busy === 'create' ? 'Creating…' : 'Generate tracked link'}</Button>
      </form>
    </Card>
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-cream-200 p-5"><div><h3 className="font-bold text-ink-900">Link activity</h3><p className="text-xs text-ink-500">Click totals update whenever a recipient opens a tracked link.</p></div><Button type="button" variant="outline" onClick={() => load().catch((error) => notify(error.message, 'error'))}>Refresh</Button></div>
      {!links.length ? <p className="p-8 text-center text-sm text-ink-500">No tracked links created for this project yet.</p> : <div className="divide-y divide-cream-200">{links.map((link) => <div key={link.id} className="grid gap-3 p-5 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto] lg:items-center">
        <div className="min-w-0"><p className="font-semibold text-ink-900">{link.name}</p><p className="truncate text-xs text-ink-500" title={link.destination_url}>{link.destination_url}</p><p className="mt-1 truncate font-mono text-xs text-forest-700" title={link.tracked_url}>{link.tracked_url}</p></div>
        <div><p className="text-xs text-ink-500">Clicks</p><p className="font-bold text-ink-900">{link.click_count || 0} total · {link.unique_click_count || 0} unique</p></div>
        <div><p className="text-xs text-ink-500">Last activity</p><p className="text-sm font-semibold text-ink-700">{when(link.last_clicked_at)}</p></div>
        <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => navigator.clipboard?.writeText(link.tracked_url).then(() => notify('Tracked link copied'))}>Copy</Button><Button type="button" variant="danger" disabled={busy === link.id} onClick={() => remove(link)}>Delete</Button></div>
      </div>)}</div>}
    </Card>
  </div>;
}
