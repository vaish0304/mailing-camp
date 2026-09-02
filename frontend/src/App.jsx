import { useCallback, useEffect, useState } from 'react';
import { api, getConfig, setConfig } from './api.js';
import { Button, Card, Input, Toast } from './ui.jsx';
import Groups from './components/Groups.jsx';
import Compose from './components/Compose.jsx';
import History from './components/History.jsx';

const TABS = [
  { id: 'groups', label: 'Groups & Recipients' },
  { id: 'compose', label: 'Compose & Send' },
  { id: 'history', label: 'History' },
];

export default function App() {
  const [tab, setTab] = useState('groups');
  const [toast, setToast] = useState(null);
  const [health, setHealth] = useState(null);
  const [cfg, setCfg] = useState(getConfig());
  const [showSettings, setShowSettings] = useState(false);

  const notify = useCallback((message, type = 'ok') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const h = await api.health();
      setHealth({ ok: true, ...h });
    } catch (e) {
      setHealth({ ok: false, error: e.message });
    }
  }, []);

  useEffect(() => { checkHealth(); }, [checkHealth, cfg]);

  function saveSettings(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    setConfig({ base: fd.get('base').trim(), token: fd.get('token').trim() });
    setCfg(getConfig());
    setShowSettings(false);
    notify('Settings saved');
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-cream-200 bg-forest-900 text-cream-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div>
            <h1 className="text-lg font-bold">Mailing Camp</h1>
            <p className="text-xs text-cream-200/80">Resend campaign console · AI Sales Assistant</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className={`flex items-center gap-1.5 ${health?.ok ? 'text-green-300' : 'text-red-300'}`}>
              <span className={`h-2 w-2 rounded-full ${health?.ok ? 'bg-green-400' : 'bg-red-400'}`} />
              {health?.ok ? `from ${health.from}` : 'backend unreachable'}
            </span>
            <button onClick={() => setShowSettings((s) => !s)} className="rounded-lg border border-cream-200/30 px-3 py-1.5 hover:bg-forest-800">
              Settings
            </button>
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="border-b border-cream-200 bg-cream-100">
          <form onSubmit={saveSettings} className="mx-auto grid max-w-6xl gap-3 px-5 py-4 sm:grid-cols-[1fr_1fr_auto]">
            <label className="text-sm">
              <span className="mb-1 block font-semibold text-ink-700">Backend URL</span>
              <Input name="base" defaultValue={cfg.base} placeholder="https://mailing-camp-backend.onrender.com" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-semibold text-ink-700">Admin token</span>
              <Input name="token" type="password" defaultValue={cfg.token} placeholder="ADMIN_TOKEN value" />
            </label>
            <div className="flex items-end">
              <Button type="submit">Save</Button>
            </div>
          </form>
        </div>
      )}

      {!health?.ok && (
        <div className="mx-auto max-w-6xl px-5 pt-5">
          <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Can't reach the backend at <code className="font-mono">{cfg.base}</code>. Open <b>Settings</b> and set the
            Render URL {health?.error ? <>· <span className="font-mono">{health.error}</span></> : null}
          </Card>
        </div>
      )}

      <nav className="mx-auto max-w-6xl px-5 pt-5">
        <div className="flex gap-1 border-b border-cream-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
                tab === t.id
                  ? 'border-forest-700 text-forest-700'
                  : 'border-transparent text-ink-500 hover:text-forest-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-5 py-6">
        {tab === 'groups' && <Groups notify={notify} />}
        {tab === 'compose' && <Compose notify={notify} onSent={() => setTab('history')} />}
        {tab === 'history' && <History notify={notify} />}
      </main>

      <Toast toast={toast} />
    </div>
  );
}
