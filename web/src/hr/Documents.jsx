import React, { useEffect, useMemo, useState } from 'react';
import { useStore, href } from '../core/store.jsx';
import { fmt, docTypes, officerFor, actionStatus, docStatus } from '../core/shared.js';
import { scopeEmployees, canSeeDoc, can } from '../core/access.js';
import { Icon, Tabs, StatusPill, DocViewer, Avatar, Empty, ActionPill } from '../core/ui.jsx';
import { UploadDocModal, RenewalActionModal } from '../core/docModals.jsx';
import { hrExpiryRows, hrMissing, empParam, maskNo } from './data.js';

const TABS = ['expiry', 'alerts', 'library', 'missing'];

export default function HrDocuments({ initialTab }) {
  const { state } = useStore();
  const u = state.user;
  const [tab, setTab] = useState(TABS.includes(initialTab) ? initialTab : 'expiry');
  useEffect(() => { if (TABS.includes(initialTab)) setTab(initialTab); }, [initialTab]);
  const [win, setWin] = useState(60);
  const visTypes = docTypes('hr').filter((t) => t.expires && canSeeDoc(u, t.key)).map((t) => t.key);
  const [types, setTypes] = useState(visTypes);
  const [f, setF] = useState({ officer: '', dept: '', loc: '', company: '', action: '' });
  const [q, setQ] = useState('');
  const [viewing, setViewing] = useState(null);
  const [upload, setUpload] = useState(null);
  const [tracking, setTracking] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const emps = scopeEmployees(u, state.employees);
  const rows = hrExpiryRows(emps, win, types.filter((t) => canSeeDoc(u, t))).filter((r) => (!f.officer || officerFor(r.doc.type).id === f.officer) && (!f.dept || r.emp.department === f.dept) && (!f.loc || r.emp.location === f.loc) && (!f.company || r.emp.sponsor === f.company) && (!f.action || actionStatus(r.doc) === f.action));
  const mine = hrExpiryRows(emps, 60).filter((r) => canSeeDoc(u, r.doc.type) && officerFor(r.doc.type).id === u.id);
  const missing = useMemo(() => { const out = []; emps.forEach((e) => hrMissing(e).forEach((m) => { if (canSeeDoc(u, m.type)) out.push({ emp: e, ...m }); })); return out; }, [emps, u]);
  const all90 = hrExpiryRows(emps, 90).filter((r) => canSeeDoc(u, r.doc.type));
  const count = (k) => all90.filter((r) => r.st.key === k).length;
  const lib = useMemo(() => {
    const t = q.trim().toLowerCase();
    const out = [];
    emps.forEach((e) => { if (t && !`${e.name} ${e.id} ${e.docs.map((d) => d.ref).join(' ')}`.toLowerCase().includes(t)) return; e.docs.forEach((d) => { if (d.file && canSeeDoc(u, d.type)) out.push({ emp: e, doc: d }); }); });
    return out;
  }, [emps, q, u]);
  const fresh = (e, type) => { const x = state.employees.find((y) => y.id === e.id); return { emp: x, doc: x.docs.find((d) => d.type === type) }; };
  const officers = state.config.users.filter((x) => docTypes('hr').some((t) => t.officer === x.id));

  const ExpiryTable = ({ list }) => (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Employee</th><th>Document</th><th>Expiry</th><th>Status</th><th>Action · responsible</th><th className="right">Do</th></tr></thead>
        <tbody>
          {list.map((r, i) => {
            const ok = can(u, 'uploadDoc', { type: r.doc.type });
            return (
              <tr key={r.emp.id + r.doc.type + i}>
                <td><a className="who" href={href('hr-employee', empParam(r.emp.id))}><strong>{r.emp.name}</strong><small className="mono">{r.emp.id} · {r.emp.department.replace(' Department', '')}</small></a></td>
                <td>{r.doc.type}<small className="block muted mono">{maskNo(r.doc.ref, r.doc.type)}{r.doc.type === 'Employment Visa' && r.emp.sponsor !== r.emp.company ? ' · group visa' : ''}</small></td>
                <td className="mono nowrap">{fmt(r.doc.expiry)}</td>
                <td><StatusPill doc={r.doc} /></td>
                <td className="small"><ActionPill status={actionStatus(r.doc)} /><span className="block muted">{officerFor(r.doc.type).name}</span></td>
                <td className="right nowrap actions">
                  {r.doc.file && <button className="btn btn-sm btn-ghost" onClick={() => setViewing(fresh(r.emp, r.doc.type))} aria-label="View scan"><Icon n="eye" size={14} /></button>}
                  {ok && <button className="btn btn-sm" onClick={() => setTracking(fresh(r.emp, r.doc.type))}>Action</button>}
                  {ok && <button className="btn btn-sm btn-primary" onClick={() => setUpload({ emp: r.emp, type: r.doc.type, mode: 'renew' })}>Renew</button>}
                </td>
              </tr>
            );
          })}
          {list.length === 0 && <tr><td colSpan={6} className="empty-cell">Nothing expires in this window.</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Employee Document Centre</span>
          <h1>HR Documents &amp; Expiry</h1>
          <p className="muted">{visTypes.join(', ')}{canSeeDoc(u, 'Qualification Certificate') ? ' and other documents' : ''}, with scanned copies, renewal actions and history.</p>
        </div>
      </div>

      <section className="status-row five">
        <button className="status-card sc-expired" onClick={() => { setTab('expiry'); setWin(0); }}><strong>{count('expired')}</strong><span>Expired</span></button>
        <button className="status-card sc-critical" onClick={() => { setTab('expiry'); setWin(30); }}><strong>{count('critical')}</strong><span>Urgent</span></button>
        <button className="status-card sc-due" onClick={() => { setTab('expiry'); setWin(60); }}><strong>{count('due')}</strong><span>Renewal due</span></button>
        <button className="status-card sc-monitor" onClick={() => { setTab('expiry'); setWin(90); }}><strong>{count('monitor')}</strong><span>Monitor</span></button>
        <button className="status-card sc-missing" onClick={() => setTab('missing')}><strong>{missing.length}</strong><span>Missing / no scan</span></button>
      </section>

      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'expiry', label: 'Expiry Centre' },
        { key: 'alerts', label: 'Assigned to me', count: mine.length },
        { key: 'library', label: 'Document library' },
        { key: 'missing', label: 'Missing documents', count: missing.length },
      ]} />

      {tab === 'expiry' && (
        <section className="panel flush">
          <div className="panel-tools">
            <div className="seg" role="group" aria-label="Expiry window">{[[0, 'Expired'], [30, '30 days'], [60, '60 days'], [90, '90 days'], [180, '6 months']].map(([d, l]) => <button key={d} className={win === d ? 'on' : ''} onClick={() => setWin(d)}>{l}</button>)}</div>
            <div className="chips">{visTypes.map((t) => <button key={t} className={'chip' + (types.includes(t) ? ' on' : '')} aria-pressed={types.includes(t)} onClick={() => setTypes(types.includes(t) ? types.filter((x) => x !== t) : [...types, t])}>{t}</button>)}</div>
            <select id="hd-off" value={f.officer} onChange={set('officer')} aria-label="Responsible officer"><option value="">All officers</option>{officers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
            <select id="hd-act" value={f.action} onChange={set('action')} aria-label="Action status"><option value="">Any action status</option>{['Open', 'In Progress', 'Submitted to authority', 'Awaiting payment', 'On hold'].map((s) => <option key={s}>{s}</option>)}</select>
            {!u.scope && <select id="hd-dept" value={f.dept} onChange={set('dept')} aria-label="Department"><option value="">All departments</option>{state.config.departments.map((d) => <option key={d.id}>{d.name}</option>)}</select>}
            <select id="hd-loc" value={f.loc} onChange={set('loc')} aria-label="Branch / location"><option value="">All locations</option>{state.config.locations.map((d) => <option key={d.id}>{d.name}</option>)}</select>
            <select id="hd-co" value={f.company} onChange={set('company')} aria-label="Visa sponsor"><option value="">Any sponsor company</option>{state.config.companies.map((c) => <option key={c.id} value={c.name}>{c.short}</option>)}</select>
          </div>
          <ExpiryTable list={rows} />
          <div className="pager"><span className="muted small">{rows.length} documents {win === 0 ? 'already expired' : `expired or expiring within ${win} days`}</span></div>
        </section>
      )}

      {tab === 'alerts' && (
        <div className="stack">
          <div className="officer-cards">
            {officers.map((o) => (
              <div key={o.id} className={'officer' + (o.id === u.id ? ' on' : '')}>
                <Avatar name={o.name} size={40} /><div><strong>{o.name}</strong><small>{docTypes('hr').filter((t) => t.officer === o.id).map((t) => t.key).join(', ')}</small></div>
                <span className="officer-n">{hrExpiryRows(emps, 60).filter((r) => canSeeDoc(u, r.doc.type) && officerFor(r.doc.type).id === o.id).length}</span>
              </div>
            ))}
          </div>
          <section className="panel flush">
            <div className="panel-head pad"><h2>{mine.length ? 'Assigned to you · next 60 days' : 'Nothing is assigned to you'}</h2><span className="muted small">Alert timing and routing are set in Administration.</span></div>
            {mine.length > 0 && <ExpiryTable list={mine} />}
          </section>
        </div>
      )}

      {tab === 'library' && (
        <section className="panel flush">
          <div className="panel-tools">
            <div className="search-box grow"><Icon n="search" /><input id="lib-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Employee name, EMP no. or document number" aria-label="Search documents" /></div>
            {docTypes('hr').some((t) => can(u, 'uploadDoc', { type: t.key })) && <span className="muted small">Upload from the employee's profile.</span>}
          </div>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Employee</th><th>Document</th><th>File</th><th>Expiry</th><th>Status</th><th className="right">Open</th></tr></thead>
            <tbody>{lib.slice(0, 60).map((r, i) => (
              <tr key={i}>
                <td><a className="who" href={href('hr-employee', empParam(r.emp.id))}><strong>{r.emp.name}</strong><small className="mono">{r.emp.id}</small></a></td>
                <td>{r.doc.type}{r.doc.history?.length > 0 && <small className="block muted">+{r.doc.history.length} previous</small>}</td>
                <td className="small mono">{r.doc.file.name}<br /><span className="muted">{r.doc.file.size}</span></td>
                <td className="mono nowrap">{fmt(r.doc.expiry)}</td>
                <td><StatusPill doc={r.doc} /></td>
                <td className="right"><button className="btn btn-sm" onClick={() => setViewing(r)}><Icon n="eye" size={14} /> View</button></td>
              </tr>
            ))}</tbody>
          </table></div>
          <div className="pager"><span className="muted small">{lib.length} scanned documents{lib.length > 60 ? ' · showing first 60, refine the search' : ''}</span></div>
        </section>
      )}

      {tab === 'missing' && (
        <section className="panel flush">
          {missing.length === 0 ? <Empty title="Every required document is recorded with a scan" /> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Employee</th><th>Department</th><th>Document</th><th>Problem</th><th className="right">Action</th></tr></thead>
              <tbody>{missing.map((m, i) => (
                <tr key={i}>
                  <td><a className="who" href={href('hr-employee', empParam(m.emp.id))}><strong>{m.emp.name}</strong><small className="mono">{m.emp.id}</small></a></td>
                  <td>{m.emp.department.replace(' Department', '')}</td>
                  <td>{m.type}</td>
                  <td><span className="pill pill-missing">{m.recorded ? 'Recorded, no scanned copy' : 'Required, not recorded'}</span></td>
                  <td className="right">{can(u, 'uploadDoc', { type: m.type }) && <button className="btn btn-sm btn-primary" onClick={() => setUpload({ emp: m.emp, type: m.type, mode: 'upload' })}><Icon n="upload" size={14} /> {m.recorded ? 'Upload scan' : 'Record'}</button>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </section>
      )}

      {viewing && <DocViewer owner={viewing.emp} module="hr" doc={viewing.doc} onClose={() => setViewing(null)} />}
      {tracking && <RenewalActionModal module="hr" owner={tracking.emp} doc={tracking.doc} onClose={() => setTracking(null)} />}
      {upload && <UploadDocModal module="hr" owner={state.employees.find((e) => e.id === upload.emp.id)} docType={upload.type} mode={upload.mode} onClose={() => setUpload(null)} />}
    </div>
  );
}
