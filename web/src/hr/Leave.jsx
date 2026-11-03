import React, { useEffect, useMemo, useState } from 'react';
import { useStore, href } from '../core/store.jsx';
import { fmt, iso, TODAY, daysUntil } from '../core/shared.js';
import { scopeEmployees, can } from '../core/access.js';
import { Icon, Tabs, LeavePill, Modal, Field, Avatar, Empty, DateInput } from '../core/ui.jsx';
import ApplyLeaveModal from './ApplyLeaveModal.jsx';
import LeavePrintModal from './LeavePrintModal.jsx';
import RejoinAddModal from './RejoinAddModal.jsx';
import RejoinedReportModal from './RejoinedReportModal.jsx';
import VacationReportModal from './VacationReportModal.jsx';
import RejectedReportModal from './RejectedReportModal.jsx';
import { LEAVE_TYPES, DEPARTMENTS, leaveTaken, empParam } from './data.js';

const STEPS = ['Leave request', 'HR review', 'Approval', 'Vacation', 'Rejoining', 'History'];
const stepOf = (s) => ({ 'Pending HR Review': 1, 'Pending Approval': 2, Approved: 3, 'On Leave': 3, 'Awaiting Rejoining': 4, Completed: 5, Rejected: 5 }[s] ?? 0);

export default function Leave({ initialTab }) {
  const { state, act, run } = useStore();
  const u = state.user;
  const scope = new Set(scopeEmployees(u, state.employees).map((e) => e.id));
  const L = state.leaves.filter((l) => scope.has(l.empId));

  const validTabs = ['queue', 'away', 'rejected', 'calendar', 'history'];
  const [tab, setTab] = useState(validTabs.includes(initialTab) ? initialTab : 'queue');
  const [applying, setApplying] = useState(initialTab === 'apply' && can(u, 'submitLeave'));
  const [showRejoinModal, setShowRejoinModal] = useState(false);
  const [showRejoinedReportModal, setShowRejoinedReportModal] = useState(false);
  const [showVacationReportModal, setShowVacationReportModal] = useState(false);
  const [showRejectedReportModal, setShowRejectedReportModal] = useState(false);
  const [printingLeave, setPrintingLeave] = useState(null); // { leave, emp }

  useEffect(() => {
    if (validTabs.includes(initialTab)) setTab(initialTab);
    if (initialTab === 'apply' && can(u, 'submitLeave')) setApplying(true);
  }, [initialTab]);

  const [acting, setActing] = useState(null); // {leave, action}
  const [fType, setFType] = useState('');
  const [fDept, setFDept] = useState('');
  const [fStatus, setFStatus] = useState('');
  
  // Item 4: On-vacation search & rejected search
  const [vacationSearch, setVacationSearch] = useState('');
  const [rejectedSearch, setRejectedSearch] = useState('');

  const emp = (id) => state.employees.find((e) => e.id === id);

  const pending = L.filter((l) => l.status.startsWith('Pending'));
  const onLeave = L.filter((l) => l.status === 'On Leave');
  const awaiting = L.filter((l) => l.status === 'Awaiting Rejoining');
  const rejected = L.filter((l) => l.status === 'Rejected');
  const upcoming = L.filter((l) => l.status === 'Approved').sort((a, b) => (a.start > b.start ? 1 : -1));
  const history = L.filter((l) => (!fType || l.type === fType) && (!fDept || emp(l.empId)?.department === fDept) && (!fStatus || l.status === fStatus))
    .sort((a, b) => (a.start < b.start ? 1 : -1));

  // Vacation search filter matching employee name, id, code, or department
  const matchVacation = (l) => {
    if (!vacationSearch.trim()) return true;
    const q = vacationSearch.toLowerCase();
    const e = emp(l.empId);
    return e?.name?.toLowerCase().includes(q) ||
           e?.id?.toLowerCase().includes(q) ||
           e?.code?.toLowerCase().includes(q) ||
           e?.department?.toLowerCase().includes(q) ||
           l.id?.toLowerCase().includes(q);
  };

  const filteredOnLeave = onLeave.filter(matchVacation);
  const filteredAwaiting = awaiting.filter(matchVacation);
  const filteredUpcoming = upcoming.filter(matchVacation);

  // Rejected search filter
  const filteredRejected = rejected.filter((l) => {
    if (!rejectedSearch.trim()) return true;
    const q = rejectedSearch.toLowerCase();
    const e = emp(l.empId);
    return e?.name?.toLowerCase().includes(q) ||
           e?.id?.toLowerCase().includes(q) ||
           e?.department?.toLowerCase().includes(q) ||
           l.id?.toLowerCase().includes(q) ||
           l.rejectReason?.toLowerCase().includes(q) ||
           l.decidedBy?.toLowerCase().includes(q);
  }).sort((a, b) => (b.start > a.start ? 1 : -1));

  const Who = ({ l }) => {
    const e = emp(l.empId);
    if (!e) return <span className="mono">{l.empId}</span>;
    return (
      <a className="who-row" href={href('hr-employee', empParam(e.id))}>
        <Avatar name={e.name} size={32} photo={e.photo} />
        <span className="who">
          <strong>{e.name}</strong>
          <small className="mono">{e.id} {e.code ? `(${e.code})` : ''} · {e.department.replace(' Department', '')}</small>
        </span>
      </a>
    );
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Leave Management</span>
          <h1>Leave &amp; Rejoining</h1>
          <p className="muted">From request to rejoining, every step recorded against the employee.</p>
        </div>
        <div className="head-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button id="btn-vacation-report" className="btn btn-ghost" onClick={() => setShowVacationReportModal(true)}>
            <Icon n="docs" size={16} /> On Vacation Report (PDF)
          </button>
          <button id="btn-rejected-report" className="btn btn-ghost" onClick={() => setShowRejectedReportModal(true)}>
            <Icon n="docs" size={16} /> Rejected Report (PDF)
          </button>
          <button id="btn-rejoined-report" className="btn btn-ghost" onClick={() => setShowRejoinedReportModal(true)}>
            <Icon n="docs" size={16} /> Rejoined Report (PDF)
          </button>
          <button id="btn-add-rejoining" className="btn btn-primary" onClick={() => setShowRejoinModal(true)}>
            <Icon n="plus" size={16} /> Add Rejoining
          </button>
          {can(u, 'submitLeave') && (
            <button className="btn btn-secondary" onClick={() => setApplying(true)}>
              <Icon n="plus" size={16} /> New leave request
            </button>
          )}
        </div>
      </div>


      <ol className="flow">
        {STEPS.map((s, i) => {
          const n = [
            pending.filter((l) => l.status === 'Pending HR Review').length,
            pending.filter((l) => l.status === 'Pending HR Review').length,
            pending.filter((l) => l.status === 'Pending Approval').length,
            onLeave.length + upcoming.length,
            awaiting.length,
            L.filter((l) => ['Completed', 'Rejected'].includes(l.status)).length
          ][i];
          return (
            <li key={s}>
              <span className="flow-n">{i + 1}</span>
              <span className="flow-t">{s}</span>
              <span className="flow-c">{i === 0 ? 'Dept. head submits' : `${n} ${i === 5 ? 'records' : 'now'}`}</span>
            </li>
          );
        })}
      </ol>

      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'queue', label: 'Requests to review', count: pending.length },
        { key: 'away', label: 'On leave & rejoining', count: onLeave.length + awaiting.length },
        { key: 'rejected', label: 'Rejected requests', count: rejected.length },
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
                  <div><span className="kpi-label">Visa Sponsor</span><strong>{e?.sponsor || e?.company}</strong></div>
                </div>
                <p className="req-reason">{l.reason}{l.hrNote && <><br /><span className="muted small">HR note: {l.hrNote}</span></>}</p>
                <div className="stepper" aria-label="Progress">{STEPS.slice(0, 5).map((s, i) => <span key={s} className={i < stepOf(l.status) ? 'done' : i === stepOf(l.status) ? 'now' : ''}>{s}</span>)}</div>
                {l.trail?.length > 0 && <p className="trail small muted">{l.trail.map((t) => `${t.what} · ${t.by} · ${t.at}`).join('  ›  ')}</p>}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
                  <button className="btn btn-sm btn-ghost" onClick={() => setPrintingLeave({ leave: l, emp: e })}>
                    <Icon n="download" size={14} /> Print Application
                  </button>
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
                </div>
              </article>
            );
          })}
        </div>
      )}

      {tab === 'away' && (
        <div className="stack">
          {/* Item 4: On Vacation Search Toolbar */}
          <section className="panel pad" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 320px' }}>
                <Icon n="search" size={18} />
                <input
                  id="vacation-search"
                  type="search"
                  placeholder="On vacation Search: employee name, ID, code, or department..."
                  value={vacationSearch}
                  onChange={(e) => setVacationSearch(e.target.value)}
                  style={{ width: '100%', height: '36px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="muted small">
                  <strong>{filteredOnLeave.length}</strong> on leave · <strong>{filteredAwaiting.length}</strong> awaiting rejoining
                </span>
                <button id="away-btn-vacation-report" className="btn btn-sm btn-ghost" onClick={() => setShowVacationReportModal(true)}>
                  <Icon n="docs" size={14} /> On Vacation Report (PDF)
                </button>
                <button id="away-btn-add-rejoining" className="btn btn-sm btn-primary" onClick={() => setShowRejoinModal(true)}>
                  <Icon n="plus" size={14} /> Add Rejoining
                </button>
              </div>
            </div>
          </section>

          {filteredAwaiting.length > 0 && (
            <section className="panel flush">
              <div className="panel-head pad">
                <h2>Leave ended · rejoining not recorded</h2>
                <span className="pill pill-critical">{filteredAwaiting.length} to confirm</span>
              </div>
              <div className="table-wrap"><table className="table">
                <thead><tr><th>Employee</th><th>Leave Type</th><th>Sponsor</th><th>Ended</th><th>Overdue</th><th className="right">Action</th></tr></thead>
                <tbody>{filteredAwaiting.map((l) => (
                  <tr key={l.id}>
                    <td><Who l={l} /></td>
                    <td>{l.type} · {l.days}d</td>
                    <td>{emp(l.empId)?.sponsor || emp(l.empId)?.company}</td>
                    <td className="mono">{fmt(l.end)}</td>
                    <td className="warn-text">{-daysUntil(l.end) - 1} days</td>
                    <td className="right" style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => setPrintingLeave({ leave: l, emp: emp(l.empId) })}>
                        <Icon n="download" size={14} /> Print
                      </button>
                      <button className="btn btn-sm btn-primary" onClick={() => setActing({ leave: l, action: 'rejoin' })}>Add Rejoining</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table></div>
            </section>
          )}

          <section className="panel flush">
            <div className="panel-head pad">
              <h2>Currently on leave / vacation</h2>
              <span className="muted small">{filteredOnLeave.length} employees</span>
            </div>
            {filteredOnLeave.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center' }} className="muted small">
                {vacationSearch ? 'No on-leave employees match your search.' : 'No employees currently on vacation.'}
              </div>
            ) : (
              <div className="table-wrap"><table className="table">
                <thead><tr><th>Employee</th><th>Type</th><th>Contact While Away</th><th>Sponsor</th><th>From</th><th>To</th><th>Expected back</th><th className="right">Action</th></tr></thead>
                <tbody>{filteredOnLeave.map((l) => {
                  const back = new Date(l.end + 'T00:00:00'); back.setDate(back.getDate() + 1);
                  const e = emp(l.empId);
                  const contactNum = l.contactAbroad || e?.emergencyContact || e?.mobile || '—';
                  return (
                    <tr key={l.id}>
                      <td><Who l={l} /></td>
                      <td>{l.type}</td>
                      <td className="mono small">{contactNum}</td>
                      <td>{e?.sponsor || e?.company}</td>
                      <td className="mono">{fmt(l.start)}</td>
                      <td className="mono">{fmt(l.end)}</td>
                      <td className="mono">{fmt(iso(back))} <small className="muted">· in {daysUntil(iso(back))}d</small></td>
                      <td className="right" style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => setPrintingLeave({ leave: l, emp: e })}>
                          <Icon n="download" size={14} /> Print
                        </button>
                        <button className="btn btn-sm" onClick={() => setActing({ leave: l, action: 'rejoin' })}>Add Rejoining</button>
                      </td>
                    </tr>

                  );
                })}</tbody>
              </table></div>
            )}
          </section>

          <section className="panel flush">
            <div className="panel-head pad"><h2>Approved · upcoming</h2></div>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Employee</th><th>Type</th><th>Sponsor</th><th>From</th><th>To</th><th>Days</th><th>Starts in</th><th className="right">Action</th></tr></thead>
              <tbody>{filteredUpcoming.map((l) => (
                <tr key={l.id}>
                  <td><Who l={l} /></td>
                  <td>{l.type}</td>
                  <td>{emp(l.empId)?.sponsor || emp(l.empId)?.company}</td>
                  <td className="mono">{fmt(l.start)}</td>
                  <td className="mono">{fmt(l.end)}</td>
                  <td>{l.days}</td>
                  <td>{daysUntil(l.start)} days</td>
                  <td className="right">
                    <button className="btn btn-sm btn-ghost" onClick={() => setPrintingLeave({ leave: l, emp: emp(l.empId) })}>
                      <Icon n="download" size={14} /> Print
                    </button>
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          </section>
        </div>
      )}

      {/* Item 4: Dedicated Rejected Requests View */}
      {tab === 'rejected' && (
        <section className="panel flush">
          <div className="panel-tools" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', background: 'var(--surface-2)', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 360px' }}>
              <Icon n="search" size={18} />
              <input
                id="rejected-search"
                type="search"
                placeholder="Search rejected leave requests by employee, ref, or reason..."
                value={rejectedSearch}
                onChange={(e) => setRejectedSearch(e.target.value)}
                style={{ width: '100%', height: '36px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="muted small"><strong>{filteredRejected.length}</strong> rejected leave applications</span>
              <button id="tab-btn-rejected-report" className="btn btn-sm btn-ghost" onClick={() => setShowRejectedReportModal(true)}>
                <Icon n="docs" size={14} /> Rejected Report (PDF)
              </button>
            </div>
          </div>
          <div className="table-wrap"><table className="table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Employee</th>
                <th>Leave Type</th>
                <th>Requested Dates</th>
                <th>Days</th>
                <th>Requested By</th>
                <th>Decided By &amp; Date</th>
                <th>Rejection Reason</th>
                <th className="right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRejected.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '36px' }} className="muted">
                    No rejected leave applications found.
                  </td>
                </tr>
              ) : (
                filteredRejected.map((l) => (
                  <tr key={l.id}>
                    <td className="mono small">{l.id}</td>
                    <td><Who l={l} /></td>
                    <td>{l.type}</td>
                    <td className="mono nowrap">{fmt(l.start)} → {fmt(l.end)}</td>
                    <td>{l.days}</td>
                    <td>{l.requestedBy} <small className="block muted">{fmt(l.requestedOn)}</small></td>
                    <td>
                      <strong>{l.decidedBy || 'Management'}</strong>
                      <small className="block muted">
                        {fmt(l.decidedAt || l.trail?.find((t) => t.what?.includes('Rejected'))?.at?.slice(0, 10) || l.requestedOn)}
                      </small>
                    </td>
                    <td style={{ maxWidth: '280px' }}>
                      <span className="pill pill-critical" style={{ marginBottom: '4px', display: 'inline-block' }}>Rejected</span>
                      <p className="small warn-text" style={{ margin: 0 }}>{l.rejectReason || l.hrNote || '—'}</p>
                    </td>
                    <td className="right">
                      <button className="btn btn-sm btn-ghost" onClick={() => setPrintingLeave({ leave: l, emp: emp(l.empId) })}>
                        <Icon n="download" size={14} /> Print
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
          <div className="pager"><span className="muted small">{filteredRejected.length} rejected records</span></div>
        </section>
      )}

      {tab === 'calendar' && <Planner leaves={L} emp={emp} />}

      {tab === 'history' && (
        <section className="panel flush">
          <div className="panel-tools" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select id="h-type" value={fType} onChange={(e) => setFType(e.target.value)} aria-label="Leave type"><option value="">All leave types</option>{LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
              <select id="h-dept" value={fDept} onChange={(e) => setFDept(e.target.value)} aria-label="Department"><option value="">All departments</option>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select>
              <select id="h-status" value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Status"><option value="">All statuses</option>{['Pending HR Review', 'Pending Approval', 'Approved', 'On Leave', 'Awaiting Rejoining', 'Completed', 'Rejected'].map((t) => <option key={t}>{t}</option>)}</select>
            </div>
            <button className="btn btn-sm btn-secondary" onClick={() => setShowRejoinedReportModal(true)}>
              <Icon n="docs" size={14} /> Rejoined Date-Range Report
            </button>
          </div>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Ref.</th><th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th>Rejoined</th><th className="right">Action</th></tr></thead>
            <tbody>{history.map((l) => (
              <tr key={l.id}>
                <td className="mono small">{l.id}</td>
                <td><Who l={l} /></td>
                <td>{l.type}</td>
                <td className="mono">{fmt(l.start)}</td>
                <td className="mono">{fmt(l.end)}</td>
                <td>{l.days}</td>
                <td><LeavePill status={l.status} />{l.rejectReason && <small className="block muted">{l.rejectReason}</small>}</td>
                <td className="mono">{fmt(l.rejoined)}</td>
                <td className="right">
                  <button className="btn btn-sm btn-ghost" onClick={() => setPrintingLeave({ leave: l, emp: emp(l.empId) })}>
                    <Icon n="download" size={14} /> Print
                  </button>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
          <div className="pager"><span className="muted small">{history.length} leave records</span></div>
        </section>
      )}

      {applying && <ApplyLeaveModal onClose={() => setApplying(false)} />}
      
      {/* Item 5: Rejoin Add Modal */}
      {showRejoinModal && <RejoinAddModal onClose={() => setShowRejoinModal(false)} />}

      {/* Item 6: Rejoined Report Modal */}
      {showRejoinedReportModal && <RejoinedReportModal onClose={() => setShowRejoinedReportModal(false)} />}

      {/* Item 4: On Vacation Report Modal */}
      {showVacationReportModal && <VacationReportModal onClose={() => setShowVacationReportModal(false)} />}

      {/* Item 4: Rejected Report Modal */}
      {showRejectedReportModal && <RejectedReportModal onClose={() => setShowRejectedReportModal(false)} />}

      {/* Item 3: Print Modal */}
      {printingLeave && (
        <LeavePrintModal
          leave={printingLeave.leave}
          emp={printingLeave.emp}
          close={() => setPrintingLeave(null)}
        />
      )}

      {acting && (
        <ActionModal
          {...acting}
          emp={emp(acting.leave.empId)}
          onClose={() => setActing(null)}
          onDone={async (body, msg) => {
            if (await run(() => act.leaveAction(acting.leave.id, acting.action, body), msg)) {
              setActing(null);
            }
          }}
        />
      )}
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
