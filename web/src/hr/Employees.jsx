import React, { useMemo, useState } from 'react';
import { useStore, go, href } from '../core/store.jsx';
import { docStatus, docTypes, fmt, OPERATING, ROLES } from '../core/shared.js';
import { scopeEmployees, canSeeDoc, can } from '../core/access.js';
import { Icon, Avatar } from '../core/ui.jsx';
import { hrMissing, empParam, HR_STATUSES } from './data.js';

const PAGE = 20;

export default function Employees() {
  const { state } = useStore();
  const u = state.user;
  const all = scopeEmployees(u, state.employees);
  const noDocs = ROLES[u.role].noDocs;
  const types = docTypes('hr').filter((t) => t.required && canSeeDoc(u, t.key));
  const [f, setF] = useState({ q: '', dept: '', loc: '', nat: '', sponsor: '', status: '', flag: '' });
  const [page, setPage] = useState(0);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setPage(0); };
  const nats = useMemo(() => [...new Set(all.map((e) => e.nationality))].sort(), [all]);

  const rows = useMemo(() => {
    const t = f.q.trim().toLowerCase();
    return all.filter((e) => {
      if (f.dept && e.department !== f.dept) return false;
      if (f.loc && e.location !== f.loc) return false;
      if (f.nat && e.nationality !== f.nat) return false;
      if (f.status && e.status !== f.status) return false;
      if (f.sponsor === 'adroit' && e.sponsor !== OPERATING) return false;
      if (f.sponsor === 'group' && e.sponsor === OPERATING) return false;
      if (f.flag === 'attention' && !e.docs.some((d) => canSeeDoc(u, d.type) && ['expired', 'critical', 'due'].includes(docStatus(d).key))) return false;
      if (f.flag === 'missing' && !hrMissing(e).some((m) => canSeeDoc(u, m.type))) return false;
      if (!t) return true;
      return [e.name, e.id, e.designation, e.department, e.nationality, e.mobile, ...e.docs.filter((d) => canSeeDoc(u, d.type)).map((d) => d.ref)].join(' ').toLowerCase().includes(t);
    });
  }, [all, f, u]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const view = rows.slice(page * PAGE, (page + 1) * PAGE);
  const any = Object.values(f).some(Boolean);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Employee Master</span>
          <h1>Employees</h1>
          <p className="muted">{all.length} records{u.scope ? ` in ${u.scope}` : ` across ${state.config.departments.length} departments and branches`}.</p>
        </div>
        {can(u, 'editEmployee') && <div className="head-actions"><a className="btn" href="#hr-import"><Icon n="upload" size={16} /> Import CSV</a><button className="btn btn-primary" onClick={() => go('hr-new')}><Icon n="plus" size={16} /> Add employee</button></div>}
      </div>

      <div className="filters">
        <div className="search-box"><Icon n="search" /><input id="emp-search" value={f.q} onChange={set('q')} placeholder={noDocs ? 'Name, EMP no., designation' : 'Name, EMP no., passport, EID…'} aria-label="Search employees" /></div>
        {!u.scope && <select id="f-dept" value={f.dept} onChange={set('dept')} aria-label="Department"><option value="">All departments</option>{state.config.departments.map((d) => <option key={d.id}>{d.name}</option>)}</select>}
        <select id="f-loc" value={f.loc} onChange={set('loc')} aria-label="Branch / location"><option value="">All branches / locations</option>{state.config.locations.map((d) => <option key={d.id}>{d.name}</option>)}</select>
        <select id="f-nat" value={f.nat} onChange={set('nat')} aria-label="Nationality"><option value="">All nationalities</option>{nats.map((d) => <option key={d}>{d}</option>)}</select>
        <select id="f-sponsor" value={f.sponsor} onChange={set('sponsor')} aria-label="Visa sponsor"><option value="">Any visa sponsor</option><option value="adroit">Adroit visa</option><option value="group">Group company visa</option></select>
        <select id="f-status" value={f.status} onChange={set('status')} aria-label="Employment status"><option value="">Any status</option>{HR_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        {!noDocs && <select id="f-flag" value={f.flag} onChange={set('flag')} aria-label="Document status"><option value="">Any document status</option><option value="attention">Needs renewal / expired</option><option value="missing">Missing document or scan</option></select>}
        {any && <button className="btn btn-ghost" onClick={() => { setF({ q: '', dept: '', loc: '', nat: '', sponsor: '', status: '', flag: '' }); setPage(0); }}>Clear</button>}
      </div>

      <section className="panel flush">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Employee</th><th>Designation</th><th>Department · location</th><th>Nationality</th><th>Visa sponsor</th><th>Joined</th>{!noDocs && <th>Documents</th>}</tr></thead>
            <tbody>
              {view.map((e) => (
                <tr key={e.id} className="clickable" onClick={() => go('hr-employee', empParam(e.id))}>
                  <td><div className="who-row"><Avatar name={e.name} size={34} photo={e.photo} /><div className="who"><a href={href('hr-employee', empParam(e.id))} onClick={(ev) => ev.stopPropagation()}><strong>{e.name}</strong></a><small className="mono">{e.id}{e.status !== 'Active' && ` · ${e.status}`}</small></div></div></td>
                  <td>{e.designation}</td>
                  <td>{e.department.replace(' Department', '')}<small className="block muted">{e.location}</small></td>
                  <td>{e.nationality}</td>
                  <td>{e.sponsor === OPERATING ? 'Adroit' : <span className="tag">{state.config.companies.find((c) => c.name === e.sponsor)?.short || e.sponsor}</span>}</td>
                  <td className="mono small nowrap">{fmt(e.joined)}</td>
                  {!noDocs && <td><div className="dots">{types.map((t) => {
                    const d = e.docs.find((x) => x.type === t.key);
                    const s = docStatus(d);
                    const k = !d || !d.file ? 'missing' : s.key;
                    return <span key={t.key} className={'dot-chip dc-' + k} title={`${t.key}: ${s.label}${d && !d.file ? ' (no scan)' : ''}`}>{t.short}</span>;
                  })}</div></td>}
                </tr>
              ))}
              {view.length === 0 && <tr><td colSpan={7} className="empty-cell">No employees match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="pager">
          <span className="muted small">Showing {rows.length ? page * PAGE + 1 : 0}–{Math.min(rows.length, (page + 1) * PAGE)} of {rows.length}</span>
          <div className="pager-btns">
            <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
            <span className="small">Page {page + 1} / {pages}</span>
            <button className="btn btn-sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      </section>
      {!noDocs && <p className="legend small muted">Document chips: <span className="dot-chip dc-valid">OK</span> valid · <span className="dot-chip dc-monitor">MON</span> monitor · <span className="dot-chip dc-due">DUE</span> renewal due · <span className="dot-chip dc-critical">URG</span> urgent · <span className="dot-chip dc-expired">EXP</span> expired · <span className="dot-chip dc-missing">—</span> no scan / not recorded. Thresholds are set per document type in Administration.</p>}
    </div>
  );
}
