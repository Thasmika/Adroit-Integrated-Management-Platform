import React, { useEffect, useState } from 'react';
import { useStore } from '../core/store.jsx';
import { ROLES, FLEET_CATEGORIES, STATUS_LABEL, ACTION_STATES } from '../core/shared.js';
import { Tabs, Icon, Avatar, Field } from '../core/ui.jsx';
import { HR_STATUSES } from '../hr/data.js';
import { STATUSES as ASSET_STATUSES } from '../fleet/data.js';

const TABS = [['health', 'System health'], ['doctypes', 'Document types & thresholds'], ['officers', 'Responsible officers'], ['users', 'Users & roles'], ['masters', 'Companies, departments & locations'], ['statuses', 'Status lists'], ['templates', 'Notification templates'], ['system', 'System configuration']];
const PERMS = [
  ['Employee records', { sysadmin: '—', management: 'View', hr: 'Create · edit', pro: 'View', insurance: 'View', depthead: 'Own dept, limited', fleet: '—', auditor: 'View' }],
  ['Employee documents', { sysadmin: '—', management: 'View', hr: 'All · upload', pro: 'Visa / EID / passport', insurance: 'Health insurance', depthead: '—', fleet: '—', auditor: 'View' }],
  ['Leave', { sysadmin: '—', management: 'Approve / reject', hr: 'Submit · review · rejoin', pro: 'View', insurance: 'View', depthead: 'Submit · rejoin (own dept)', fleet: '—', auditor: 'View' }],
  ['Fleet records', { sysadmin: '—', management: 'View', hr: '—', pro: '—', insurance: 'View', depthead: '—', fleet: 'Create · edit', auditor: 'View' }],
  ['Fleet documents', { sysadmin: '—', management: 'View', hr: '—', pro: '—', insurance: 'Motor insurance', depthead: '—', fleet: 'All · upload', auditor: 'View' }],
  ['Document download / view', { sysadmin: '—', management: 'Yes', hr: 'HR', pro: 'Own types', insurance: 'Own types', depthead: '—', fleet: 'Fleet', auditor: 'Yes' }],
  ['AI assistant', { sysadmin: '—', management: 'Both modules', hr: 'HR', pro: 'HR (own types)', insurance: 'Own types', depthead: 'Own dept', fleet: 'Fleet', auditor: 'Both modules' }],
  ['Administration', { sysadmin: 'Yes', management: '—', hr: '—', pro: '—', insurance: '—', depthead: '—', fleet: '—', auditor: '—' }],
  ['Audit log', { sysadmin: 'Yes', management: 'Yes', hr: '—', pro: '—', insurance: '—', depthead: '—', fleet: '—', auditor: 'Yes' }],
];

export default function Admin({ initialTab }) {
  const { state, act, run, notify } = useStore();
  const cfg = state.config;
  const [tab, setTab] = useState(TABS.some(([k]) => k === initialTab) ? initialTab : 'health');
  useEffect(() => { if (TABS.some(([k]) => k === initialTab)) setTab(initialTab); }, [initialTab]);
  const dt = (key, patch, msg) => run(() => act.docType(key, patch), msg || `${key} updated`);
  const list = (l, item, msg) => {
    if (l === 'templates') return run(() => act.template(item.id, { subject: item.subject, channel: item.channel }), msg);
    const key = l === 'categories' ? item.name : item.id;
    const exists = key && cfg[l].some((x) => (l === 'categories' ? x.name : x.id) === key);
    return run(() => (exists ? act.listUpdate(l, key, { active: item.active }) : act.listAdd(l, { name: item.name, short: item.short, kind: item.kind, active: true })), msg);
  };
  const sys = (patch, msg) => run(() => act.system(patch), msg || 'Configuration saved');
  const officers = cfg.users.filter((x) => x.active && ['hr', 'pro', 'insurance', 'fleet'].includes(x.role));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Shared platform &amp; master data</span>
          <h1>Administration</h1>
          <p className="muted">Reference masters, users and roles, document rules and system settings used by both modules. Every change is written to the audit log.</p>
        </div>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={TABS.map(([key, label]) => ({ key, label }))} />

      {tab === 'health' && <Health />}

      {tab === 'doctypes' && (
        <section className="panel flush">
          <div className="panel-head pad"><h2>Document types</h2><span className="muted small">Thresholds drive the shared expiry engine: Urgent ≤ urgent days, Renewal due ≤ warning days, Monitor ≤ extended days.</span></div>
          <div className="table-wrap"><table className="table dt-table">
            <thead><tr><th>Document type</th><th>Module</th><th>Expires</th><th>Required</th><th>Urgent ≤</th><th>Warning ≤</th><th>Monitor ≤</th></tr></thead>
            <tbody>{cfg.docTypes.map((t) => (
              <tr key={t.key}>
                <td><strong>{t.key}</strong></td>
                <td><span className={'mod-tag mt-' + t.module}>{t.module === 'hr' ? 'HR' : 'Fleet'}</span></td>
                <td><label className="switch"><input type="checkbox" checked={t.expires} onChange={(e) => dt(t.key, { expires: e.target.checked })} /><span>{t.expires ? 'Yes' : 'No'}</span></label></td>
                <td>{t.module === 'hr'
                  ? <label className="switch"><input type="checkbox" checked={!!t.required} onChange={(e) => dt(t.key, { required: e.target.checked })} /><span>{t.required ? 'Required' : 'Optional'}</span></label>
                  : <div className="req-cats">{FLEET_CATEGORIES.map((c) => { const on = (t.requiredFor || []).includes(c); return <button key={c} className={'chip xs' + (on ? ' on' : '')} aria-pressed={on} title={c} onClick={() => dt(t.key, { requiredFor: on ? t.requiredFor.filter((x) => x !== c) : [...(t.requiredFor || []), c] })}>{c.replace(' / Equipment', '').replace(' Company Vehicle', ' co.').replace(' Vehicle', '')}</button>; })}</div>}
                </td>
                {['urgent', 'due', 'monitor'].map((k) => (
                  <td key={k}>{t.expires ? <span className="days-input"><input id={`th-${k}-${t.key.replace(/\W/g, '')}`} type="number" min="0" max="365" defaultValue={t[k]} aria-label={`${t.key} ${k} days`}
                    onBlur={(e) => { const v = +e.target.value; if (v !== t[k]) { const n = { ...t, [k]: v }; if (!(n.urgent <= n.due && (n.monitor === 0 || n.due <= n.monitor))) { notify('Thresholds must increase: urgent ≤ warning ≤ monitor.'); e.target.value = t[k]; return; } dt(t.key, { [k]: v }, `${t.key}: ${k} threshold set to ${v} days`); } }} /> d</span> : <span className="muted">n/a</span>}</td>
                ))}
              </tr>
            ))}</tbody>
          </table></div>
          <p className="muted small pad">Required document types feed the "missing document" checks. Exact thresholds per type are listed in §19 as a management confirmation item; 60 days is the initial warning horizon.</p>
        </section>
      )}

      {tab === 'officers' && (
        <section className="panel flush">
          <div className="panel-head pad"><h2>Responsible officer mapping</h2><span className="muted small">Alerts and attention items are routed to this user.</span></div>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Module</th><th>Document type</th><th>Responsible officer</th><th>Escalation</th></tr></thead>
            <tbody>{cfg.docTypes.map((t) => (
              <tr key={t.key}>
                <td><span className={'mod-tag mt-' + t.module}>{t.module === 'hr' ? 'HR' : 'Fleet'}</span></td>
                <td>{t.key}</td>
                <td><select id={'off-' + t.key.replace(/\W/g, '')} value={t.officer} onChange={(e) => dt(t.key, { officer: e.target.value }, `${t.key} now routed to ${cfg.users.find((x) => x.id === e.target.value).name}`)} aria-label={`Officer for ${t.key}`}>
                  {officers.map((o) => <option key={o.id} value={o.id}>{o.name} · {ROLES[o.role].label}</option>)}
                </select></td>
                <td className="small muted">{cfg.system.escalation ? 'Management copied once expired' : 'Off'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
      )}

      {tab === 'users' && <Users />}

      {tab === 'masters' && (
        <div className="grid-3">
          <MasterList title="Group companies" items={cfg.companies} render={(c) => <><strong>{c.name}</strong><small className="muted">{c.id} · {c.kind}</small></>}
            onToggle={(c) => list('companies', { ...c, active: !c.active }, `${c.short} ${c.active ? 'deactivated' : 'activated'}`)}
            onAdd={(name) => list('companies', { name, short: name.replace(/ L\.?L\.?C\.?$/i, ''), kind: 'Group company' }, `${name} added`)} addLabel="Company legal name" />
          <MasterList title="Departments" items={cfg.departments} render={(d) => <><strong>{d.name}</strong><small className="muted">{d.id} · {state.employees.filter((e) => e.department === d.name).length} employees · {state.assets.filter((a) => a.department === d.name).length} assets</small></>}
            onToggle={(d) => list('departments', { ...d, active: !d.active }, `${d.name} ${d.active ? 'deactivated' : 'activated'}`)}
            onAdd={(name) => list('departments', { name }, `${name} added`)} addLabel="Department name" />
          <MasterList title="Branches / locations" items={cfg.locations} render={(l) => <><strong>{l.name}</strong><small className="muted">{l.id} · {state.employees.filter((e) => e.location === l.name).length} employees · {state.assets.filter((a) => a.location === l.name).length} assets</small></>}
            onToggle={(l) => list('locations', { ...l, active: !l.active }, `${l.name} ${l.active ? 'deactivated' : 'activated'}`)}
            onAdd={(name) => list('locations', { name }, `${name} added`)} addLabel="Location name" />
          <MasterList title="Asset categories" items={cfg.categories.map((c) => ({ ...c, id: c.name }))} render={(c) => <><strong>{c.name}</strong><small className="muted">{state.assets.filter((a) => a.category === c.name).length} assets · required documents set under Document types</small></>}
            onToggle={(c) => list('categories', { name: c.name, active: !c.active }, `${c.name} ${c.active ? 'deactivated' : 'activated'}`)}
            onAdd={(name) => list('categories', { name }, `${name} added`)} addLabel="Category name" />
        </div>
      )}

      {tab === 'statuses' && (
        <div className="grid-2">
          {[
            ['Document expiry status (shared engine)', Object.entries(STATUS_LABEL).map(([k, v]) => ({ k, v }))],
            ['Renewal action status', ['Open', ...ACTION_STATES.slice(1), 'Completed'].map((v) => ({ v }))],
            ['Employee status', HR_STATUSES.map((v) => ({ v }))],
            ['Asset operational / lifecycle status', ASSET_STATUSES.map((v) => ({ v }))],
            ['Leave status', ['Pending HR Review', 'Pending Approval', 'Approved', 'On Leave', 'Awaiting Rejoining', 'Completed', 'Rejected'].map((v) => ({ v }))],
          ].map(([title, items]) => (
            <section className="panel" key={title}>
              <div className="panel-head"><h2>{title}</h2></div>
              <div className="chips">{items.map((x) => <span key={x.v} className={x.k ? `pill pill-${x.k}` : 'tag'}>{x.v}</span>)}</div>
            </section>
          ))}
          <p className="muted small">Final status values are confirmed with users during requirements workshops (§10, §19).</p>
        </div>
      )}

      {tab === 'templates' && (
        <section className="panel flush">
          <div className="panel-head pad"><h2>Notification templates</h2><span className="muted small">Placeholders in braces are filled by the alert engine.</span></div>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Event</th><th>Audience</th><th>Subject / title</th><th>Channel</th></tr></thead>
            <tbody>{cfg.templates.map((t) => (
              <tr key={t.id}>
                <td><strong>{t.event}</strong></td>
                <td className="small">{t.audience}</td>
                <td><input id={'tpl-' + t.id} className="wide-input" defaultValue={t.subject} onBlur={(e) => e.target.value !== t.subject && list('templates', { ...t, subject: e.target.value }, 'Template saved')} aria-label={`Subject for ${t.event}`} /></td>
                <td><select id={'tplc-' + t.id} value={t.channel} onChange={(e) => list('templates', { ...t, channel: e.target.value }, 'Channel updated')} aria-label="Channel"><option>In-app</option><option>Email</option><option>In-app + email</option></select></td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
      )}

      {tab === 'system' && (
        <div className="grid-2">
          <section className="panel">
            <div className="panel-head"><h2>Documents &amp; files</h2></div>
            <Field label="Maximum file size (MB)"><input id="sys-mb" type="number" min="1" max="50" defaultValue={cfg.system.maxFileMB} onBlur={(e) => +e.target.value !== cfg.system.maxFileMB && sys({ maxFileMB: +e.target.value }, `Maximum file size set to ${e.target.value} MB`)} /></Field>
            <div className="field"><span className="field-label">Allowed file types</span><div className="chips">{['PDF', 'JPG', 'PNG', 'TIFF', 'HEIC'].map((ft) => { const on = cfg.system.fileTypes.includes(ft); return <button key={ft} className={'chip' + (on ? ' on' : '')} aria-pressed={on} onClick={() => sys({ fileTypes: on ? cfg.system.fileTypes.filter((x) => x !== ft) : [...cfg.system.fileTypes, ft] })}>{ft}</button>; })}</div></div>
            <Field label="Retention period"><input id="sys-ret" defaultValue={cfg.system.retention} onBlur={(e) => e.target.value !== cfg.system.retention && sys({ retention: e.target.value })} /></Field>
            <p className="muted small">Files are never public: every view or download is authorised by the application and recorded in the audit log. Deletion is a controlled supersede / archive.</p>
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Notifications &amp; AI</h2></div>
            <label className="check"><input id="sys-alerts" type="checkbox" checked={!!cfg.system.alertsEnabled} onChange={(e) => sys({ alertsEnabled: e.target.checked }, e.target.checked ? 'Expiry alerts switched on' : 'Expiry alerts switched off')} /> <strong>Send expiry alerts</strong> <span className="muted small">(switch on once responsible officers are confirmed)</span></label>
            <label className="check"><input id="sys-inapp" type="checkbox" checked={cfg.system.inApp} onChange={(e) => sys({ inApp: e.target.checked })} /> In-app alerts</label>
            <label className="check"><input id="sys-email" type="checkbox" checked={cfg.system.email} onChange={(e) => sys({ email: e.target.checked })} /> Email alerts</label>
            <label className="check"><input id="sys-esc" type="checkbox" checked={cfg.system.escalation} onChange={(e) => sys({ escalation: e.target.checked })} /> Escalate expired documents to Management</label>
            <Field label="Weekly digest day"><select id="sys-digest" value={cfg.system.digestDay} onChange={(e) => sys({ digestDay: e.target.value })}>{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => <option key={d}>{d}</option>)}</select></Field>
            <div className="ai-toggle">
              <label className="check"><input id="sys-ai" type="checkbox" checked={cfg.system.aiEnabled} onChange={(e) => sys({ aiEnabled: e.target.checked }, e.target.checked ? 'AI assistant enabled' : 'AI assistant disabled. Core functions keep working.')} /> <strong>AI assistant enabled</strong></label>
              <small className="muted">Turn off to see the failure mode: search, dashboards, alerts and workflows continue without AI (§12).</small>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function MasterList({ title, items, render, onToggle, onAdd, addLabel }) {
  const [v, setV] = useState('');
  return (
    <section className="panel flush">
      <div className="panel-head pad"><h2>{title}</h2><span className="muted small">{items.filter((x) => x.active).length} active</span></div>
      <ul className="plain-list master">{items.map((x) => (
        <li key={x.id} className={x.active ? '' : 'inactive'}><span className="ml-body">{render(x)}</span><button className="btn btn-sm btn-ghost" onClick={() => onToggle(x)}>{x.active ? 'Deactivate' : 'Activate'}</button></li>
      ))}</ul>
      <form className="add-row" onSubmit={(e) => { e.preventDefault(); if (!v.trim()) return; onAdd(v.trim()); setV(''); }}>
        <input id={'add-' + title.replace(/\W/g, '')} value={v} onChange={(e) => setV(e.target.value)} placeholder={addLabel} aria-label={addLabel} />
        <button className="btn btn-sm" type="submit"><Icon n="plus" size={14} /> Add</button>
      </form>
    </section>
  );
}

function Users() {
  const { state, act, run, notify } = useStore();
  const cfg = state.config;
  const [nu, setNu] = useState({ name: '', email: '', role: 'hr', scope: cfg.departments[0].name });
  const [temp, setTemp] = useState(null);
  const save = (item, msg) => run(() => act.userUpdate(item.id, { role: item.role, scope: item.role === 'depthead' ? item.scope : null, active: item.active }), msg);
  const reset = async (x) => { const r = await run(() => act.userReset(x.id)); if (r) setTemp({ name: x.name, email: x.email, password: r.temporaryPassword }); };
  const add = async (e) => {
    e.preventDefault();
    if (!nu.name.trim() || !nu.email.includes('@')) { notify('Enter a name and a valid e-mail.', 'error'); return; }
    const r = await run(() => act.userAdd({ name: nu.name, email: nu.email, role: nu.role, scope: nu.role === 'depthead' ? nu.scope : null }), `${nu.name} added as ${ROLES[nu.role].label}`);
    if (r) { setTemp({ name: nu.name, email: nu.email, password: r.temporaryPassword }); setNu({ ...nu, name: '', email: '' }); }
  };
  return (
    <div className="stack">
      {temp && (
        <section className="panel" role="alert">
          <div className="panel-head"><h2>Temporary password for {temp.name}</h2><button className="btn btn-sm" onClick={() => setTemp(null)}>Done</button></div>
          <p>Give this to <strong>{temp.email}</strong> in person or by phone. They must change it at first sign-in. It is shown only once.</p>
          <div className="temp-pw">{temp.password}</div>
        </section>
      )}
      <section className="panel flush">
        <div className="panel-head pad"><h2>Users</h2><span className="muted small">Sign-in is by e-mail and password; single sign-on or MFA is a §19 decision.</span></div>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>User</th><th>Login / e-mail</th><th>Role</th><th>Organisational scope</th><th>Last sign-in</th><th className="right">Actions</th></tr></thead>
          <tbody>{cfg.users.map((x) => (
            <tr key={x.id} className={x.active ? '' : 'row-off'}>
              <td><span className="who-row"><Avatar name={x.name} size={30} /><strong>{x.name}</strong></span></td>
              <td className="small mono">{x.email}</td>
              <td><select id={'role-' + x.id} value={x.role} disabled={x.id === state.user.id} onChange={(e) => save({ ...x, role: e.target.value, scope: e.target.value === 'depthead' ? x.scope || cfg.departments[0].name : null }, `${x.name} is now ${ROLES[e.target.value].label}`)} aria-label="Role">{Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}</select></td>
              <td>{x.role === 'depthead' ? <select id={'scope-' + x.id} value={x.scope || ''} onChange={(e) => save({ ...x, scope: e.target.value }, 'Scope updated')} aria-label="Department scope">{cfg.departments.map((d) => <option key={d.id}>{d.name}</option>)}</select> : <span className="muted small">All permitted records</span>}</td>
              <td className="small">{x.last_login_at ? new Date(x.last_login_at).toLocaleDateString('en-GB') : <span className="muted">never</span>}{x.must_change_password && <span className="block muted">must change password</span>}</td>
              <td className="right nowrap">
                <button className="btn btn-sm btn-ghost" disabled={x.id === state.user.id} onClick={() => reset(x)}>Reset password</button>
                <button className="btn btn-sm btn-ghost" disabled={x.id === state.user.id} onClick={() => save({ ...x, active: !x.active }, `${x.name} ${x.active ? 'deactivated' : 'activated'}`)}>{x.active ? 'Deactivate' : 'Activate'}</button>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
        <form className="add-row" onSubmit={add}>
          <input id="nu-name" value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} placeholder="Full name" aria-label="Full name" />
          <input id="nu-email" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} placeholder="name@adroit.ae" aria-label="E-mail" />
          <select id="nu-role" value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })} aria-label="Role">{Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}</select>
          {nu.role === 'depthead' && <select id="nu-scope" value={nu.scope} onChange={(e) => setNu({ ...nu, scope: e.target.value })} aria-label="Department">{cfg.departments.map((d) => <option key={d.id}>{d.name}</option>)}</select>}
          <button className="btn btn-sm btn-primary" type="submit"><Icon n="plus" size={14} /> Add user</button>
        </form>
      </section>
      <section className="panel flush">
        <div className="panel-head pad"><h2>Role permissions</h2><span className="muted small">Enforced by the server on every request. Final roles are confirmed in requirements workshops.</span></div>
        <div className="table-wrap"><table className="table perm">
          <thead><tr><th>Area</th>{Object.values(ROLES).map((r) => <th key={r.label}>{r.label}</th>)}</tr></thead>
          <tbody>{PERMS.map(([area, v]) => <tr key={area}><td><strong>{area}</strong></td>{Object.keys(ROLES).map((k) => <td key={k} className="small">{v[k] === '—' ? <span className="muted">—</span> : v[k]}</td>)}</tr>)}</tbody>
        </table></div>
      </section>
    </div>
  );
}

function Health() {
  const { act, run } = useStore();
  const [h, setH] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const load = () => act.health().then(setH).catch((x) => setErr(x.message));
  useEffect(() => { load(); }, []);
  const job = async (j) => { setBusy(j); await run(() => act.runJob(j), (r) => `${j} job finished: ${JSON.stringify(r.result).slice(0, 120)}`); setBusy(''); load(); };
  const ok = (b) => <span className={b ? 'dot-ok' : 'dot-bad'} />;
  if (err) return <p className="error">{err}</p>;
  if (!h) return <p className="muted">Loading…</p>;
  const jobRow = (name, label) => { const j = h.jobs.find((x) => x.job === name); return (
    <tr key={name}><td><strong>{label}</strong></td><td>{j ? <><span className={j.status === 'ok' ? 'dot-ok' : j.status === 'failed' ? 'dot-bad' : 'dot-warn'} />{j.status}</> : <span className="muted">not run yet</span>}</td>
      <td className="small">{j ? new Date(j.started_at).toLocaleString('en-GB') : '—'}</td><td className="small">{j?.error ? j.error.split('\n')[0] : j?.detail ? Object.entries(j.detail).map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${v}`).join(' · ') : '—'}</td>
      <td className="right"><button className="btn btn-sm" disabled={!!busy} onClick={() => job(name)}>{busy === name ? 'Running…' : 'Run now'}</button></td></tr>
  ); };
  return (
    <div className="stack">
      <div className="health-grid">
        <section className="panel health-card"><h2>{ok(true)}Application</h2><p className="small">Version {h.app.version} · Node {h.app.node} · {h.app.env}<br />Up {h.app.uptimeMinutes} min · time zone {h.app.timezone}<br />Background jobs {h.app.jobsEnabled ? 'enabled' : 'disabled'}</p></section>
        <section className="panel health-card"><h2>{ok(true)}Database</h2><p className="small">{h.database.version.split(' on ')[0]}<br />Size {h.database.size} · schema {h.database.migration}<br />{h.counts.employees} employees · {h.counts.assets} assets · {h.counts.users} active users · {Number(h.counts.audit_events).toLocaleString()} audit events</p></section>
        <section className="panel health-card"><h2>{ok(h.storage.ok)}Document storage</h2><p className="small">{h.storage.ok ? `${h.counts.files} files · ${(h.counts.file_bytes / 1048576).toFixed(1)} MB` : h.storage.error}<br />{h.storage.freeGB != null && `${h.storage.freeGB} GB free`}<br /><span className="mono">{h.storage.dir}</span></p></section>
        <section className="panel health-card"><h2><span className={h.email.configured ? 'dot-ok' : 'dot-warn'} />E-mail</h2><p className="small">{h.email.configured ? 'SMTP configured' : 'SMTP not configured (in-app alerts only)'} · {h.email.enabledInSettings ? 'e-mail alerts on' : 'e-mail alerts off'}<br />{h.counts.email_pending} pending · {h.counts.email_failed} failed</p>
          {h.email.configured && <button className="btn btn-sm" onClick={async () => { const r = await run(() => act.verifyEmail()); if (r) run(async () => r, r.ok ? 'SMTP connection works' : `SMTP problem: ${r.error}`); }}>Test SMTP connection</button>}</section>
        <section className="panel health-card"><h2><span className={h.alertsEnabled && h.officersAssigned ? 'dot-ok' : 'dot-warn'} />Expiry alerts</h2><p className="small">{h.alertsEnabled ? 'Switched on' : 'Switched off (Settings → System configuration)'}<br />{h.officersAssigned ? 'Every expiring document type has a responsible officer' : 'Some document types have no responsible officer'}</p></section>
        {h.ai && <section className="panel health-card"><h2><span className={h.ai.enabledInSettings ? 'dot-ok' : 'dot-warn'} />AI assistant</h2><p className="small">{h.ai.enabledInSettings ? 'Enabled' : 'Switched off in settings'} · {h.ai.model ? `provider: ${h.ai.provider} (${h.ai.model})` : 'rules engine only (no provider key)'}<br />Last 24 h: {h.ai.last24h.questions} questions{h.ai.model ? `, ${h.ai.last24h.by_provider} routed by the provider` : ''}</p></section>}
        <section className="panel health-card"><h2><span className={h.backups.latest.length ? 'dot-ok' : 'dot-warn'} />Backups</h2><p className="small">{h.backups.dir ? (h.backups.latest.length ? <>Latest: {h.backups.latest[0].file}<br />{new Date(h.backups.latest[0].at).toLocaleString('en-GB')} · {(h.backups.latest[0].size / 1048576).toFixed(1)} MB</> : 'No backup files found yet') : 'Backup folder not mounted (BACKUP_DIR)'}</p></section>
      </div>
      <section className="panel flush">
        <div className="panel-head pad"><h2>Background jobs</h2><button className="btn btn-sm" onClick={load}>Refresh</button></div>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Job</th><th>Last result</th><th>Started</th><th>Detail</th><th /></tr></thead>
          <tbody>{jobRow('expiry', 'Daily expiry check & alerts')}{jobRow('digest', 'Weekly management digest')}{jobRow('mail', 'E-mail delivery')}</tbody>
        </table></div>
        {h.recentFailures.length > 0 && <p className="pad small warn-text">Recent failures: {h.recentFailures.map((f) => `${f.job} ${new Date(f.started_at).toLocaleString('en-GB')}`).join(', ')}</p>}
      </section>
    </div>
  );
}
