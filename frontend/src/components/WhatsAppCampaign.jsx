import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Badge, Button, Card, Input } from '../ui.jsx';

export default function WhatsAppCampaign({ notify, project }) {
  const [groups, setGroups] = useState([]); const [groupIds, setGroupIds] = useState([]);
  const [status, setStatus] = useState(null); const [campaigns, setCampaigns] = useState([]); const [busy, setBusy] = useState(false);
  const [templateName, setTemplateName] = useState(''); const [languageCode, setLanguageCode] = useState('en_US');
  const [values, setValues] = useState(''); const [targetLimit, setTargetLimit] = useState(25);

  async function load() {
    try {
      const [groupRows, meta, campaignRows] = await Promise.all([api.listGroups(project.id), api.whatsappStatus(), api.listWhatsAppCampaigns(project.id)]);
      setGroups(groupRows); setStatus(meta); setCampaigns(campaignRows); setTargetLimit((current) => Math.min(current, meta.remaining || 1));
    } catch (error) { notify(error.message, 'error'); }
  }
  useEffect(() => { setGroupIds([]); load(); /* eslint-disable-next-line */ }, [project.id]);
  useEffect(() => {
    if (!campaigns.some((campaign) => campaign.status === 'sending')) return undefined;
    const timer = setInterval(load, 3000); return () => clearInterval(timer);
  }, [campaigns]);

  const selected = groups.filter((group) => groupIds.includes(group.id));
  const eligible = selected.reduce((sum, group) => sum + (group.whatsapp_eligible_count || 0), 0);
  const toggle = (id) => setGroupIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
  async function send() {
    if (!status?.configured) return notify('Add the Meta Cloud API environment variables to the backend first', 'error');
    if (!groupIds.length) return notify('Select at least one audience group', 'error');
    if (!templateName.trim()) return notify('Enter the approved Meta template name', 'error');
    if (!eligible) return notify('This selection has no phone contacts with recorded WhatsApp consent', 'error');
    if (!confirm(`Send the approved WhatsApp template to up to ${targetLimit} consented contacts? This cannot be recalled.`)) return;
    setBusy(true);
    try {
      const result = await api.sendWhatsAppCampaign({ projectId: project.id, groupIds, templateName, languageCode, bodyValues: values.split('\n').map((value) => value.trim()).filter(Boolean), targetLimit });
      notify(`WhatsApp campaign started for ${result.totalRecipients} consented contacts.`); await load();
    } catch (error) { notify(error.message, 'error'); }
    setBusy(false);
  }

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
    <div className="space-y-5"><Card className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-ink-900">WhatsApp template campaign</h2><p className="mt-1 text-sm text-ink-500">Send Meta-approved templates only. Free-form business-initiated messages are not supported here.</p></div><Badge status={status?.configured ? 'sent' : 'failed'} /></div>{!status?.configured && <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Backend setup required: add <code>WHATSAPP_ACCESS_TOKEN</code>, <code>WHATSAPP_PHONE_NUMBER_ID</code>, <code>WHATSAPP_WEBHOOK_VERIFY_TOKEN</code>, and <code>META_APP_SECRET</code> to the server environment. Do not enter these values in this app.</div>}<div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold text-ink-700">Approved template name<Input value={templateName} onChange={(event) => setTemplateName(event.target.value.replace(/\s+/g, '_').toLowerCase())} placeholder="e.g. enquiry_follow_up" className="mt-1" /></label><label className="text-sm font-semibold text-ink-700">Language code<Input value={languageCode} onChange={(event) => setLanguageCode(event.target.value)} placeholder="en_US" className="mt-1" /></label></div><label className="mt-3 block text-sm font-semibold text-ink-700">Body variables <span className="font-normal text-ink-500">(one value per line, in Meta template order)</span><textarea value={values} onChange={(event) => setValues(event.target.value)} rows="4" placeholder={'{{first_name}}\n{{company}}'} className="mt-1 w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm outline-none focus:border-forest-600" /></label><p className="mt-2 text-xs text-ink-500">Tokens such as <code>{'{{first_name}}'}</code> and <code>{'{{company}}'}</code> are resolved individually. The number and order of values must exactly match the approved Meta template.</p><div className="mt-5 flex flex-wrap items-center gap-3"><label className="text-sm font-semibold text-ink-700">Send limit<Input type="number" min="1" max={Math.min(100, status?.remaining || 1)} value={targetLimit} onChange={(event) => setTargetLimit(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} className="mt-1 w-28" /></label><Button variant="gold" onClick={send} disabled={busy || !status?.configured}>{busy ? 'Starting…' : `Send WhatsApp batch${eligible ? ` · ${Math.min(targetLimit, eligible)}` : ''}`}</Button></div></Card>
      <Card className="divide-y divide-cream-200"><div className="px-4 py-3"><h3 className="text-sm font-bold text-ink-700">Recent WhatsApp campaigns</h3></div>{campaigns.length === 0 && <p className="p-4 text-sm text-ink-500">No WhatsApp campaigns yet.</p>}{campaigns.map((campaign) => <div key={campaign.id} className="px-4 py-3"><div className="flex items-center justify-between gap-3"><p className="font-mono text-sm font-semibold">{campaign.template_name}</p><Badge status={campaign.status} /></div><p className="mt-1 text-xs text-ink-500">{campaign.sent_count}/{campaign.total_recipients} sent · {campaign.failed_count || 0} failed · {new Date(campaign.created_at).toLocaleString()}</p>{campaign.error && <p className="mt-1 text-xs text-red-600">{campaign.error}</p>}</div>)}</Card></div>
    <div className="space-y-4"><Card className="p-4" style={{ background: '#071f18', color: '#fefcf7', borderColor: '#195b47' }}><p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#b9d7ca' }}>WhatsApp send safety</p><div className="mt-1 flex items-end justify-between"><p className="text-2xl font-bold">{status ? `${status.remaining} left` : 'Loading…'}</p><span className="text-xs" style={{ color: '#d9e9e2' }}>{status?.used || 0}/{status?.dailyLimit || 100} today</span></div><p className="mt-1 text-xs" style={{ color: '#b9d7ca' }}>One message every {Math.round((status?.sendGapMs || 1000) / 1000)}s. Only consented phone contacts can be selected.</p></Card><Card className="p-4"><h3 className="mb-2 text-sm font-bold text-ink-700">Audience</h3><div className="space-y-1">{groups.map((group) => <label key={group.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-cream-50"><input type="checkbox" checked={groupIds.includes(group.id)} onChange={() => toggle(group.id)} /><span className="flex-1">{group.name}</span><span className="text-xs text-ink-500">{group.whatsapp_eligible_count || 0} consented</span></label>)}</div>{groupIds.length > 0 && <p className="mt-3 border-t border-cream-200 pt-2 text-xs text-ink-500">Up to {eligible} consented contacts are eligible before duplicate phone numbers are removed.</p>}</Card></div>
  </div>;
}
