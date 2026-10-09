const DEFAULT_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';

export function getConfig() {
  return {
    base: (localStorage.getItem('mc_api_base') || DEFAULT_BASE).replace(/\/$/, ''),
    token: localStorage.getItem('mc_token') || '',
  };
}

export function setConfig({ base, token }) {
  if (base !== undefined) localStorage.setItem('mc_api_base', base);
  if (token !== undefined) localStorage.setItem('mc_token', token);
}

async function req(path, { method = 'GET', body, form } = {}) {
  const { base, token } = getConfig();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`${base}${path}`, { method, headers, body: payload });
  } catch (networkErr) {
    console.error(`[api] ${method} ${path} — network/CORS failure`, networkErr);
    const err = new Error(`Can't reach ${base} (network or CORS). Check the backend URL in Settings and CORS_ORIGIN on the server.`);
    err.status = 0;
    throw err;
  }
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    let msg = (data && data.error) || res.statusText || 'Request failed';
    if (res.status === 401) msg = 'Unauthorized — open Settings and enter the admin token.';
    console.error(`[api] ${method} ${path} → ${res.status}`, data);
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  health: () => req('/api/health'),

  listProjects: () => req('/api/projects'),
  createProject: (body) => req('/api/projects', { method: 'POST', body }),
  updateProject: (id, body) => req(`/api/projects/${id}`, { method: 'PATCH', body }),
  deleteProject: (id) => req(`/api/projects/${id}`, { method: 'DELETE' }),

  listGroups: (projectId) => req(`/api/groups${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`),
  createGroup: (name, description, projectId) => req('/api/groups', { method: 'POST', body: { name, description, projectId } }),
  updateGroup: (id, patch) => req(`/api/groups/${id}`, { method: 'PATCH', body: patch }),
  deleteGroup: (id) => req(`/api/groups/${id}`, { method: 'DELETE' }),
  groupRecipients: (id) => req(`/api/groups/${id}/recipients`),
  addRecipient: (id, recipient) => req(`/api/groups/${id}/recipients`, { method: 'POST', body: recipient }),
  removeMember: (gid, rid) => req(`/api/groups/${gid}/members/${rid}`, { method: 'DELETE' }),
  importCsv: (id, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return req(`/api/groups/${id}/import`, { method: 'POST', form: fd });
  },

  listRecipients: (search = '') => req(`/api/recipients?search=${encodeURIComponent(search)}`),
  deleteRecipient: (id) => req(`/api/recipients/${id}`, { method: 'DELETE' }),
  updateRecipient: (id, patch) => req(`/api/recipients/${id}`, { method: 'PATCH', body: patch }),

  listCampaigns: () => req('/api/campaigns'),
  campaignLimits: () => req('/api/campaigns/limits'),
  getCampaign: (id) => req(`/api/campaigns/${id}`),
  deleteCampaign: (id) => req(`/api/campaigns/${id}`, { method: 'DELETE' }),
  previewCampaign: (body) => req('/api/campaigns/preview', { method: 'POST', body }),
  testCampaign: (body) => req('/api/campaigns/test', { method: 'POST', body }),
  sendCampaign: (body) => req('/api/campaigns', { method: 'POST', body }),
};
