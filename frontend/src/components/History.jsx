import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Badge, Button, Card } from '../ui.jsx';

export default function History({ notify, project }) {
  const [campaigns, setCampaigns] = useState([]);
  const [open, setOpen] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    try {
      const rows = await api.listCampaigns();
      setCampaigns(rows.filter((campaign) => !campaign.project_id || campaign.project_id === project.id));
    }
    catch (e) { notify(e.message, 'error'); }
  }, [notify, project.id]);

  useEffect(() => { load(); }, [load]);

  // poll while anything is still sending
  useEffect(() => {
    const active = campaigns.some((c) => c.status === 'sending');
    if (!active && !open) return;
    const t = setInterval(async () => {
      await load();
      if (open) { try { setDetail(await api.getCampaign(open)); } catch { /* ignore */ } }
    }, 3000);
    return () => clearInterval(t);
  }, [campaigns, open, load]);

  async function openCampaign(id) {
    setOpen(id);
    setDetail(null);
    try { setDetail(await api.getCampaign(id)); }
    catch (e) { notify(e.message, 'error'); }
  }

  async function deleteCampaign(c) {
    if (!confirm(`Delete campaign "${c.subject}"? This removes its send log — emails already sent are not affected.`)) return;
    try {
      await api.deleteCampaign(c.id);
      notify('Campaign deleted');
      if (open === c.id) { setOpen(null); setDetail(null); }
      load();
    } catch (e) { notify(e.message, 'error'); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card className="divide-y divide-cream-200">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-sm font-bold text-ink-700">Campaigns</h2>
          <Button variant="ghost" onClick={load}>Refresh</Button>
        </div>
        {campaigns.length === 0 && <p className="p-4 text-sm text-ink-500">No campaigns sent yet.</p>}
        {campaigns.map((c) => (
          <div key={c.id}
            onClick={() => openCampaign(c.id)}
            className={`cursor-pointer px-4 py-3 hover:bg-cream-50 ${open === c.id ? 'bg-cream-100' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{c.subject}</span>
              <div className="flex shrink-0 items-center gap-2">
                <Badge status={c.status} />
                <button
                  onClick={(e) => { e.stopPropagation(); deleteCampaign(c); }}
                  className="text-xs text-ink-500 hover:text-red-600">Delete</button>
              </div>
            </div>
            <p className="mt-0.5 text-xs text-ink-500">
              {new Date(c.created_at).toLocaleString()} · {c.sent_count}/{c.total_recipients} sent
              {c.failed_count > 0 && <span className="text-red-600"> · {c.failed_count} failed</span>}
            </p>
          </div>
        ))}
      </Card>

      <div>
        {!open && <Card className="grid h-full place-items-center p-10 text-sm text-ink-500">Select a campaign for delivery details.</Card>}
        {open && !detail && <Card className="p-5 text-sm text-ink-500">Loading…</Card>}
        {detail && (
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-bold">{detail.campaign.subject}</h2>
              <div className="flex shrink-0 items-center gap-3">
                <Badge status={detail.campaign.status} />
                <button
                  onClick={() => deleteCampaign(detail.campaign)}
                  className="text-xs text-ink-500 hover:text-red-600">Delete</button>
              </div>
            </div>
            <p className="text-xs text-ink-500">
              From {detail.campaign.from_email} · {new Date(detail.campaign.created_at).toLocaleString()}
            </p>
            {detail.campaign.error && <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-800">{detail.campaign.error}</p>}

            <div className="my-4 flex flex-wrap gap-2 text-xs">
              {Object.entries(detail.stats).map(([k, v]) => (
                <span key={k} className="rounded-full bg-cream-100 px-2.5 py-1 font-semibold capitalize text-ink-700">{k}: {v}</span>
              ))}
            </div>

            <div className="max-h-96 overflow-auto rounded border border-cream-200">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-cream-50 text-xs uppercase text-ink-500">
                  <tr><th className="px-3 py-2">Email</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Note</th></tr>
                </thead>
                <tbody className="divide-y divide-cream-100">
                  {detail.sends.map((s) => (
                    <tr key={s.id}>
                      <td className="px-3 py-1.5">{s.email}</td>
                      <td className="px-3 py-1.5"><Badge status={s.status} /></td>
                      <td className="px-3 py-1.5 text-xs text-red-600">{s.error || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
