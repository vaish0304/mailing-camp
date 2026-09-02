import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Button, Card, Input, Textarea } from '../ui.jsx';
import { TEMPLATES, DEFAULT_TEMPLATE_ID } from '../templates.js';

const TOKENS = ['first_name', 'last_name', 'company', 'city', 'phone', 'email'];
const initial = TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID) || TEMPLATES[0];

export default function Compose({ notify, onSent }) {
  const [groups, setGroups] = useState([]);
  const [groupIds, setGroupIds] = useState([]);
  const [templateId, setTemplateId] = useState(initial.id);
  const [subject, setSubject] = useState(initial.subject);
  const [html, setHtml] = useState(initial.html);
  const [preview, setPreview] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    api.listGroups().then(setGroups).catch((e) => notify(e.message, 'error'));
  }, [notify]);

  const selectedCount = groups
    .filter((g) => groupIds.includes(g.id))
    .reduce((n, g) => n + g.recipient_count, 0);

  function toggle(id) {
    setGroupIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
    setPreview(null);
  }

  function applyTemplate(id) {
    setTemplateId(id);
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    const dirty = subject.trim() || html.trim();
    if (dirty && !confirm(`Replace the current subject and body with the "${t.name}" template?`)) return;
    setSubject(t.subject);
    setHtml(t.html);
    setPreview(null);
  }

  async function doPreview() {
    if (!groupIds.length) return notify('Pick at least one group', 'error');
    setBusy('preview');
    try {
      setPreview(await api.previewCampaign({ subject, html, groupIds }));
    } catch (e) { notify(e.message, 'error'); }
    setBusy('');
  }

  async function doTest() {
    if (!testEmail.trim()) return notify('Enter a test email', 'error');
    setBusy('test');
    try {
      await api.testCampaign({ subject, html, email: testEmail.trim() });
      notify(`Test sent to ${testEmail}`);
    } catch (e) { notify(e.message, 'error'); }
    setBusy('');
  }

  async function doSend() {
    if (!subject.trim() || !html.trim() || !groupIds.length) {
      return notify('Subject, body and at least one group are required', 'error');
    }
    if (!confirm(`Send "${subject}" to ${selectedCount} recipient(s) across ${groupIds.length} group(s)?`)) return;
    setBusy('send');
    try {
      const r = await api.sendCampaign({ subject, html, groupIds });
      notify(`Campaign #${r.id} started — sending to ${r.totalRecipients}`);
      onSent?.();
    } catch (e) { notify(e.message, 'error'); }
    setBusy('');
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card className="space-y-4 p-5">
        <div>
          <label className="mb-1 block text-sm font-semibold text-ink-700">Template</label>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  templateId === t.id
                    ? 'border-forest-700 bg-forest-700 text-cream-50'
                    : 'border-cream-200 text-ink-700 hover:bg-cream-100'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-ink-700">Subject</label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Reply to every WhatsApp inquiry in seconds" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-ink-700">HTML body</label>
          <Textarea rows={14} value={html} onChange={(e) => setHtml(e.target.value)} className="font-mono text-xs" />
          <p className="mt-1 text-xs text-ink-500">
            Personalisation tokens:{' '}
            {TOKENS.map((t) => (
              <button key={t} onClick={() => setHtml((h) => `${h}{{${t}}}`)} className="mr-1 rounded bg-cream-100 px-1.5 py-0.5 font-mono text-forest-700 hover:bg-cream-200">
                {`{{${t}}}`}
              </button>
            ))}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-cream-200 pt-4">
          <Button variant="outline" onClick={doPreview} disabled={busy === 'preview'}>
            {busy === 'preview' ? 'Loading…' : 'Preview'}
          </Button>
          <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" className="max-w-[220px]" />
          <Button variant="outline" onClick={doTest} disabled={busy === 'test'}>
            {busy === 'test' ? 'Sending…' : 'Send test'}
          </Button>
          <div className="flex-1" />
          <Button variant="gold" onClick={doSend} disabled={busy === 'send'}>
            {busy === 'send' ? 'Starting…' : `Send to ${selectedCount}`}
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-bold text-ink-700">Audience</h3>
          {groups.length === 0 && <p className="text-sm text-ink-500">No groups — create one first.</p>}
          <div className="space-y-1">
            {groups.map((g) => (
              <label key={g.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-cream-50">
                <input type="checkbox" checked={groupIds.includes(g.id)} onChange={() => toggle(g.id)} />
                <span className="flex-1">{g.name}</span>
                <span className="text-xs text-ink-500">{g.recipient_count}</span>
              </label>
            ))}
          </div>
          {groupIds.length > 0 && (
            <p className="mt-2 border-t border-cream-200 pt-2 text-xs text-ink-500">
              ~{selectedCount} recipients (unsubscribed & duplicates removed at send time)
            </p>
          )}
        </Card>

        {preview && (
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-bold text-ink-700">Preview</h3>
            <p className="text-xs text-ink-500">Rendered for {preview.sampleRecipient?.email} · {preview.recipientCount} will receive it</p>
            <p className="mt-2 text-sm font-semibold">{preview.renderedSubject || <span className="text-red-600">(empty subject)</span>}</p>
            <div className="mt-2 max-h-72 overflow-auto rounded border border-cream-200 bg-white p-3 text-sm" dangerouslySetInnerHTML={{ __html: preview.renderedHtml }} />
          </Card>
        )}
      </div>
    </div>
  );
}
