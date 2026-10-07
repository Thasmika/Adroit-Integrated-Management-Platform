import React, { useState } from 'react';
import { useStore, go, href, setPending } from '../core/store.jsx';
import { TODAY, fmt, ROLES } from '../core/shared.js';
import { canModule, canAdmin, canAudit, scopeEmployees, scopeAssets } from '../core/access.js';
import { buildAttention, leaveActions, isAttention } from '../core/attention.js';
import { Icon, StatusPill, ActionPill, VehicleArt } from '../core/ui.jsx';

export default function Home() {
  const { state } = useStore();
  const u = state.user;
  const hr = canModule(u, 'hr');
  const fl = canModule(u, 'fleet');
  const [mod, setMod] = useState('all');
  const [q, setQ] = useState('');
  const [ask, setAsk] = useState('');
  const first = u.name.split(' ')[0];
  const greeting = <><span className="eyebrow">{TODAY.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span><h1>Good morning, {first}</h1></>;

  if (!hr && !fl) {
    const cfg = state.config;
    return (
      <div className="page">
        <div className="page-head"><div>{greeting}<p className="muted">You manage users, reference data and configuration. Employee and fleet records are not visible to this role.</p></div></div>
        <section className="kpis">
          <a className="kpi" href={href('admin', 'users')}><span className="kpi-label">Users</span><span className="kpi-num">{cfg.users.filter((x) => x.active).length}</span><span className="kpi-sub">active accounts · {Object.keys(ROLES).length} roles</span></a>
          <a className="kpi" href={href('admin', 'doctypes')}><span className="kpi-label">Document types</span><span className="kpi-num">{cfg.docTypes.length}</span><span className="kpi-sub">with expiry thresholds</span></a>
          <a className="kpi" href={href('admin', 'masters')}><span className="kpi-label">Companies · departments</span><span className="kpi-num">{cfg.companies.length} · {cfg.departments.length}</span><span className="kpi-sub">{cfg.locations.length} branches / locations</span></a>
          <a className="kpi kpi-info" href="#audit"><span className="kpi-label">Audit log</span><span className="kpi-num">→</span><span className="kpi-sub">every change and view is recorded</span></a>
        </section>
        <section className="panel"><div className="panel-head"><h2>Configuration checklist before rollout</h2></div>
          <ul className="checklist">
            <li className="ok">Roles and users created</li>
            <li className="ok">Document types and warning thresholds set</li>
            <li className={cfg.docTypes.every((t) => t.officer) ? 'ok' : ''}>Responsible officer assigned for every document type</li>
            <li className={cfg.system.email ? 'ok' : ''}>E-mail alerts switched on</li>
            <li className={cfg.system.alertsEnabled ? 'ok' : ''}>Expiry alerts switched on (after attention lists are verified)</li>
            <li>Retention policy: {cfg.system.retention}</li>
          </ul>
          <a className="link" href="#admin.health">Open System health <Icon n="arrow" size={14} /></a>
        </section>
      </div>
    );
  }

  const emps = scopeEmployees(u, state.employees);
  const assets = scopeAssets(u, state.assets);
  const items = buildAttention(state, u, 60).filter(isAttention);
  const leaves = leaveActions(state, u);
  const onLeave = hr ? state.leaves.filter((l) => l.status === 'On Leave' && emps.some((e) => e.id === l.empId)) : [];
  const exp = items.filter((i) => i.kind === 'doc' && (mod === 'all' || i.module === mod));
  const missing = items.filter((i) => i.kind === 'missing');
  const openDocActions = items.filter((i) => i.kind === 'doc' && ['expired', 'critical'].includes(i.st.key) && i.action === 'Open');
  const mine = items.filter((i) => i.officer.id === u.id).sort((a, b) => (a.kind === 'missing') - (b.kind === 'missing') || (a.d ?? 0) - (b.d ?? 0));
  const top = (mine.length ? mine : items.filter((i) => i.kind === 'doc').sort((a, b) => a.d - b.d)).slice(0, 7);

  return (
    <div className="page">
      <div className="page-head">
        <div>{greeting}<p className="muted">Adroit Management Home · {hr && fl ? 'employees and fleet' : hr ? 'employee management' : 'vehicle & equipment management'} · what needs attention today.</p></div>
      </div>

      <section className="kpis kpis-6">
        {hr && <a className="kpi" href="#hr-employees"><span className="kpi-label">Employee records</span><span className="kpi-num">{emps.filter((e) => e.status === 'Active').length}</span><span className="kpi-sub">active{u.scope ? ` · ${u.scope.replace(' Department', '')}` : ''}</span></a>}
        {fl && <a className="kpi" href="#fleet-master"><span className="kpi-label">Fleet assets</span><span className="kpi-num">{assets.filter((a) => a.status === 'Active').length}</span><span className="kpi-sub">active vehicles &amp; machines</span></a>}
        {!ROLES[u.role].noDocs && (
          <div className="kpi kpi-warn">
            <span className="kpi-label">Expiring ≤ 60 days</span>
            <a className="kpi-num" href="#attention">{exp.length}</a>
            {hr && fl ? <span className="mini-seg" role="group" aria-label="Module filter">{[['all', 'All'], ['hr', 'HR'], ['fleet', 'Fleet']].map(([k, l]) => <button key={k} className={mod === k ? 'on' : ''} onClick={() => setMod(k)}>{l}</button>)}</span> : <span className="kpi-sub">documents incl. expired</span>}
          </div>
        )}
        <a className="kpi kpi-crit" href="#attention"><span className="kpi-label">Pending actions</span><span className="kpi-num">{leaves.length + openDocActions.length}</span><span className="kpi-sub">{hr ? `${leaves.length} leave · ` : ''}{openDocActions.length} renewals not started</span></a>
        {hr && <a className="kpi kpi-info" href="#hr-leave.away"><span className="kpi-label">Employees on leave</span><span className="kpi-num">{onLeave.length}</span><span className="kpi-sub">currently away</span></a>}
        {!ROLES[u.role].noDocs && <a className="kpi kpi-miss" href={href('attention', 'missing')}><span className="kpi-label">Missing documents</span><span className="kpi-num">{missing.length}</span><span className="kpi-sub">{hr && fl ? `${missing.filter((m) => m.module === 'hr').length} HR · ${missing.filter((m) => m.module === 'fleet').length} fleet` : 'to complete'}</span></a>}
      </section>

      <div className="grid-2 home-grid">
        <form className="ask" onSubmit={(e) => { e.preventDefault(); if (!q.trim()) return; setPending('search', q.trim()); go('search'); }}>
          <Icon n="search" />
          <input id="home-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={hr && fl ? 'Quick search: employee ID or name, fleet no., plate, document no.' : hr ? 'Quick search: employee ID, name, document no.' : 'Quick search: fleet no., plate, chassis, policy no.'} aria-label="Quick search" />
          <button className="btn btn-primary" type="submit">Search</button>
        </form>
        <form className="ask" onSubmit={(e) => { e.preventDefault(); setPending('ask', ask); go('assistant'); }}>
          <Icon n="ai" />
          <input id="home-ask" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder={hr && fl ? 'Ask AI: "Summarize HR and fleet document actions this week"' : hr ? 'Ask AI: "Who is currently on annual leave?"' : 'Ask AI: "List heavy machines with missing documents"'} aria-label="Ask the AI assistant" />
          <button className="btn btn-primary" type="submit">Ask</button>
        </form>
      </div>

      <div className="module-cards">
        {hr && (
          <a className="module-card" href="#hr-dashboard">
            <span className="mc-icon"><Icon n="people" size={28} /></span>
            <span className="mc-body"><strong>Employee Management</strong><small>Employees · HR documents · expiries · leave</small></span>
            <span className="mc-stats">
              {!ROLES[u.role].noDocs && <span><b>{items.filter((i) => i.module === 'hr' && i.kind === 'doc').length}</b> expiring</span>}
              <span><b>{leaves.length}</b> leave actions</span>
            </span>
            <Icon n="arrow" />
          </a>
        )}
        {fl && (
          <a className="module-card" href="#fleet-dashboard">
            <span className="mc-icon"><VehicleArt category="Heavy Vehicle" size={40} /></span>
            <span className="mc-body"><strong>Vehicle &amp; Equipment Management</strong><small>Vehicles · machines · compliance documents · expiries</small></span>
            <span className="mc-stats"><span><b>{items.filter((i) => i.module === 'fleet' && i.kind === 'doc').length}</b> expiring</span><span><b>{missing.filter((m) => m.module === 'fleet').length}</b> missing</span></span>
            <Icon n="arrow" />
          </a>
        )}
      </div>

      {!ROLES[u.role].noDocs ? (
        <section className="panel flush">
          <div className="panel-head pad"><h2>{mine.length ? `Assigned to you (${mine.length})` : 'Most urgent documents'}</h2><a className="link" href={href('attention', mine.length ? 'mine' : undefined)}>Open Attention Centre <Icon n="arrow" size={14} /></a></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Module</th><th>Record</th><th>Document</th><th>Expiry</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {top.map((i, k) => (
                  <tr key={k} className="clickable" onClick={() => { location.hash = i.link.slice(1); }}>
                    <td><span className={'mod-tag mt-' + i.module}>{i.module === 'hr' ? 'HR' : 'Fleet'}</span></td>
                    <td><div className="who"><strong>{i.module === 'hr' ? i.ownerName : i.ownerId}</strong><small className="mono">{i.module === 'hr' ? i.ownerId : i.ownerName}</small></div></td>
                    <td>{i.doc?.name || i.type}</td>
                    <td className="mono nowrap">{fmt(i.doc?.expiry)}</td>
                    <td>{i.doc ? <StatusPill doc={i.doc} /> : <span className="pill pill-missing">{i.st.label}</span>}</td>
                    <td><ActionPill status={i.action} /></td>
                  </tr>
                ))}
                {top.length === 0 && <tr><td colSpan={6} className="empty-cell">Nothing needs attention right now.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="panel">
          <div className="panel-head"><h2>Leave actions in your department</h2><a className="link" href="#hr-leave">Open Leave <Icon n="arrow" size={14} /></a></div>
          <p className="muted">{leaves.length} leave request{leaves.length !== 1 ? 's' : ''} in progress or waiting for rejoining. Document details are handled by HR.</p>
        </section>
      )}
      {canAudit(u) && !canAdmin(u) && <p className="muted small"><Icon n="audit" size={14} /> You can review the <a href="#audit">audit log</a>.</p>}
    </div>
  );
}
