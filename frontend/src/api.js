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
  const res = await fetch(`${base}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && data.error) || res.statusText || 'Request failed';
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  health: () => req('/api/health'),

  listGroups: () => req('/api/groups'),
  createGroup: (name, description) => req('/api/groups', { method: 'POST', body: { name, description } }),
  updateGroup: (id, patch) => req(`/api/groups/${id}`, { method: 'PATCH', body: patch }),
  deleteGroup: (id) => req(`/api/groups/${id}`, { method: 'DELETE' }),
  groupRecipients: (id) => req(`/api/groups/${id}/recipients`),
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
  getCampaign: (id) => req(`/api/campaigns/${id}`),
  previewCampaign: (body) => req('/api/campaigns/preview', { method: 'POST', body }),
  testCampaign: (body) => req('/api/campaigns/test', { method: 'POST', body }),
  sendCampaign: (body) => req('/api/campaigns', { method: 'POST', body }),
};
