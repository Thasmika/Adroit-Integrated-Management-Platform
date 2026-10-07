import React, { useState } from 'react';
import { useStore, go, href, setPending } from '../core/store.jsx';
import { fmt, TODAY, daysUntil, iso, addDays, docTypes, ROLES } from '../core/shared.js';
import { scopeEmployees, canSeeDoc, can } from '../core/access.js';
import { Icon, StatusPill, Avatar, LeavePill, ActionPill } from '../core/ui.jsx';
import { hrExpiryRows, hrMissing, DEPARTMENTS, empParam } from './data.js';

export default function HrDashboard() {
  const { state } = useStore();
  const u = state.user;
  const [ask, setAsk] = useState('');
  const [hz, setHz] = useState(60);
  const emps = scopeEmployees(u, state.employees);
  const ids = new Set(emps.map((e) => e.id));
  const noDocs = ROLES[u.role].noDocs;
  const rows = hrExpiryRows(emps, hz).filter((r) => canSeeDoc(u, r.doc.type));
  const soonEmp = new Set(rows.map((r) => r.emp.id));
  const leaves = state.leaves.filter((l) => ids.has(l.empId));
  const onLeave = leaves.filter((l) => l.status === 'On Leave');
  const awaiting = leaves.filter((l) => l.status === 'Awaiting Rejoining');
  const pending = leaves.filter((l) => l.status.startsWith('Pending'));
  const missing = [];
  emps.forEach((e) => hrMissing(e).forEach((m) => { if (canSeeDoc(u, m.type)) missing.push(m); }));
  const openActs = rows.filter((r) => ['expired', 'critical'].includes(r.st.key) && !r.doc.renewal);
  const types = docTypes('hr').filter((t) => t.expires && canSeeDoc(u, t.key));
  const byType = types.map((t) => ({ t: t.key, n: rows.filter((r) => r.doc.type === t.key).length }));
  const maxType = Math.max(1, ...byType.map((x) => x.n));
  const byDept = DEPARTMENTS.filter((d) => emps.some((e) => e.department === d)).map((d) => ({ d, n: emps.filter((e) => e.department === d).length, away: onLeave.filter((l) => emps.find((e) => e.id === l.empId)?.department === d).length }));
  const maxDept = Math.max(1, ...byDept.map((x) => x.n));
  const find = (id) => emps.find((e) => e.id === id);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Employee Management{u.scope ? ` · ${u.scope}` : ''}</span>
          <h1>HR Dashboard</h1>
          <p className="muted">What needs attention today{u.scope ? ' in your department' : ''}.</p>
        </div>
        <div className="head-actions">
          {can(u, 'submitLeave') && <button className="btn" onClick={() => go('hr-leave', 'apply')}><Icon n="leave" size={16} /> Apply leave</button>}
          {can(u, 'editEmployee') && <button className="btn btn-primary" onClick={() => go('hr-new')}><Icon n="plus" size={16} /> Add employee</button>}
        </div>
      </div>

      <section className="kpis">
        <a className="kpi" href="#hr-employees"><span className="kpi-label">Active employees</span><span className="kpi-num">{emps.filter((e) => e.status === 'Active').length}</span><span className="kpi-sub">{emps.length} records</span></a>
        {!noDocs && (
          <div className="kpi kpi-warn">
            <span className="kpi-label">Expiring ≤ {hz} days</span>
            <a className="kpi-num" href="#hr-documents.expiry">{soonEmp.size}</a>
            <span className="mini-seg" role="group" aria-label="Horizon">{[30, 60, 90].map((d) => <button key={d} className={hz === d ? 'on' : ''} onClick={() => setHz(d)}>{d}d</button>)}</span>
          </div>
        )}
        <a className="kpi kpi-info" href="#hr-leave.away"><span className="kpi-label">On leave</span><span className="kpi-num">{onLeave.length}</span><span className="kpi-sub">currently away · {awaiting.length} due to rejoin</span></a>
        <a className="kpi kpi-crit" href="#hr-leave.queue"><span className="kpi-label">Pending HR actions</span><span className="kpi-num">{pending.length + awaiting.length + (noDocs ? 0 : openActs.length)}</span><span className="kpi-sub">{pending.length} leave · {awaiting.length} rejoin{noDocs ? '' : ` · ${openActs.length} renewals not started`}</span></a>
      </section>

      <form className="ask" onSubmit={(e) => { e.preventDefault(); setPending('ask', ask); go('assistant'); }}>
        <Icon n="ai" />
        <input id="hr-ask" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder={noDocs ? 'Ask HR AI: "Who is currently on annual leave?"' : 'Ask HR AI: "Show employees whose visas or Emirates IDs expire within the next 60 days"'} aria-label="Ask the AI assistant" />
        <button className="btn btn-primary" type="submit">Ask</button>
      </form>

      <div className="grid-2">
        {!noDocs ? (
          <section className="panel">
            <div className="panel-head"><h2>Upcoming expiries by document type</h2><a href="#hr-documents.expiry" className="link">Open Expiry Centre <Icon n="arrow" size={14} /></a></div>
            <div className="bars">
              {byType.map(({ t, n }) => (
                <div className="bar-row" key={t}><span className="bar-label">{t}</span><span className="bar-track"><span className="bar-fill" style={{ width: `${(n / maxType) * 100}%` }} /></span><span className="bar-val">{n}</span></div>
              ))}
            </div>
            <div className="table-wrap">
              <table className="table compact">
                <thead><tr><th>Employee</th><th>Document</th><th>Expiry</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {rows.slice(0, 8).map((r, i) => (
                    <tr key={i} className="clickable" onClick={() => go('hr-employee', empParam(r.emp.id))}>
                      <td><div className="who"><strong>{r.emp.name}</strong><small className="mono">{r.emp.id}</small></div></td>
                      <td>{r.doc.type}</td>
                      <td className="mono nowrap">{fmt(r.doc.expiry)}</td>
                      <td><StatusPill doc={r.doc} /></td>
                      <td><ActionPill status={r.doc.renewal ? r.doc.renewal.status : ['expired', 'critical', 'due'].includes(r.st.key) ? 'Open' : '—'} /></td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={5} className="empty-cell">No documents expire in the next {hz} days.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="panel">
            <div className="panel-head"><h2>Your department</h2></div>
            <p className="muted">As Department Head you submit leave and confirm rejoining for {u.scope}. Document expiries are handled by HR and PRO.</p>
            <div className="bars">{byDept.map(({ d, n, away }) => <div className="bar-row" key={d}><span className="bar-label">{d.replace(' Department', '')}</span><span className="bar-track"><span className="bar-fill bar-neutral" style={{ width: '100%' }}>{away > 0 && <span className="bar-away" style={{ width: `${(away / n) * 100}%` }} />}</span></span><span className="bar-val">{n}</span></div>)}</div>
          </section>
        )}
        <div className="stack">
          <section className="panel">
            <div className="panel-head"><h2>Quick actions</h2></div>
            <div className="quick">
              {can(u, 'editEmployee') && <button onClick={() => go('hr-new')}><Icon n="plus" /> Add new employee</button>}
              <button onClick={() => go('hr-leave', 'queue')}><Icon n="leave" /> {can(u, 'submitLeave') ? 'Apply / review leave' : 'Review leave'}</button>
              {!noDocs && <button onClick={() => go('hr-documents', 'expiry')}><Icon n="bell" /> Open Expiry Centre</button>}
              <button onClick={() => go('search')}><Icon n="search" /> Search employee / document</button>
              <button onClick={() => go('assistant')}><Icon n="ai" /> Ask HR AI Assistant</button>
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Needs follow-up</h2></div>
            <ul className="follow">
              {pending.map((l) => <li key={l.id}><a href="#hr-leave.queue"><span><strong>{find(l.empId)?.name}</strong> · {l.type}, {l.days}d</span><LeavePill status={l.status} /></a></li>)}
              {awaiting.map((l) => <li key={l.id}><a href="#hr-leave.away"><span><strong>{find(l.empId)?.name}</strong> · leave ended {fmt(l.end)}</span><LeavePill status={l.status} /></a></li>)}
              {!noDocs && <li><a href="#hr-documents.missing"><span><strong>{missing.length}</strong> required documents missing a scan or record</span><span className="pill pill-missing">Missing</span></a></li>}
              {pending.length + awaiting.length === 0 && noDocs && <li className="muted small">No leave actions waiting.</li>}
            </ul>
          </section>
        </div>
      </div>

      <div className="grid-2">
        {byDept.length > 1 && (
          <section className="panel">
            <div className="panel-head"><h2>Headcount by department</h2><span className="muted small">shaded = on leave today</span></div>
            <div className="bars">
              {byDept.map(({ d, n, away }) => (
                <div className="bar-row" key={d}><span className="bar-label">{d.replace(' Department', '')}</span>
                  <span className="bar-track"><span className="bar-fill bar-neutral" style={{ width: `${(n / maxDept) * 100}%` }}>{away > 0 && <span className="bar-away" style={{ width: `${(away / n) * 100}%` }} />}</span></span>
                  <span className="bar-val">{n}</span></div>
              ))}
            </div>
          </section>
        )}
        <section className="panel">
          <div className="panel-head"><h2>Currently on leave</h2><a href="#hr-leave.away" className="link">All <Icon n="arrow" size={14} /></a></div>
          <ul className="people-list">
            {onLeave.slice(0, 7).map((l) => {
              const e = find(l.empId);
              const back = iso(addDays(new Date(l.end + 'T00:00:00'), 1));
              return (
                <li key={l.id}><a href={href('hr-employee', empParam(e.id))}>
                  <Avatar name={e.name} size={32} photo={e.photo} />
                  <span className="who"><strong>{e.name}</strong><small>{e.department.replace(' Department', '')} · {l.type}</small></span>
                  <span className="right small"><span className="muted">returns</span> {fmt(back)}<br /><span className="muted">in {daysUntil(back)} days</span></span>
                </a></li>
              );
            })}
            {onLeave.length === 0 && <li className="muted small">Nobody is on leave today.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
