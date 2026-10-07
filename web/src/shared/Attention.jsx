import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../core/store.jsx';
import { fmt, docTypes, STATUS_LABEL } from '../core/shared.js';
import { canModule, can } from '../core/access.js';
import { buildAttention, leaveActions } from '../core/attention.js';
import { Icon, StatusPill, ActionPill, LeavePill, DocViewer } from '../core/ui.jsx';
import { UploadDocModal, RenewalActionModal } from '../core/docModals.jsx';
import { empParam } from '../hr/data.js';

const RANGES = [['att', 'Needs attention'], ['0', 'Expired'], ['30', '≤ 30 days'], ['60', '≤ 60 days'], ['90', '≤ 90 days'], ['180', '≤ 6 months']];

export default function Attention({ }) {
  const { state } = useStore();
  const u = state.user;
  const both = canModule(u, 'hr') && canModule(u, 'fleet');
  const initial = location.hash.split('.')[1];
  const blank = { module: '', company: '', department: '', location: '', type: '', status: '', officer: '', range: 'att' };
  const [f, setF] = useState(() => ({ ...blank, officer: initial === 'mine' ? u.id : '', status: initial === 'missing' ? 'missing' : '' }));
  useEffect(() => { if (initial === 'mine') setF((x) => ({ ...x, officer: u.id })); if (initial === 'missing') setF((x) => ({ ...x, status: 'missing' })); }, [initial]);
  const [viewing, setViewing] = useState(null);
  const [upload, setUpload] = useState(null);
  const [tracking, setTracking] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const all = useMemo(() => buildAttention(state, u, 180), [state, u]);
  const rows = all.filter((i) => {
    if (f.module && i.module !== f.module) return false;
    if (f.company && i.company !== f.company) return false;
    if (f.department && i.department !== f.department) return false;
    if (f.location && i.location !== f.location) return false;
    if (f.type && i.type !== f.type) return false;
    if (f.status && i.st.key !== f.status) return false;
    if (f.officer && i.officer.id !== f.officer) return false;
    if (f.range === 'att') return i.kind === 'missing' || ['expired', 'critical', 'due'].includes(i.st.key);
    if (i.kind === 'missing') return f.status === 'missing';
    return i.d <= +f.range;
  }).sort((a, b) => (a.kind === 'missing') - (b.kind === 'missing') || (a.d ?? 0) - (b.d ?? 0));
  const leaves = leaveActions(state, u).filter((l) => (!f.module || f.module === 'hr') && (!f.department || state.employees.find((e) => e.id === l.empId).department === f.department));
  const officers = state.config.users.filter((x) => state.config.docTypes.some((t) => t.officer === x.id));
  const types = docTypes().filter((t) => !f.module || t.module === f.module);
  const count = (m, k) => all.filter((i) => (!m || i.module === m) && (k === 'missing' ? i.kind === 'missing' : i.kind === 'doc' && i.st.key === k)).length;
  const fresh = (i) => { const list = i.module === 'hr' ? state.employees : state.assets; const o = list.find((x) => x.id === i.ownerId); return { owner: o, doc: o.docs.find((d) => d.type === i.type) }; };
  const active = Object.entries(f).filter(([k, v]) => v && !(k === 'range' && v === 'att')).length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Integrated management dashboard</span>
          <h1>Attention Centre</h1>
          <p className="muted">Every expiring or missing document and pending leave action you're permitted to see, from both modules, in one list.</p>
        </div>
      </div>

      <section className="panel flush">
        <div className="table-wrap">
          <table className="table num matrix">
            <thead><tr><th>Module</th><th>Expired</th><th>Urgent</th><th>Renewal due</th><th>Monitor</th><th>Missing</th><th>Leave actions</th></tr></thead>
            <tbody>
              {[['hr', 'Employee Management'], ['fleet', 'Vehicle & Equipment']].filter(([m]) => canModule(u, m)).map(([m, l]) => (
                <tr key={m}>
                  <td>{l}</td>
                  {['expired', 'critical', 'due', 'monitor', 'missing'].map((k) => <td key={k}><button className={'cell-btn c-' + k} onClick={() => setF({ ...blank, module: m, status: k, range: k === 'monitor' ? '90' : 'att' })}>{count(m, k) || '·'}</button></td>)}
                  <td>{m === 'hr' ? leaveActions(state, u).length : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel flush">
        <div className="panel-tools">
          {both && <select id="at-mod" value={f.module} onChange={set('module')} aria-label="Module"><option value="">Both modules</option><option value="hr">Employee Management</option><option value="fleet">Vehicle &amp; Equipment</option></select>}
          <select id="at-co" value={f.company} onChange={set('company')} aria-label="Company"><option value="">Any company</option>{state.config.companies.map((c) => <option key={c.id} value={c.name}>{c.short}</option>)}</select>
          <select id="at-dept" value={f.department} onChange={set('department')} aria-label="Department"><option value="">Any department</option>{state.config.departments.map((d) => <option key={d.id}>{d.name}</option>)}</select>
          <select id="at-loc" value={f.location} onChange={set('location')} aria-label="Branch / location"><option value="">Any branch / location</option>{state.config.locations.map((d) => <option key={d.id}>{d.name}</option>)}</select>
          <select id="at-type" value={f.type} onChange={set('type')} aria-label="Document type"><option value="">Any document type</option>{types.map((t) => <option key={t.key}>{t.key}</option>)}</select>
          <select id="at-status" value={f.status} onChange={set('status')} aria-label="Status"><option value="">Any status</option>{['expired', 'critical', 'due', 'monitor', 'missing'].map((k) => <option key={k} value={k}>{k === 'missing' ? 'Missing / no scan' : STATUS_LABEL[k]}</option>)}</select>
          <select id="at-off" value={f.officer} onChange={set('officer')} aria-label="Responsible officer"><option value="">Any responsible officer</option>{officers.map((o) => <option key={o.id} value={o.id}>{o.name}{o.id === u.id ? ' (me)' : ''}</option>)}</select>
          <select id="at-range" value={f.range} onChange={set('range')} aria-label="Expiry range">{RANGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          {active > 0 && <button className="btn btn-ghost" onClick={() => setF(blank)}>Clear {active} filter{active > 1 ? 's' : ''}</button>}
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Module</th><th>Record</th><th>Document</th><th>Expiry</th><th>Status</th><th>Action · responsible</th><th className="right">Do</th></tr></thead>
            <tbody>
              {rows.slice(0, 150).map((i, k) => {
                const ok = can(u, 'uploadDoc', { type: i.type });
                return (
                  <tr key={k}>
                    <td><span className={'mod-tag mt-' + i.module}>{i.module === 'hr' ? 'HR' : 'Fleet'}</span></td>
                    <td><a className="who" href={i.link}><strong>{i.module === 'hr' ? i.ownerName : i.ownerId}</strong><small>{i.module === 'hr' ? i.ownerId : i.ownerName} · {i.department.replace(' Department', '')}</small></a></td>
                    <td>{i.doc?.name || i.type}</td>
                    <td className="mono nowrap">{fmt(i.doc?.expiry)}</td>
                    <td>{i.doc ? <StatusPill doc={i.doc} /> : <span className="pill pill-missing">{i.st.label}</span>}</td>
                    <td className="small"><ActionPill status={i.action} /><span className="block muted">{i.officer.name}</span></td>
                    <td className="right nowrap actions">
                      {i.doc?.file && <button className="btn btn-sm btn-ghost" aria-label="View scan" onClick={() => setViewing(fresh(i) && { ...fresh(i), module: i.module })}><Icon n="eye" size={14} /></button>}
                      {ok && i.kind === 'doc' && <button className="btn btn-sm" onClick={() => setTracking({ ...fresh(i), module: i.module })}>Action</button>}
                      {ok && <button className="btn btn-sm btn-primary" onClick={() => setUpload({ ...fresh(i), module: i.module, type: i.type, mode: i.kind === 'doc' ? 'renew' : 'upload' })}>{i.kind === 'doc' ? 'Renew' : 'Complete'}</button>}
                      {!ok && <a className="btn btn-sm" href={i.link}>Open</a>}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={7} className="empty-cell">Nothing matches these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="pager"><span className="muted small">{rows.length} document items{rows.length > 150 ? ' · showing first 150' : ''}</span></div>
      </section>

      {canModule(u, 'hr') && leaves.length > 0 && (
        <section className="panel flush">
          <div className="panel-head pad"><h2>Leave actions</h2><a className="link" href="#hr-leave">Open Leave &amp; Rejoining <Icon n="arrow" size={14} /></a></div>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Ref.</th><th>Employee</th><th>Type</th><th>Dates</th><th>Stage</th></tr></thead>
            <tbody>{leaves.map((l) => { const e = state.employees.find((x) => x.id === l.empId); return (
              <tr key={l.id}><td className="mono small">{l.id}</td><td><a className="who" href={`#hr-employee.${empParam(e.id)}`}><strong>{e.name}</strong><small className="mono">{e.id}</small></a></td><td>{l.type}</td><td className="mono small">{fmt(l.start)} → {fmt(l.end)}</td><td><LeavePill status={l.status} /></td></tr>
            ); })}</tbody>
          </table></div>
        </section>
      )}

      {viewing && <DocViewer owner={viewing.owner} module={viewing.module} doc={viewing.doc} onClose={() => setViewing(null)} />}
      {tracking && <RenewalActionModal module={tracking.module} owner={tracking.owner} doc={tracking.doc} onClose={() => setTracking(null)} />}
      {upload && <UploadDocModal module={upload.module} owner={upload.owner} docType={upload.type} mode={upload.mode} onClose={() => setUpload(null)} />}
    </div>
  );
}
