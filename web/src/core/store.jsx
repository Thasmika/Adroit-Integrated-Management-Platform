import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { setConfig, docCfg } from './shared.js';

// ---------- API client ----------
export class ApiError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}
export async function api(method, url, body) {
  const opts = { method, credentials: 'same-origin', headers: { 'x-adroit-client': 'web' } };
  if (body instanceof FormData) opts.body = body;
  else if (body !== undefined) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
  let res;
  try { res = await fetch(url, opts); } catch { throw new ApiError(0, "Can't reach the server. Check the network connection and try again.", 'network'); }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
  if (!res.ok) {
    const err = new ApiError(res.status, data?.error || `Request failed (${res.status})`, data?.code);
    if (res.status === 401 || data?.code === 'must_change_password') window.dispatchEvent(new CustomEvent('auth-lost', { detail: err }));
    throw err;
  }
  return data;
}

const StoreCtx = createContext(null);
const upsert = (list, item, key = 'id') => (list.some((x) => x[key] === item[key]) ? list.map((x) => (x[key] === item[key] ? item : x)) : [item, ...list]);

export function StoreProvider({ children }) {
  const [state, setState] = useState({ phase: 'loading', user: null, config: null, employees: [], leaves: [], assets: [], error: null });
  const [toast, setToast] = useState(null);
  const [unread, setUnread] = useState(0);
  const notify = useCallback((m, kind = 'ok') => setToast({ m, kind }), []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), toast.kind === 'error' ? 5000 : 2800); return () => clearTimeout(t); }, [toast]);

  const applyConfig = (config) => { setConfig(config); return config; };
  const load = useCallback(async () => {
    const b = await api('GET', '/api/bootstrap');
    applyConfig(b.config);
    setState({ phase: 'ready', user: b.user, config: b.config, employees: b.employees, leaves: b.leaves, assets: b.assets, error: null });
    api('GET', '/api/notifications').then((n) => setUnread(n.unread)).catch(() => {});
  }, []);

  const start = useCallback(async () => {
    try {
      const { user } = await api('GET', '/api/auth/me');
      if (user.mustChangePassword) setState((s) => ({ ...s, phase: 'password', user }));
      else await load();
    } catch (e) {
      setState((s) => ({ ...s, phase: 'login', user: null, error: e.status === 401 ? null : e.message }));
    }
  }, [load]);
  useEffect(() => { start(); }, [start]);
  useEffect(() => {
    const lost = (ev) => setState((s) => (s.phase === 'login' ? s : { ...s, phase: ev.detail?.code === 'must_change_password' ? 'password' : 'login', error: ev.detail?.code === 'must_change_password' ? null : 'Your session ended. Please sign in again.' }));
    window.addEventListener('auth-lost', lost);
    return () => window.removeEventListener('auth-lost', lost);
  }, []);
  // refresh the unread badge every 2 minutes
  const poll = useRef(null);
  useEffect(() => {
    if (state.phase !== 'ready') return;
    poll.current = setInterval(() => api('GET', '/api/notifications').then((n) => setUnread(n.unread)).catch(() => {}), 120000);
    return () => clearInterval(poll.current);
  }, [state.phase]);

  const patch = (k, item) => setState((s) => ({ ...s, [k]: upsert(s[k], item) }));
  const patchOwner = (module, item) => patch(module === 'hr' ? 'employees' : 'assets', item);
  const setCfg = (config) => setState((s) => ({ ...s, config: applyConfig(config) }));
  const enc = encodeURIComponent;

  const act = useMemo(() => ({
    refresh: load,
    async login(email, password) {
      const { user } = await api('POST', '/api/auth/login', { email, password });
      if (user.mustChangePassword) setState((s) => ({ ...s, phase: 'password', user }));
      else await load();
    },
    async logout() { await api('POST', '/api/auth/logout').catch(() => {}); location.hash = ''; setState({ phase: 'login', user: null, config: null, employees: [], leaves: [], assets: [], error: null }); },
    async changePassword(currentPassword, newPassword) { await api('POST', '/api/auth/change-password', { currentPassword, newPassword }); await load(); },
    // employees / assets
    async saveEmployee(emp, editingNo) {
      const e = await api(editingNo ? 'PUT' : 'POST', editingNo ? `/api/employees/${enc(editingNo)}` : '/api/employees', emp);
      patch('employees', e); return e;
    },
    async saveAsset(asset, editingNo) {
      const a = await api(editingNo ? 'PUT' : 'POST', editingNo ? `/api/assets/${enc(editingNo)}` : '/api/assets', asset);
      patch('assets', a); return a;
    },
    async uploadPhoto(module, no, file) {
      const fd = new FormData(); fd.append('file', file);
      const o = await api('POST', `/api/${module === 'hr' ? 'employees' : 'assets'}/${enc(no)}/photo`, fd);
      patchOwner(module, o); return o;
    },
    // documents & renewal actions
    async saveDoc(module, no, type, mode, fields, file) {
      const fd = new FormData(); fd.append('mode', mode);
      Object.entries(fields).forEach(([k, v]) => v != null && fd.append(k, v));
      if (file) fd.append('file', file);
      const o = await api('POST', `/api/documents/${module}/${enc(no)}/${enc(type)}`, fd);
      patchOwner(module, o); return o;
    },
    async updateAction(module, no, type, status, note) {
      const o = await api('PUT', `/api/actions/${module}/${enc(no)}/${enc(type)}`, { status, note });
      patchOwner(module, o); return o;
    },
    // leave
    async submitLeave(leave) { const l = await api('POST', '/api/leave', leave); patch('leaves', l); return l; },
    async leaveAction(id, action, body) { const l = await api('POST', `/api/leave/${enc(id)}/${action}`, body); patch('leaves', l); return l; },
    // AI, search, notifications, audit
    ask: (question) => api('POST', '/api/ai/ask', { question }),
    notifications: () => api('GET', '/api/notifications'),
    async readNotification(id) { await api('POST', `/api/notifications/${id}/read`); setUnread((n) => Math.max(0, n - 1)); },
    async readAll() { await api('POST', '/api/notifications/read-all'); setUnread(0); },
    audit: (params) => api('GET', '/api/audit?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null))),
    assetHistory: (no) => api('GET', `/api/assets/${enc(no)}/history`),
    actionHistory: (module, no, type) => api('GET', `/api/documents/${module}/${enc(no)}/${enc(type)}/actions`),
    // administration
    async docType(key, p) { setCfg(await api('PUT', `/api/admin/doc-types/${enc(key)}`, p)); },
    async listAdd(list, item) { setCfg(await api('POST', `/api/admin/lists/${list}`, item)); },
    async listUpdate(list, key, p) { setCfg(await api('PUT', `/api/admin/lists/${list}/${enc(key)}`, p)); },
    async userAdd(u) { const r = await api('POST', '/api/admin/users', u); setCfg(r.config); return r; },
    async userUpdate(id, p) { setCfg(await api('PUT', `/api/admin/users/${enc(id)}`, p)); },
    userReset: (id) => api('POST', `/api/admin/users/${enc(id)}/reset-password`),
    async template(id, p) { setCfg(await api('PUT', `/api/admin/templates/${enc(id)}`, p)); },
    async system(p) { setCfg(await api('PUT', '/api/admin/system', p)); },
    health: () => api('GET', '/api/admin/health'),
    runJob: (job) => api('POST', `/api/admin/jobs/${job}/run`),
    verifyEmail: () => api('POST', '/api/admin/email/verify'),
    importCsv(kind, mode, file) { const fd = new FormData(); fd.append('file', file); return api('POST', `/api/import/${kind}?mode=${mode}`, fd); },
    importBatches: () => api('GET', '/api/import/batches'),
  }), [load]);

  // run an action, show its error as a toast, and return true / false
  const run = useCallback(async (fn, okMsg) => {
    try { const r = await fn(); if (okMsg) notify(typeof okMsg === 'function' ? okMsg(r) : okMsg); return r ?? true; } catch (e) { notify(e.message, 'error'); return false; }
  }, [notify]);

  return (
    <StoreCtx.Provider value={{ state, act, run, notify, unread, setUnread }}>
      {children}
      {toast && <div className={'toast' + (toast.kind === 'error' ? ' toast-error' : '')} role={toast.kind === 'error' ? 'alert' : 'status'}>{toast.m}</div>}
    </StoreCtx.Provider>
  );
}
export const useStore = () => useContext(StoreCtx);

// ---------- routing: #page or #page.param ----------
const parse = () => {
  const h = location.hash.replace(/^#/, '');
  if (!h) return { page: 'home', param: null };
  const i = h.indexOf('.');
  return i === -1 ? { page: h, param: null } : { page: h.slice(0, i), param: h.slice(i + 1) };
};
export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => { setRoute(parse()); document.querySelector('.main')?.scrollTo?.(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
export const go = (page, param) => { location.hash = param ? `${page}.${param}` : page; };
export const href = (page, param) => '#' + (param ? `${page}.${param}` : page);

const pending = {};
export const setPending = (k, v) => { pending[k] = v; window.dispatchEvent(new Event('pending-' + k)); };
export const takePending = (k) => { const v = pending[k] || ''; pending[k] = ''; return v; };

// client-side pre-check; the server re-checks size and content type (§9)
export function checkFile(file, system) {
  if (!file) return null;
  const ext = (file.name.split('.').pop() || '').toUpperCase().replace('JPEG', 'JPG').replace('TIF', 'TIFF').replace('TIFFF', 'TIFF');
  if (!system.fileTypes.includes(ext)) return `This file type (.${ext.toLowerCase()}) isn't allowed. Allowed: ${system.fileTypes.join(', ')}.`;
  if (file.size > system.maxFileMB * 1024 * 1024) return `The file is ${(file.size / 1048576).toFixed(1)} MB. The limit is ${system.maxFileMB} MB.`;
  return null;
}
export const docModule = (type) => docCfg(type).module;
