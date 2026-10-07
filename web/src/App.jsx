import React, { useState } from 'react';
import { StoreProvider, useStore, useRoute, go, href, setPending } from './core/store.jsx';
import { Icon, Avatar, Empty } from './core/ui.jsx';
import { ROLES } from './core/shared.js';
import { canModule, canAdmin, canAudit, scopeEmployees, scopeAssets, canSeeDoc } from './core/access.js';
import { hrExpiryRows } from './hr/data.js';
import { fleetExpiryRows } from './fleet/data.js';
import Login, { ChangePassword } from './shared/Login.jsx';
import Notifications from './shared/Notifications.jsx';
import Import from './shared/Import.jsx';
import Home from './shared/Home.jsx';
import Attention from './shared/Attention.jsx';
import Search from './shared/Search.jsx';
import Assistant from './shared/Assistant.jsx';
import Admin from './shared/Admin.jsx';
import Audit from './shared/Audit.jsx';
import HrDashboard from './hr/Dashboard.jsx';
import Employees from './hr/Employees.jsx';
import EmployeeProfile from './hr/EmployeeProfile.jsx';
import EmployeeForm from './hr/EmployeeForm.jsx';
import HrDocuments from './hr/Documents.jsx';
import Leave from './hr/Leave.jsx';
import HrReports from './hr/Reports.jsx';
import FleetDashboard from './fleet/Dashboard.jsx';
import Fleet from './fleet/Fleet.jsx';
import VehicleProfile from './fleet/VehicleProfile.jsx';
import VehicleForm from './fleet/VehicleForm.jsx';
import FleetDocuments from './fleet/Documents.jsx';
import FleetReports from './fleet/Reports.jsx';

function Shell() {
  const { state, act, unread } = useStore();
  const route = useRoute();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const u = state.user;
  if (state.phase === 'loading') return <div className="splash">Loading…</div>;
  if (state.phase === 'password') return <ChangePassword forced />;
  if (state.phase !== 'ready' || !u) return <Login />;

  const hr = canModule(u, 'hr');
  const fl = canModule(u, 'fleet');
  const emps = scopeEmployees(u, state.employees);
  const hrUrgent = hr ? hrExpiryRows(emps, 30).filter((r) => canSeeDoc(u, r.doc.type)).length : 0;
  const flUrgent = fl ? fleetExpiryRows(scopeAssets(u, state.assets), 30).filter((r) => canSeeDoc(u, r.doc.type)).length : 0;
  const pendingLeave = hr ? state.leaves.filter((l) => emps.some((e) => e.id === l.empId) && (u.role === 'management' ? l.status === 'Pending Approval' : l.status.startsWith('Pending'))).length : 0;

  const P = route.page;
  const group = P.startsWith('hr-') ? 'hr' : P.startsWith('fleet-') ? 'fleet' : P;
  const hrBlocked = u.role !== 'sysadmin' && ((P === 'hr-documents' && ROLES[u.role].noDocs) || (P === 'hr-reports' && !['hr', 'management', 'auditor'].includes(u.role)) || (['hr-new', 'hr-edit', 'hr-import'].includes(P) && u.role !== 'hr'));
  const flBlocked = u.role !== 'sysadmin' && ((P === 'fleet-reports' && !['fleet', 'management', 'auditor'].includes(u.role)) || (['fleet-new', 'fleet-edit', 'fleet-import'].includes(P) && u.role !== 'fleet'));
  const allowed = (P.startsWith('hr-') && hr && !hrBlocked) || (P.startsWith('fleet-') && fl && !flBlocked) ||  ['home', 'attention', 'search', 'assistant', 'notifications', 'account'].includes(P) || (P === 'admin' && canAdmin(u)) || (P === 'audit' && canAudit(u));
  const NAV = [
    { title: null, items: [
      { key: 'home', label: 'Management Home', icon: 'home' },
      (hr || fl) && { key: 'attention', label: 'Attention Centre', icon: 'shield', badge: hrUrgent + flUrgent },
      (hr || fl) && { key: 'search', label: 'Search', icon: 'search' },
      (hr || fl) && { key: 'assistant', label: 'AI Assistant', icon: 'ai' },
      { key: 'notifications', label: 'Notifications', icon: 'bell', badge: unread },
    ] },
    hr && { title: 'Employee Management', items: [
      { key: 'hr-dashboard', label: 'HR Dashboard', icon: 'dashboard' },
      { key: 'hr-employees', label: 'Employees', icon: 'people', match: ['hr-employee', 'hr-new', 'hr-edit', 'hr-import'] },
      !ROLES[u.role].noDocs && { key: 'hr-documents', label: 'Documents & Expiry', icon: 'docs', badge: hrUrgent },
      { key: 'hr-leave', label: 'Leave & Rejoining', icon: 'leave', badge: pendingLeave },
      ['hr', 'management', 'auditor'].includes(u.role) && { key: 'hr-reports', label: 'HR Reports', icon: 'reports' },
    ] },
    fl && { title: 'Vehicle & Equipment', items: [
      { key: 'fleet-dashboard', label: 'Fleet Dashboard', icon: 'dashboard' },
      { key: 'fleet-master', label: 'Fleet Master', icon: 'truck', match: ['fleet-vehicle', 'fleet-new', 'fleet-edit', 'fleet-import'] },
      { key: 'fleet-documents', label: 'Documents & Expiry', icon: 'docs', badge: flUrgent },
      ['fleet', 'management', 'auditor'].includes(u.role) && { key: 'fleet-reports', label: 'Fleet Reports', icon: 'reports' },
    ] },
    (canAdmin(u) || canAudit(u)) && { title: 'Platform', items: [
      canAdmin(u) && { key: 'admin', label: 'Administration', icon: 'settings' },
      canAudit(u) && { key: 'audit', label: 'Audit log', icon: 'audit' },
    ] },
  ].filter(Boolean);

  let page;
  if (!allowed) page = <div className="page"><Empty title="You don't have access to this page">Your role ({ROLES[u.role].label}) doesn't include it. Ask the System Administrator if you need access. <a href="#home">Back to Management Home</a></Empty></div>;
  else switch (P) {
    case 'attention': page = <Attention />; break;
    case 'notifications': page = <Notifications />; break;
    case 'account': page = <ChangePassword />; break;
    case 'hr-import': page = <Import kind="employees" />; break;
    case 'fleet-import': page = <Import kind="assets" />; break;
    case 'search': page = <Search />; break;
    case 'assistant': page = <Assistant />; break;
    case 'admin': page = <Admin initialTab={route.param} />; break;
    case 'audit': page = <Audit />; break;
    case 'hr-dashboard': page = <HrDashboard />; break;
    case 'hr-employees': page = <Employees />; break;
    case 'hr-employee': page = <EmployeeProfile param={route.param} />; break;
    case 'hr-new': page = <EmployeeForm />; break;
    case 'hr-edit': page = <EmployeeForm param={route.param} />; break;
    case 'hr-documents': page = <HrDocuments initialTab={route.param} />; break;
    case 'hr-leave': page = <Leave initialTab={route.param} />; break;
    case 'hr-reports': page = <HrReports />; break;
    case 'fleet-dashboard': page = <FleetDashboard />; break;
    case 'fleet-master': page = <Fleet initialCat={route.param} />; break;
    case 'fleet-vehicle': page = <VehicleProfile param={route.param} />; break;
    case 'fleet-new': page = <VehicleForm />; break;
    case 'fleet-edit': page = <VehicleForm param={route.param} />; break;
    case 'fleet-documents': page = <FleetDocuments initialTab={route.param} />; break;
    case 'fleet-reports': page = <FleetReports />; break;
    default: page = <Home />;
  }

  return (
    <div className={'shell' + (open ? ' nav-open' : '')}>
      <aside className="side">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">A</span>
          <span className="brand-text"><strong>ADROIT</strong><small>Integrated Management Platform</small></span>
        </div>
        <nav className="nav" aria-label="Main">
          {NAV.map((g, gi) => (
            <div className="nav-group" key={gi}>
              {g.title && <span className="nav-title">{g.title}</span>}
              {g.items.filter(Boolean).map((n) => {
                const on = P === n.key || (n.match || []).includes(P);
                return (
                  <a key={n.key} href={'#' + n.key} className={'nav-item' + (on ? ' on' : '')} onClick={() => setOpen(false)}>
                    <Icon n={n.icon} /><span>{n.label}</span>{n.badge > 0 && <span className="nav-badge">{n.badge}</span>}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <span className="phase">Phase 1 · v1.0</span>
          <small>Employee, Vehicle &amp; Equipment Management. Payroll, WPS, maintenance, fuel and costs are outside Phase 1.</small>
        </div>
      </aside>
      <div className="scrim" onClick={() => setOpen(false)} />
      <div className="main">
        <header className="top">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Icon n="menu" /></button>
          {(hr || fl) ? (
            <form className="top-search" role="search" onSubmit={(e) => { e.preventDefault(); if (!q.trim()) return; setPending('search', q.trim()); go('search'); setQ(''); }}>
              <Icon n="search" />
              <input id="global-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={hr && fl ? 'Search employees, vehicles, documents…' : hr ? 'Search employees and documents…' : 'Search vehicles and documents…'} aria-label="Search" />
            </form>
          ) : <span className="top-search ghost" />}
          <a className="icon-btn bell" href="#notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}><Icon n="bell" />{unread > 0 && <span className="dot" />}</a>
          <div className="me">
            <Avatar name={u.name} size={32} />
            <span className="me-text"><strong>{u.name}</strong><small>{ROLES[u.role].label}{u.scope ? ` · ${u.scope.replace(' Department', '')}` : ''}</small></span>
            <a className="icon-btn" href="#account" aria-label="Change password" title="Change password"><Icon n="lock" /></a>
            <button className="icon-btn" onClick={act.logout} aria-label="Sign out" title="Sign out"><Icon n="logout" /></button>
          </div>
        </header>
        <main className="content" data-module={group}>{page}</main>
      </div>
    </div>
  );
}

export default function App() {
  return <StoreProvider><Shell /></StoreProvider>;
}
