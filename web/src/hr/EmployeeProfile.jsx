import React, { useState } from 'react';
import { useStore, go } from '../core/store.jsx';
import { fmt, docStatus, officerFor, TODAY, docCfg, OPERATING, ROLES, docTypes, actionStatus } from '../core/shared.js';
import { scopeEmployees, canSeeDoc, can } from '../core/access.js';
import { Icon, Tabs, KV, StatusPill, LeavePill, DocViewer, Empty, PhotoBox, ActionPill } from '../core/ui.jsx';
import { UploadDocModal, RenewalActionModal } from '../core/docModals.jsx';
import ApplyLeaveModal from './ApplyLeaveModal.jsx';
import LeavePrintModal from './LeavePrintModal.jsx';
import { empIdFromParam, empParam, maskNo, leaveTaken, hrMissing } from './data.js';

// profile tabs for documents; Labour Card added by Changes Report 01 (item 2)
const TAB_DOC = { Passport: 'Passport', Visa: 'Employment Visa', 'Emirates ID': 'Emirates ID', 'Labour Card': 'Labour Card', Insurance: 'Health Insurance' };
const age = (dob) => Math.floor((TODAY - new Date(dob + 'T00:00:00')) / (365.25 * 864e5));
const service = (j) => { const m = Math.floor((TODAY - new Date(j + 'T00:00:00')) / (30.44 * 864e5)); return `${Math.floor(m / 12)} yrs ${m % 12} mths`; };

export default function EmployeeProfile({ param }) {
  const { state } = useStore();
  const u = state.user;
  const emp = scopeEmployees(u, state.employees).find((e) => e.id === empIdFromParam(param));
  const [tab, setTab] = useState('Personal');
  const [viewing, setViewing] = useState(null);
  const [upload, setUpload] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [applying, setApplying] = useState(false);
  const [printingLeave, setPrintingLeave] = useState(null);
  if (!emp) return <div className="page"><Empty title="Employee not found or outside your access">Check the employee number, or go back to <a href="#hr-employees">Employees</a>.</Empty></div>;

  const limited = ROLES[u.role].noDocs;
  const docs = emp.docs.filter((d) => canSeeDoc(u, d.type));
  const missing = hrMissing(emp).filter((m) => canSeeDoc(u, m.type));
  const tabs = ['Personal', 'Employment', ...Object.keys(TAB_DOC).filter((k) => canSeeDoc(u, TAB_DOC[k])), ...(limited ? [] : ['Documents']), 'Leave'];
  const leaves = state.leaves.filter((l) => l.empId === emp.id).sort((a, b) => (a.start < b.start ? 1 : -1));
  const current = leaves.find((l) => ['On Leave', 'Awaiting Rejoining'].includes(l.status));
  const alerts = docs.filter((d) => ['expired', 'critical', 'due'].includes(docStatus(d).key));
  const canEdit = can(u, 'editEmployee');
  const sponsorCo = state.config.companies.find((c) => c.name === emp.sponsor);

  const DocPanel = ({ type }) => {
    const d = emp.docs.find((x) => x.type === type);
    const up = can(u, 'uploadDoc', { type });
    if (!d) return (
      <div className="doc-panel doc-none"><div className="doc-panel-main">
        <div className="doc-title-row"><h3>{type}</h3><span className="pill pill-missing">Not recorded</span></div>
        <p className="muted">No {type.toLowerCase()} is recorded for this employee.</p>
        {up && <div className="btn-row"><button className="btn btn-primary" onClick={() => setUpload({ type, mode: 'upload' })}><Icon n="plus" size={16} /> Record {type.toLowerCase()}</button></div>}
      </div></div>
    );
    const s = docStatus(d);
    const o = officerFor(type);
    return (
      <div className="doc-block">
        <div className="doc-panel">
          <div className="doc-panel-main">
            <div className="doc-title-row"><h3>{type}</h3><StatusPill doc={d} /></div>
            <dl className="kv-grid">
              <KV k={type === 'Health Insurance' ? 'Policy / member no.' : type === 'Labour Card' ? 'Labour card number' : 'Document number'} v={maskNo(d.ref, type)} mono />
              <KV k={type === 'Health Insurance' ? 'Provider' : 'Issued by'} v={d.issuer} />
              <KV k="Issue date" v={fmt(d.issued)} />
              <KV k="Expiry date" v={fmt(d.expiry)} />
              <KV k="Days remaining" v={s.d != null ? (s.d < 0 ? `Expired ${-s.d} days ago` : `${s.d} days`) : '—'} />
              {type === 'Employment Visa' && <KV k="Visa issued by" v={emp.sponsor} />}
              {type === 'Health Insurance' && <KV k="Plan" v={emp.insurancePlan} />}
              <KV k="Warning thresholds" v={`Urgent ≤ ${docCfg(type).urgent}d · due ≤ ${docCfg(type).due}d`} />
            </dl>
            <div className={'renewal-box' + (d.renewal ? ' on' : '')}>
              <Icon n="history" size={18} />
              <div>{d.renewal ? <><strong>Renewal action: {d.renewal.status}</strong><small>{d.renewal.note} · {d.renewal.by}, {fmt(d.renewal.date)}</small></> : <><strong>Renewal action: {actionStatus(d) === 'Open' ? 'Open' : 'none needed yet'}</strong><small>{actionStatus(d) === 'Open' ? 'Record progress when the renewal starts.' : 'An action opens automatically when the document enters its warning window.'}</small></>}</div>
              {up && <button className="btn btn-sm" onClick={() => setTracking(d)}>Update action</button>}
            </div>
            {up && <div className="btn-row">
              <button className="btn btn-primary" onClick={() => setUpload({ type, mode: 'renew' })}><Icon n="check" size={16} /> Renew · record new document</button>
              <button className="btn" onClick={() => setUpload({ type, mode: 'upload' })}><Icon n="upload" size={16} /> {d.file ? 'Replace scan' : 'Upload scan'}</button>
            </div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button className={'doc-thumb' + (d.file ? '' : ' none')} onClick={() => (d.file ? setViewing(d) : up && setUpload({ type, mode: 'upload' }))}>
              {d.file ? <><Icon n="docs" size={32} /><span>{d.file.name}</span><small>{d.file.size} · Click to view</small></> : <><Icon n="upload" size={28} /><span>No scanned copy</span><small>{up ? 'Click to upload' : 'Not uploaded yet'}</small></>}
            </button>
            {type === 'Passport' && (() => {
               const p2 = emp.docs.find((x) => x.type === 'Passport Page 2') || { type: 'Passport Page 2' };
               const p3 = emp.docs.find((x) => x.type === 'Passport Page 3') || { type: 'Passport Page 3' };
               return (
                 <>
                   <button className={'doc-thumb' + (p2.file ? '' : ' none')} onClick={() => (p2.file ? setViewing(p2) : up && setUpload({ type: 'Passport Page 2', mode: 'upload' }))}>
                     {p2.file ? <><Icon n="docs" size={32} /><span>{p2.file.name}</span><small>{p2.file.size} · Click to view</small></> : <><Icon n="upload" size={28} /><span>Passport Page 2</span><small>{up ? 'Click to upload' : 'Not uploaded yet'}</small></>}
                   </button>
                   <button className={'doc-thumb' + (p3.file ? '' : ' none')} onClick={() => (p3.file ? setViewing(p3) : up && setUpload({ type: 'Passport Page 3', mode: 'upload' }))}>
                     {p3.file ? <><Icon n="docs" size={32} /><span>{p3.file.name}</span><small>{p3.file.size} · Click to view</small></> : <><Icon n="upload" size={28} /><span>Passport Page 3</span><small>{up ? 'Click to upload' : 'Not uploaded yet'}</small></>}
                   </button>
                 </>
               );
            })()}
            {type === 'Emirates ID' && (() => {
               const p2 = emp.docs.find((x) => x.type === 'Emirates ID Back') || { type: 'Emirates ID Back' };
               return (
                 <>
                   <button className={'doc-thumb' + (p2.file ? '' : ' none')} onClick={() => (p2.file ? setViewing(p2) : up && setUpload({ type: 'Emirates ID Back', mode: 'upload' }))}>
                     {p2.file ? <><Icon n="docs" size={32} /><span>{p2.file.name}</span><small>{p2.file.size} · Click to view</small></> : <><Icon n="upload" size={28} /><span>Emirates ID Back</span><small>{up ? 'Click to upload' : 'Not uploaded yet'}</small></>}
                   </button>
                 </>
               );
            })()}
          </div>
        </div>
        {d.history?.length > 0 && (
          <div className="table-wrap hist">
            <table className="table compact">
              <thead><tr><th colSpan={5}>Previous versions (retained)</th></tr><tr><th>Number</th><th>Issued</th><th>Expired</th><th>File</th><th>Replaced</th></tr></thead>
              <tbody>{d.history.map((h, i) => <tr key={i}><td className="mono">{maskNo(h.ref, type)}</td><td className="mono">{fmt(h.issued)}</td><td className="mono">{fmt(h.expiry)}</td><td className="small mono">{h.file}</td><td className="small">{fmt(h.replacedOn)}{h.completedBy ? ` · ${h.completedBy}` : ''}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page">
      <button className="back" onClick={() => go('hr-employees')}><Icon n="back" size={16} /> Employees</button>

      <section className="profile-head">
        <PhotoBox module="hr" owner={emp} canEdit={canEdit} />
        <div className="profile-id">
          <span className="mono emp-no">{emp.id}{emp.code ? ` · ${emp.code}` : ''}</span>
          <h1>{emp.name}</h1>
          <p>{emp.designation} · {emp.department} · {emp.location}</p>
          <div className="chips">
            <span className={'pill ' + (emp.status === 'Active' ? 'pill-valid' : 'pill-due')}>{emp.status}</span>
            {current && <LeavePill status={current.status} />}
            <span className="tag">{emp.sponsor === OPERATING ? 'Adroit visa' : 'Group company visa'}</span>
            <span className="tag">{emp.nationality}</span>
          </div>
        </div>
        <div className="profile-actions">
          {canEdit && <button className="btn" onClick={() => go('hr-edit', empParam(emp.id))}><Icon n="edit" size={16} /> Edit</button>}
          {can(u, 'submitLeave') && <button className="btn" onClick={() => setApplying(true)}><Icon n="leave" size={16} /> Apply leave</button>}
          {docTypes('hr').some((t) => can(u, 'uploadDoc', { type: t.key })) && <button className="btn btn-primary" onClick={() => setUpload({ type: null, mode: 'upload' })}><Icon n="upload" size={16} /> Upload document</button>}
        </div>
      </section>

      {(alerts.length > 0 || missing.length > 0) && (
        <div className="alert-strip" role="note">
          <Icon n="bell" />
          <span>{[...alerts.map((d) => `${d.type} ${docStatus(d).d < 0 ? 'expired' : 'expires'} ${fmt(d.expiry)}`), ...missing.map((m) => `${m.type} ${m.recorded ? 'scan missing' : 'not recorded'}`)].join(' · ')}</span>
          <button className="link" onClick={() => setTab('Documents')}>Review</button>
        </div>
      )}

      <Tabs tabs={tabs.map((t) => ({ key: t, label: t, count: TAB_DOC[t] && ['expired', 'critical', 'due'].includes(docStatus(emp.docs.find((d) => d.type === TAB_DOC[t])).key) ? 1 : null }))} value={tab} onChange={setTab} />

      <section className="panel tab-panel">
        {tab === 'Personal' && (limited ? (
          <dl className="kv-grid"><KV k="Full name" v={emp.name} /><KV k="Mobile No" v={emp.mobile.replace(/^\+971\s*/, '0')} mono /><KV k="Nationality" v={emp.nationality} /><p className="muted small span-all">Other personal details are visible to HR only.</p></dl>
        ) : (
          <dl className="kv-grid">
            <KV k="Full name" v={emp.name} /><KV k="Gender" v={emp.gender} /><KV k="Nationality" v={emp.nationality} />
            <KV k="Date of birth" v={`${fmt(emp.dob)} · ${age(emp.dob)} yrs`} /><KV k="Mobile No" v={emp.mobile.replace(/^\+971\s*/, '0')} mono /><KV k="Email" v={emp.email} />
            <KV k="Emergency contact (with country code)" v={emp.emergencyContact} mono /><KV k="Home address" v={emp.homeAddress} /><KV k="Notes" v={emp.notes} />
          </dl>
        ))}
        {tab === 'Employment' && (
          <div className="stack">
            <dl className="kv-grid">
              <KV k="Employee number" v={emp.id} mono /><KV k="Employee code" v={emp.code} mono />{!limited && <KV k="Emp (MOL) ID" v={emp.molId} mono />}
              <KV k="Employment status" v={emp.status} /><KV k="Designation" v={emp.designation} />
              <KV k="Operational company" v={emp.company} /><KV k="Visa sponsoring company" v={emp.sponsor} /><KV k="Department" v={emp.department} />
              <KV k="Joining date" v={`${fmt(emp.joined)} · ${service(emp.joined)}`} />
              {!limited && <><KV k="Insurance plan" v={emp.insurancePlan} /><KV k="Insurance provider" v={emp.insuranceProvider} /></>}
            </dl>
            <p className="meta small muted"><Icon n="history" size={13} /> Created {fmt(emp.created.at)} by {emp.created.by} · last updated {fmt(emp.updated.at)} by {emp.updated.by}</p>
          </div>
        )}
        {tab === 'Labour Card' && (
          <dl className="kv-grid mol-strip">
            <KV k="Emp (MOL) ID" v={emp.molId || 'Not recorded'} mono />
            <KV k="Company MOL code (sponsor)" v={sponsorCo?.molCode || 'Not recorded'} mono />
            <KV k="Sponsoring company" v={emp.sponsor} />
            {canEdit && !emp.molId && <p className="muted small span-all">Record the Emp (MOL) ID with <button className="link" onClick={() => go('hr-edit', empParam(emp.id))}>Edit</button> or in the <a href="#hr-mol">MOL register</a>.</p>}
          </dl>
        )}
        {tab === 'Passport' && <DocPanel type="Passport" />}
        {TAB_DOC[tab] && tab !== 'Passport' && <DocPanel type={TAB_DOC[tab]} />}
        {tab === 'Documents' && (
          <div className="stack">
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Document</th><th>Number</th><th>Expiry</th><th>Status</th><th>Action</th><th className="right">Digital copy</th></tr></thead>
                <tbody>
                  {docs.map((d) => (
                    <tr key={d.type}>
                      <td><strong>{d.type}</strong>{d.history?.length > 0 && <small className="block muted">{d.history.length} previous version{d.history.length > 1 ? 's' : ''}</small>}</td>
                      <td className="mono">{maskNo(d.ref, d.type)}</td>
                      <td className="mono nowrap">{fmt(d.expiry)}</td>
                      <td><StatusPill doc={d} /></td>
                      <td><ActionPill status={actionStatus(d)} /></td>
                      <td className="right">{d.file ? <button className="btn btn-sm" onClick={() => setViewing(d)}><Icon n="eye" size={14} /> View</button> : can(u, 'uploadDoc', { type: d.type }) ? <button className="btn btn-sm btn-ghost" onClick={() => setUpload({ type: d.type, mode: 'upload' })}><Icon n="upload" size={14} /> Upload</button> : <span className="muted small">No scan</span>}</td>
                    </tr>
                  ))}
                  {missing.filter((m) => !m.recorded).map((m) => <tr key={m.type}><td><strong>{m.type}</strong></td><td className="muted">—</td><td className="muted">—</td><td><span className="pill pill-missing">Not recorded</span></td><td><ActionPill status="Open" /></td><td className="right">{can(u, 'uploadDoc', { type: m.type }) && <button className="btn btn-sm btn-primary" onClick={() => setUpload({ type: m.type, mode: 'upload' })}><Icon n="plus" size={14} /> Record</button>}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'Leave' && (
          <div className="stack">
            <div className="mini-kpis">
              <div><span className="kpi-label">Total annual leave taken</span><strong>{leaveTaken(state.leaves, emp)} days</strong></div>
              <div><span className="kpi-label">Current status</span><strong>{current ? current.status : 'On duty'}</strong></div>
              <div><span className="kpi-label">Last vacation</span><strong>{fmt(leaves.find((l) => l.type === 'Annual Leave' && l.status === 'Completed')?.start)}</strong></div>
              {can(u, 'submitLeave') && <button className="btn btn-primary" onClick={() => setApplying(true)}><Icon n="plus" size={16} /> Apply leave</button>}
            </div>
            <p className="muted small">Entitlement and balance rules are not assumed in Phase 1; they need management confirmation (§7, §19).</p>
            {leaves.length === 0 ? <Empty title="No leave recorded yet" /> : (
              <div className="table-wrap"><table className="table">
                <thead><tr><th>Ref.</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th>Rejoined</th><th>Action</th></tr></thead>
                <tbody>{leaves.map((l) => <tr key={l.id}><td className="mono small">{l.id}</td><td>{l.type}</td><td className="mono">{fmt(l.start)}</td><td className="mono">{fmt(l.end)}</td><td>{l.days}</td><td><LeavePill status={l.status} /></td><td className="mono">{fmt(l.rejoined)}</td><td><button className="btn btn-sm btn-ghost" onClick={() => setPrintingLeave(l)}><Icon n="download" size={14} /> Print</button></td></tr>)}</tbody>
              </table></div>
            )}
          </div>
        )}
      </section>

      {viewing && <DocViewer owner={emp} module="hr" doc={viewing} onClose={() => setViewing(null)} />}
      {upload && <UploadDocModal module="hr" owner={emp} docType={upload.type} mode={upload.mode} onClose={() => setUpload(null)} />}
      {tracking && <RenewalActionModal module="hr" owner={emp} doc={tracking} onClose={() => setTracking(null)} />}
      {applying && <ApplyLeaveModal emp={emp} onClose={() => setApplying(false)} />}
      {printingLeave && <LeavePrintModal leave={printingLeave} emp={emp} close={() => setPrintingLeave(null)} />}
    </div>
  );
}
