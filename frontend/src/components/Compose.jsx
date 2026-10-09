import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Button, Card, Input, Textarea } from '../ui.jsx';
import { TEMPLATES, DEFAULT_TEMPLATE_ID } from '../templates.js';

const TOKENS = ['first_name', 'last_name', 'company', 'city', 'phone', 'email'];
const initial = TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID) || TEMPLATES[0];

export default function Compose({ notify, onSent, project }) {
  const [groups, setGroups] = useState([]);
  const [groupIds, setGroupIds] = useState([]);
  const [templateId, setTemplateId] = useState(initial.id);
  const [subject, setSubject] = useState(initial.subject);
  const [html, setHtml] = useState(initial.html);
  const [preview, setPreview] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [busy, setBusy] = useState('');
  const [limits, setLimits] = useState(null);
  const [targetLimit, setTargetLimit] = useState(100);

  useEffect(() => {
    Promise.all([api.listGroups(project.id), api.campaignLimits()])
      .then(([rows, caps]) => { setGroups(rows); setLimits(caps); setTargetLimit(Math.min(100, caps.remaining)); })
      .catch((e) => notify(e.message, 'error'));
  }, [notify, project.id]);

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
    if (!confirm(`Start a batch of up to ${targetLimit} eligible recipient(s) for "${subject}" across ${groupIds.length} group(s)?`)) return;
    setBusy('send');
    try {
      const r = await api.sendCampaign({ subject, html, groupIds, projectId: project.id, targetLimit });
      notify(`Campaign started: ${r.totalRecipients} recipients. ${r.deferredCount ? `${r.deferredCount} remain for a later batch.` : 'All selected contacts are in this batch.'}`);
      onSent?.();
    } catch (e) { notify(e.message, 'error'); }
    setBusy('');
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <Card className="space-y-4 p-5">
        <div>
          <label className="mb-2 block text-sm font-semibold text-ink-700">Template gallery</label>
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
          <p className="mt-2 text-xs text-ink-500">Choose a design, then tailor the message and preview it against a real contact.</p>
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
          <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="your test email" className="max-w-[220px]" />
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
        <Card className="border-forest-700/15 bg-forest-950 p-4 text-cream-50">
          <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-cream-200/70">Daily send safety</p><p className="mt-1 text-2xl font-bold">{limits ? `${limits.remaining} left` : 'Loading…'}</p><p className="mt-1 text-xs text-cream-200/70">of {limits?.dailyLimit || 100} emails today · one email every {Math.round((limits?.sendGapMs || 1000) / 1000)}s</p></div><span className="rounded-full bg-white/10 px-2 py-1 text-xs">{limits?.used || 0} sent</span></div>
          <label className="mt-4 block text-xs font-semibold text-cream-100">This batch</label>
          <Input type="number" min="1" max={Math.min(100, limits?.remaining || 100)} value={targetLimit} onChange={(e) => setTargetLimit(Math.min(Math.max(Number(e.target.value) || 1, 1), Math.min(100, limits?.remaining || 100)))} className="mt-1 border-white/20 bg-white/10 text-white placeholder:text-cream-200/50" />
          <p className="mt-2 text-xs text-cream-200/70">Only the first eligible contacts, ordered by email, will enter this batch. Use a smaller batch to test a segment.</p>
        </Card>
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
              {selectedCount} group memberships selected. Duplicates and unsubscribed contacts are removed before the {targetLimit}-contact batch is created.
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
