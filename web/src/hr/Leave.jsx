import React, { useEffect, useMemo, useState } from 'react';
import { useStore, href } from '../core/store.jsx';
import { fmt, iso, TODAY, daysUntil } from '../core/shared.js';
import { scopeEmployees, can } from '../core/access.js';
import { Icon, Tabs, LeavePill, Modal, Field, Avatar, Empty, DateInput } from '../core/ui.jsx';
import ApplyLeaveModal from './ApplyLeaveModal.jsx';
import { LEAVE_TYPES, DEPARTMENTS, leaveTaken, empParam } from './data.js';

const STEPS = ['Leave request', 'HR review', 'Approval', 'Vacation', 'Rejoining', 'History'];
const stepOf = (s) => ({ 'Pending HR Review': 1, 'Pending Approval': 2, Approved: 3, 'On Leave': 3, 'Awaiting Rejoining': 4, Completed: 5, Rejected: 5 }[s] ?? 0);

export default function Leave({ initialTab }) {
  const { state, act, run } = useStore();
  const u = state.user;
  const scope = new Set(scopeEmployees(u, state.employees).map((e) => e.id));
  const L = state.leaves.filter((l) => scope.has(l.empId));
  const [tab, setTab] = useState(['queue', 'away', 'calendar', 'history'].includes(initialTab) ? initialTab : 'queue');
  const [applying, setApplying] = useState(initialTab === 'apply' && can(u, 'submitLeave'));
  useEffect(() => {
    if (['queue', 'away', 'calendar', 'history'].includes(initialTab)) setTab(initialTab);
    if (initialTab === 'apply' && can(u, 'submitLeave')) setApplying(true);
  }, [initialTab]);
  const [acting, setActing] = useState(null); // {leave, action}
  const [fType, setFType] = useState('');
  const [fDept, setFDept] = useState('');
  const [fStatus, setFStatus] = useState('');
  const emp = (id) => state.employees.find((e) => e.id === id);

  const pending = L.filter((l) => l.status.startsWith('Pending'));
  const onLeave = L.filter((l) => l.status === 'On Leave');
  const awaiting = L.filter((l) => l.status === 'Awaiting Rejoining');
  const upcoming = L.filter((l) => l.status === 'Approved').sort((a, b) => (a.start > b.start ? 1 : -1));
  const history = L.filter((l) => (!fType || l.type === fType) && (!fDept || emp(l.empId)?.department === fDept) && (!fStatus || l.status === fStatus))
    .sort((a, b) => (a.start < b.start ? 1 : -1));

  const Who = ({ l }) => {
    const e = emp(l.empId);
    return <a className="who-row" href={href('hr-employee', empParam(e.id))}><Avatar name={e.name} size={32} photo={e.photo} /><span className="who"><strong>{e.name}</strong><small className="mono">{e.id} · {e.department.replace(' Department', '')}</small></span></a>;
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Leave Management</span>
          <h1>Leave &amp; Rejoining</h1>
          <p className="muted">From request to rejoining, every step recorded against the employee.</p>
        </div>
        {can(u, 'submitLeave') && <div className="head-actions"><button className="btn btn-primary" onClick={() => setApplying(true)}><Icon n="plus" size={16} /> New leave request</button></div>}
      </div>

      <ol className="flow">
        {STEPS.map((s, i) => {
          const n = [pending.filter((l) => l.status === 'Pending HR Review').length, pending.filter((l) => l.status === 'Pending HR Review').length, pending.filter((l) => l.status === 'Pending Approval').length, onLeave.length + upcoming.length, awaiting.length, L.filter((l) => ['Completed', 'Rejected'].includes(l.status)).length][i];
          return <li key={s}><span className="flow-n">{i + 1}</span><span className="flow-t">{s}</span><span className="flow-c">{i === 0 ? 'Dept. head submits' : `${n} ${i === 5 ? 'records' : 'now'}`}</span></li>;
        })}
      </ol>

      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'queue', label: 'Requests to review', count: pending.length },
        { key: 'away', label: 'On leave & rejoining', count: onLeave.length + awaiting.length },
        { key: 'calendar', label: 'Leave planner' },
        { key: 'history', label: 'History' },
      ]} />

      {tab === 'queue' && (
        <div className="req-list">
          {pending.length === 0 && <Empty title="No requests waiting">New requests from department heads appear here for HR review.</Empty>}
          {pending.map((l) => {
            const e = emp(l.empId);
            const taken = leaveTaken(state.leaves, e);
            return (
              <article className="req" key={l.id}>
                <div className="req-main">
                  <Who l={l} />
                  <div className="req-meta">
                    <span className="mono small muted">{l.id}</span>
                    <LeavePill status={l.status} />
                  </div>
                </div>
                <div className="req-body">
                  <div><span className="kpi-label">Type</span><strong>{l.type}</strong></div>
                  <div><span className="kpi-label">Dates</span><strong>{fmt(l.start)} → {fmt(l.end)}</strong></div>
                  <div><span className="kpi-label">Days</span><strong>{l.days}</strong></div>
                  <div><span className="kpi-label">Annual taken {TODAY.getFullYear()}</span><strong>{taken} days</strong></div>
                  <div><span className="kpi-label">Requested by</span><strong>{l.requestedBy} · {fmt(l.requestedOn)}</strong></div>
                </div>
                <p className="req-reason">{l.reason}{l.hrNote && <><br /><span className="muted small">HR note: {l.hrNote}</span></>}</p>
                <div className="stepper" aria-label="Progress">{STEPS.slice(0, 5).map((s, i) => <span key={s} className={i < stepOf(l.status) ? 'done' : i === stepOf(l.status) ? 'now' : ''}>{s}</span>)}</div>
                {l.trail?.length > 0 && <p className="trail small muted">{l.trail.map((t) => `${t.what} · ${t.by} · ${t.at}`).join('  ›  ')}</p>}
                {(() => {
                  const canAct = l.status === 'Pending HR Review' ? can(u, 'reviewLeave') : can(u, 'approveLeave');
                  if (!canAct) return <p className="muted small right">Waiting for {l.status === 'Pending HR Review' ? 'HR review' : 'Management approval'}.</p>;
                  return (
                    <div className="btn-row end">
                      <button className="btn btn-danger-ghost" onClick={() => setActing({ leave: l, action: 'reject' })}>Reject</button>
                      {l.status === 'Pending HR Review'
                        ? <button className="btn btn-primary" onClick={() => setActing({ leave: l, action: 'review' })}>Checked · send for approval</button>
                        : <button className="btn btn-primary" onClick={() => setActing({ leave: l, action: 'approve' })}>Approve</button>}
                    </div>
                  );
                })()}
              </article>
            );
          })}
        </div>
      )}

      {tab === 'away' && (
        <div className="stack">
          {awaiting.length > 0 && (
            <section className="panel flush">
              <div className="panel-head pad"><h2>Leave ended · rejoining not recorded</h2><span className="pill pill-critical">{awaiting.length} to confirm</span></div>
              <div className="table-wrap"><table className="table">
                <thead><tr><th>Employee</th><th>Leave</th><th>Ended</th><th>Overdue</th><th className="right">Action</th></tr></thead>
                <tbody>{awaiting.map((l) => (
                  <tr key={l.id}><td><Who l={l} /></td><td>{l.type} · {l.days}d</td><td className="mono">{fmt(l.end)}</td><td className="warn-text">{-daysUntil(l.end) - 1} days</td>
                    <td className="right">{can(u, 'rejoin') && <button className="btn btn-sm btn-primary" onClick={() => setActing({ leave: l, action: 'rejoin' })}>Record rejoining</button>}</td></tr>
                ))}</tbody>
              </table></div>
            </section>
          )}
          <section className="panel flush">
            <div className="panel-head pad"><h2>Currently on leave</h2><span className="muted small">{onLeave.length} employees</span></div>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Expected back</th><th className="right">Action</th></tr></thead>
              <tbody>{onLeave.map((l) => {
                const back = new Date(l.end + 'T00:00:00'); back.setDate(back.getDate() + 1);
                return (
                  <tr key={l.id}><td><Who l={l} /></td><td>{l.type}</td><td className="mono">{fmt(l.start)}</td><td className="mono">{fmt(l.end)}</td>
                    <td className="mono">{fmt(iso(back))} <small className="muted">· in {daysUntil(iso(back))}d</small></td>
                    <td className="right">{can(u, 'rejoin') && <button className="btn btn-sm" onClick={() => setActing({ leave: l, action: 'rejoin' })}>Rejoined early</button>}</td></tr>
                );
              })}</tbody>
            </table></div>
          </section>
          <section className="panel flush">
            <div className="panel-head pad"><h2>Approved · upcoming</h2></div>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Starts in</th></tr></thead>
              <tbody>{upcoming.map((l) => (
                <tr key={l.id}><td><Who l={l} /></td><td>{l.type}</td><td className="mono">{fmt(l.start)}</td><td className="mono">{fmt(l.end)}</td><td>{l.days}</td><td>{daysUntil(l.start)} days</td></tr>
              ))}</tbody>
            </table></div>
          </section>
        </div>
      )}

      {tab === 'calendar' && <Planner leaves={L} emp={emp} />}

      {tab === 'history' && (
        <section className="panel flush">
          <div className="panel-tools">
            <select id="h-type" value={fType} onChange={(e) => setFType(e.target.value)} aria-label="Leave type"><option value="">All leave types</option>{LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            <select id="h-dept" value={fDept} onChange={(e) => setFDept(e.target.value)} aria-label="Department"><option value="">All departments</option>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select>
            <select id="h-status" value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Status"><option value="">All statuses</option>{['Pending HR Review', 'Pending Approval', 'Approved', 'On Leave', 'Awaiting Rejoining', 'Completed', 'Rejected'].map((t) => <option key={t}>{t}</option>)}</select>
          </div>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Ref.</th><th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th>Rejoined</th></tr></thead>
            <tbody>{history.map((l) => (
              <tr key={l.id}><td className="mono small">{l.id}</td><td><Who l={l} /></td><td>{l.type}</td><td className="mono">{fmt(l.start)}</td><td className="mono">{fmt(l.end)}</td><td>{l.days}</td><td><LeavePill status={l.status} />{l.rejectReason && <small className="block muted">{l.rejectReason}</small>}</td><td className="mono">{fmt(l.rejoined)}</td></tr>
            ))}</tbody>
          </table></div>
          <div className="pager"><span className="muted small">{history.length} leave records</span></div>
        </section>
      )}

      {applying && <ApplyLeaveModal onClose={() => setApplying(false)} />}
      {acting && <ActionModal {...acting} emp={emp(acting.leave.empId)} onClose={() => setActing(null)} onDone={async (body, msg) => { if (await run(() => act.leaveAction(acting.leave.id, acting.action, body), msg)) setActing(null); }} />}
    </div>
  );
}

function ActionModal({ leave, action, emp, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [date, setDate] = useState(iso(TODAY));
  const titles = { review: 'HR review', approve: 'Approve leave', reject: 'Reject leave', rejoin: 'Record rejoining' };
  const [busy, setBusy] = useState(false);
  const msgs = { review: `Sent to management for approval · ${emp.name}`, approve: `Leave approved · ${emp.name}`, reject: `Leave rejected · ${emp.name}`, rejoin: `Rejoining recorded · ${emp.name} on ${fmt(date)}` };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    await onDone(action === 'rejoin' ? { note, date } : { note }, msgs[action]);
    setBusy(false);
  };
  return (
    <Modal title={`${titles[action]} · ${emp.name}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className={'btn ' + (action === 'reject' ? 'btn-danger' : 'btn-primary')} form="act-form" type="submit" disabled={busy}>{action === 'reject' ? 'Reject request' : action === 'rejoin' ? 'Save rejoining' : action === 'review' ? 'Send for approval' : 'Approve'}</button></>}>
      <form id="act-form" className="form-grid" onSubmit={submit}>
        <p className="note span-2">{leave.type} · {fmt(leave.start)} to {fmt(leave.end)} · {leave.days} days</p>
        {action === 'rejoin' && <Field label="Date employee reported back for duty"><DateInput id="act-date" max={iso(TODAY)} min={leave.start} value={date} onChange={(e) => setDate(e.target.value)} /></Field>}
        <Field label={action === 'reject' ? 'Reason for rejection' : action === 'review' ? 'Review notes' : 'Remarks (optional)'} span={2}>
          <textarea id="act-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} required={action === 'reject'} placeholder={action === 'review' ? 'e.g. Record checked, no overlapping leave in department' : ''} />
        </Field>
      </form>
    </Modal>
  );
}

// 8-week horizontal planner: who is away when
function Planner({ leaves, emp }) {
  const start = new Date(TODAY); start.setDate(start.getDate() - 7);
  const DAYS = 63;
  const days = Array.from({ length: DAYS }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  const rows = useMemo(() => leaves.filter((l) => !['Rejected', 'Pending HR Review'].includes(l.status) && l.end >= iso(days[0]) && l.start <= iso(days[DAYS - 1]))
    .sort((a, b) => (a.start > b.start ? 1 : -1)), [leaves]);
  const col = (d) => Math.max(0, Math.min(DAYS, Math.round((new Date(d + 'T00:00:00') - start) / 864e5)));
  const todayCol = col(iso(TODAY));
  return (
    <section className="panel flush">
      <div className="panel-head pad"><h2>Who is away · next 8 weeks</h2>
        <span className="legend small"><i className="lg lg-on" /> on leave <i className="lg lg-appr" /> approved <i className="lg lg-pend" /> pending approval</span></div>
      <div className="planner-wrap">
        <div className="planner" style={{ '--days': DAYS }}>
          <div className="pl-head">
            <span className="pl-name" />
            <div className="pl-days">
              {days.map((d, i) => <span key={i} className={(d.getDay() === 0 ? 'wk ' : '') + (i === todayCol ? 'today' : '')}>{d.getDate() === 1 || i === 0 || d.getDay() === 1 ? d.getDate() : ''}{d.getDate() === 1 || i === 0 ? <b>{d.toLocaleDateString('en-GB', { month: 'short' })}</b> : null}</span>)}
            </div>
          </div>
          {rows.map((l) => {
            const e = emp(l.empId);
            const a = col(l.start), b = col(iso(new Date(new Date(l.end + 'T00:00:00').getTime() + 864e5)));
            const cls = l.status === 'Pending Approval' ? 'pend' : l.status === 'Approved' ? 'appr' : 'on';
            return (
              <div className="pl-row" key={l.id}>
                <span className="pl-name"><strong>{e.name}</strong><small>{e.department.replace(' Department', '')}</small></span>
                <div className="pl-days">
                  <span className="pl-today" style={{ left: `calc(${todayCol} * 100% / ${DAYS})` }} />
                  <span className={'pl-bar pl-' + cls} style={{ left: `calc(${a} * 100% / ${DAYS})`, width: `calc(${Math.max(1, b - a)} * 100% / ${DAYS})` }} title={`${l.type}: ${fmt(l.start)} – ${fmt(l.end)}`}>{l.type.split(' ')[0]}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
