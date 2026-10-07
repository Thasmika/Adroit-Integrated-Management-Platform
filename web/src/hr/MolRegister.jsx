// MOL register (Changes Report 01, item 2): two tables
//   Company Name → MOL Code      (each company has one unique MOL code)
//   Employee Name → Emp (MOL) ID (each employee has one unique MOL person ID)
// HR and the System Administrator edit the codes in place; other HR-module roles see them read-only.
import React, { useMemo, useState } from 'react';
import { useStore, href } from '../core/store.jsx';
import { scopeEmployees, can } from '../core/access.js';
import { Icon } from '../core/ui.jsx';
import { empParam } from './data.js';

const PAGE = 25;

function EditCell({ id, value, onSave, canEdit, label }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value || '');
  const [busy, setBusy] = useState(false);
  if (!editing) return (
    <div className="mol-cell">
      {value ? <span className="mono">{value}</span> : <span className="muted small">Not recorded</span>}
      {canEdit && <button className="btn btn-sm btn-ghost" id={id + '-edit'} onClick={() => { setV(value || ''); setEditing(true); }} aria-label={`Edit ${label}`}><Icon n="edit" size={14} /> {value ? 'Edit' : 'Add'}</button>}
    </div>
  );
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await onSave(v.trim());
    setBusy(false);
    if (ok) setEditing(false);
  };
  return (
    <form className="mol-cell editing" onSubmit={save}>
      <input id={id} value={v} onChange={(e) => setV(e.target.value)} maxLength={40} autoFocus aria-label={label} onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }} />
      <button className="btn btn-sm btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      <button className="btn btn-sm btn-ghost" type="button" onClick={() => setEditing(false)}>Cancel</button>
    </form>
  );
}

export default function MolRegister() {
  const { state, act, run } = useStore();
  const u = state.user;
  const canEdit = can(u, 'editEmployee');
  const companies = state.config.companies;
  const emps = scopeEmployees(u, state.employees);
  const [q, setQ] = useState('');
  const [missing, setMissing] = useState(false);
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return emps
      .filter((e) => !missing || !e.molId)
      .filter((e) => !t || [e.name, e.id, e.code, e.molId].join(' ').toLowerCase().includes(t))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [emps, q, missing]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const view = rows.slice(page * PAGE, (page + 1) * PAGE);
  const withId = emps.filter((e) => e.molId).length;

  const saveCompany = async (c, code) => !!(await run(() => act.saveCompanyMol(c.id, code), code ? `MOL code for ${c.short} saved` : `MOL code for ${c.short} cleared`));
  const saveEmp = async (e, molId) => !!(await run(() => act.saveEmployeeMol(e.id, molId), molId ? `Emp (MOL) ID for ${e.name} saved` : `Emp (MOL) ID for ${e.name} cleared`));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Employee Management</span>
          <h1>MOL Register</h1>
          <p className="muted">Ministry of Labour (MOHRE) codes: one MOL code per company and one Emp (MOL) ID per employee. Both must be unique.</p>
        </div>
      </div>

      <section className="panel flush">
        <div className="panel-head pad"><h2>Company MOL codes</h2><span className="muted small">{companies.filter((c) => c.molCode).length} of {companies.length} recorded</span></div>
        <div className="table-wrap">
          <table className="table" id="mol-companies">
            <thead><tr><th>Company Name</th><th>MOL Code</th><th className="right">Employees sponsored</th></tr></thead>
            <tbody>{companies.map((c) => (
              <tr key={c.id} className={c.active ? '' : 'inactive'}>
                <td><strong>{c.name}</strong><small className="block muted">{c.kind}{c.active ? '' : ' · inactive'}</small></td>
                <td><EditCell id={'mol-co-' + c.id} value={c.molCode} canEdit={canEdit} label={`MOL code for ${c.name}`} onSave={(v) => saveCompany(c, v)} /></td>
                <td className="right">{emps.filter((e) => e.sponsor === c.name).length}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="panel flush">
        <div className="panel-head pad"><h2>Employee Emp (MOL) IDs</h2><span className="muted small">{withId} of {emps.length} recorded</span></div>
        <div className="filters pad-x">
          <div className="search-box"><Icon n="search" /><input id="mol-search" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Name, EMP no., code or MOL ID" aria-label="Search employees" /></div>
          <label className="check small"><input type="checkbox" checked={missing} onChange={(e) => { setMissing(e.target.checked); setPage(0); }} /> Only employees without an Emp (MOL) ID</label>
        </div>
        <div className="table-wrap">
          <table className="table" id="mol-employees">
            <thead><tr><th>Employee Name</th><th>Emp (MOL) ID</th><th>Sponsor</th></tr></thead>
            <tbody>
              {view.map((e) => (
                <tr key={e.id}>
                  <td><a href={href('hr-employee', empParam(e.id))}><strong>{e.name}</strong></a><small className="block muted mono">{e.id}{e.code ? ` · ${e.code}` : ''}</small></td>
                  <td><EditCell id={'mol-emp-' + e.id.replace(/\W/g, '')} value={e.molId} canEdit={canEdit} label={`Emp (MOL) ID for ${e.name}`} onSave={(v) => saveEmp(e, v)} /></td>
                  <td className="small">{companies.find((c) => c.name === e.sponsor)?.short || e.sponsor}</td>
                </tr>
              ))}
              {view.length === 0 && <tr><td colSpan={3} className="empty-cell">No employees match.</td></tr>}
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
    </div>
  );
}
