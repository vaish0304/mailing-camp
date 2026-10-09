import { useCallback, useEffect, useState } from 'react';
import { api, getConfig, setConfig } from './api.js';
import { Button, Card, Input, Toast } from './ui.jsx';
import Groups from './components/Groups.jsx';
import Compose from './components/Compose.jsx';
import History from './components/History.jsx';

const TABS = [
  { id: 'audience', label: 'Audience' },
  { id: 'compose', label: 'Campaign studio' },
  { id: 'history', label: 'Activity' },
];

export default function App() {
  const [tab, setTab] = useState('audience');
  const [toast, setToast] = useState(null);
  const [health, setHealth] = useState(null);
  const [cfg, setCfg] = useState(getConfig());
  const [showSettings, setShowSettings] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(localStorage.getItem('mc_project') || '');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newProject, setNewProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  const notify = useCallback((message, type = 'ok') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);
  const checkHealth = useCallback(async () => {
    try { setHealth({ ok: true, ...(await api.health()) }); }
    catch (e) { setHealth({ ok: false, error: e.message }); }
  }, []);
  const loadProjects = useCallback(async () => {
    try {
      const rows = await api.listProjects();
      setProjects(rows);
      const active = rows.some((project) => project.id === projectId) ? projectId : rows[0]?.id;
      if (active) { setProjectId(active); localStorage.setItem('mc_project', active); }
    } catch (e) { notify(e.message, 'error'); }
  }, [notify, projectId]);

  useEffect(() => { checkHealth(); }, [checkHealth, cfg]);
  useEffect(() => { if (health?.ok) loadProjects(); }, [health?.ok, loadProjects]);
  function chooseProject(id) { setProjectId(id); localStorage.setItem('mc_project', id); setTab('audience'); }
  function saveSettings(e) {
    e.preventDefault(); const fd = new FormData(e.target);
    setConfig({ base: fd.get('base').trim(), token: fd.get('token').trim() });
    setCfg(getConfig()); setShowSettings(false); notify('Settings saved');
  }
  async function createProject(e) {
    e.preventDefault(); if (!projectName.trim()) return;
    try {
      const created = await api.createProject({ name: projectName.trim(), description: projectDescription.trim() });
      setProjectName(''); setProjectDescription(''); setNewProject(false);
      await loadProjects(); chooseProject(created.id); notify('Mailing project created');
    } catch (error) { notify(error.message, 'error'); }
  }

  const activeProject = projects.find((project) => project.id === projectId);
  return (
    <div className="min-h-full bg-cream-50 lg:flex">
      <aside className={`${sidebarOpen ? 'w-full lg:w-72' : 'w-full lg:w-16'} shrink-0 border-b border-cream-200 bg-forest-950 text-cream-50 lg:min-h-screen lg:border-b-0 lg:border-r transition-all`}>
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          {sidebarOpen && <div><p className="font-display text-base font-bold">Mailing Camp</p><p className="text-[11px] text-cream-200/70">Campaign workspaces</p></div>}
          <button aria-label="Toggle sidebar" onClick={() => setSidebarOpen((open) => !open)} className="rounded-lg p-2 text-cream-200 hover:bg-white/10">☰</button>
        </div>
        {sidebarOpen && <div className="p-3">
          <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-[.14em] text-cream-200/60">Projects</p>
          <div className="space-y-1">{projects.map((project) => <button key={project.id} onClick={() => chooseProject(project.id)} className={`w-full rounded-xl px-3 py-2.5 text-left transition ${project.id === projectId ? 'bg-white/14 text-white' : 'text-cream-200 hover:bg-white/8'}`}><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color }} /><span className="truncate text-sm font-semibold">{project.name}</span></span><span className="ml-4 block text-xs text-cream-200/60">{project.group_count} groups</span></button>)}</div>
          <button onClick={() => setNewProject(true)} className="mt-3 w-full rounded-xl border border-dashed border-cream-200/30 px-3 py-2 text-sm font-semibold text-cream-100 hover:bg-white/10">+ New mailing project</button>
        </div>}
      </aside>
      <div className="min-w-0 flex-1">
        <header className="border-b border-cream-200 bg-white px-5 py-4 lg:px-8"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-forest-600">{activeProject?.name || 'Mailing workspace'}</p><h1 className="font-display text-xl font-bold text-ink-900">Campaign control center</h1></div><div className="flex items-center gap-3 text-xs"><span className={health?.ok ? 'text-forest-600' : 'text-red-600'}>● {health?.ok ? 'Backend connected' : 'Backend unavailable'}</span><button onClick={() => setShowSettings((show) => !show)} className="rounded-lg border border-cream-200 px-3 py-2 font-semibold text-ink-700 hover:bg-cream-100">Settings</button></div></div></header>
        {showSettings && <div className="border-b border-cream-200 bg-cream-100"><form onSubmit={saveSettings} className="mx-auto grid max-w-7xl gap-3 px-5 py-4 sm:grid-cols-[1fr_1fr_auto] lg:px-8"><Input name="base" defaultValue={cfg.base} placeholder="Backend URL" /><Input name="token" type="password" defaultValue={cfg.token} placeholder="Admin token" /><Button type="submit">Save settings</Button></form></div>}
        {newProject && <div className="mx-auto max-w-7xl px-5 pt-5 lg:px-8"><Card className="p-4"><form onSubmit={createProject} className="grid gap-3 md:grid-cols-[1fr_2fr_auto]"><Input autoFocus value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project name, e.g. New product launch" /><Input value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} placeholder="Purpose or audience" /><div className="flex gap-2"><Button type="submit">Create project</Button><Button type="button" variant="ghost" onClick={() => setNewProject(false)}>Cancel</Button></div></form></Card></div>}
        <main className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
          {!health?.ok && <Card className="mb-5 border-red-200 bg-red-50 p-4 text-sm text-red-800">Cannot reach the backend. Check the URL and token in Settings.</Card>}
          {health?.ok && !cfg.token && health.authRequired && <Card className="mb-5 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">This workspace needs its admin token before contacts or campaigns can be changed.</Card>}
          <nav className="mb-6 flex gap-1 rounded-xl border border-cream-200 bg-white p-1">{TABS.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold ${tab === item.id ? 'bg-forest-700 text-cream-50' : 'text-ink-500 hover:bg-cream-100'}`}>{item.label}</button>)}</nav>
          {!activeProject ? <Card className="p-8 text-center text-ink-500">Create a mailing project to begin.</Card> : <>{tab === 'audience' && <Groups notify={notify} project={activeProject} />}{tab === 'compose' && <Compose notify={notify} project={activeProject} onSent={() => setTab('history')} />}{tab === 'history' && <History notify={notify} project={activeProject} />}</>}
        </main>
      </div>
      <Toast toast={toast} />
    </div>
  );
}
