import React, { useState } from 'react';
import { useStore, go } from '../core/store.jsx';
import { OPERATING, docTypes } from '../core/shared.js';
import { can } from '../core/access.js';
import { Field, Icon, Empty } from '../core/ui.jsx';
import { empIdFromParam, empParam, HR_STATUSES } from './data.js';

const NATS = ['Indian', 'Pakistani', 'Sri Lankan', 'Filipino', 'Bangladeshi', 'Nepali', 'Egyptian', 'Jordanian', 'Emirati', 'Other'];
const EXP_TYPES = ['Passport', 'Employment Visa', 'Emirates ID', 'Health Insurance'];

export default function EmployeeForm({ param }) {
  const { state, act, notify } = useStore();
  const [busy, setBusy] = useState(false);
  const cfg = state.config;
  const editing = param ? state.employees.find((e) => e.id === empIdFromParam(param)) : null;
  const nextNo = 'New employee';
  const [f, setF] = useState(() => editing ? { ...editing } : {
    id: nextNo, name: '', gender: 'Male', nationality: 'Indian', dob: '', department: cfg.departments[0].name, location: 'Head Office', designation: '',
    mobile: '+971 ', email: '', status: 'Active', joined: '', company: OPERATING, sponsor: OPERATING, insurancePlan: 'Group Health Insurance', insuranceProvider: '',
    emergencyContact: '', homeAddress: '', notes: '', photo: null, deptHead: '',
    docs: EXP_TYPES.map((type) => ({ type, name: type, ref: '', issuer: '', issued: '', expiry: '', file: null, renewal: null, history: [] })),
  });
  const [err, setErr] = useState('');
  if (!can(state.user, 'editEmployee')) return <div className="page"><Empty title="Only HR can add or edit employees" /></div>;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const doc = (t) => f.docs.find((d) => d.type === t) || { ref: '', issued: '', expiry: '' };
  const setDoc = (t, k) => (e) => {
    const exists = f.docs.some((d) => d.type === t);
    setF({ ...f, docs: exists ? f.docs.map((d) => (d.type === t ? { ...d, [k]: e.target.value } : d)) : [...f.docs, { type: t, name: t, ref: '', issuer: '', issued: '', expiry: '', file: null, renewal: null, history: [], [k]: e.target.value }] });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!f.name.trim() || !f.designation.trim() || !f.joined) { setErr('Full name, designation and joining date are required.'); return; }
    if (!editing && state.employees.some((x) => x.name.toLowerCase() === f.name.trim().toLowerCase() && x.dob === f.dob && f.dob)) { setErr('An employee with the same name and date of birth already exists.'); return; }
    const head = state.employees.find((x) => x.department === f.department)?.deptHead || '';
    const docs = f.docs.filter((d) => d.ref || d.expiry || d.file).map((d) => (d.type === 'Health Insurance' && !d.issuer ? { ...d, issuer: f.insuranceProvider } : d));
    const emp = { ...f, name: f.name.trim(), deptHead: f.deptHead || head, docs };
    setBusy(true); setErr('');
    try {
      const saved = await act.saveEmployee(emp, editing?.id);
      notify(editing ? 'Employee record updated' : `${saved.name} added as ${saved.id}. Upload the scanned documents next.`);
      go('hr-employee', empParam(saved.id));
    } catch (x) { setErr(x.message); setBusy(false); }
  };

  return (
    <div className="page narrow">
      <button className="back" onClick={() => (editing ? go('hr-employee', param) : go('hr-employees'))}><Icon n="back" size={16} /> {editing ? editing.name : 'Employees'}</button>
      <div className="page-head"><div><span className="eyebrow mono">{editing ? f.id : 'Employee number is assigned on save'}</span><h1>{editing ? 'Edit employee' : 'Add new employee'}</h1><p className="muted">Scanned copies and the photo are uploaded from the employee profile after saving.</p></div></div>
      <form className="stack" onSubmit={save}>
        <fieldset className="panel">
          <legend>Identity &amp; contact</legend>
          <div className="form-grid cols-3">
            <Field label="Full name (as in passport)" span={2}><input id="ef-name" value={f.name} onChange={set('name')} required /></Field>
            <Field label="Gender"><select id="ef-gender" value={f.gender} onChange={set('gender')}><option>Male</option><option>Female</option></select></Field>
            <Field label="Nationality"><select id="ef-nat" value={f.nationality} onChange={set('nationality')}>{NATS.map((n) => <option key={n}>{n}</option>)}</select></Field>
            <Field label="Date of birth"><input id="ef-dob" type="date" value={f.dob} onChange={set('dob')} /></Field>
            <Field label="Mobile (UAE)"><input id="ef-mobile" value={f.mobile} onChange={set('mobile')} /></Field>
            <Field label="Email"><input id="ef-email" type="email" value={f.email} onChange={set('email')} /></Field>
            <Field label="Emergency contact (home country)"><input id="ef-emerg" value={f.emergencyContact} onChange={set('emergencyContact')} /></Field>
            <Field label="Home address"><input id="ef-addr" value={f.homeAddress} onChange={set('homeAddress')} /></Field>
          </div>
        </fieldset>
        <fieldset className="panel">
          <legend>Employment, company &amp; sponsorship</legend>
          <div className="form-grid cols-3">
            <Field label="Designation"><input id="ef-desig" value={f.designation} onChange={set('designation')} required /></Field>
            <Field label="Joining date"><input id="ef-joined" type="date" value={f.joined} onChange={set('joined')} required /></Field>
            <Field label="Employment status"><select id="ef-status" value={f.status} onChange={set('status')}>{HR_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Department"><select id="ef-dept" value={f.department} onChange={set('department')}>{cfg.departments.filter((d) => d.active || d.name === f.department).map((d) => <option key={d.id}>{d.name}</option>)}</select></Field>
            <Field label="Branch / location"><select id="ef-loc" value={f.location} onChange={set('location')}>{cfg.locations.filter((d) => d.active || d.name === f.location).map((d) => <option key={d.id}>{d.name}</option>)}</select></Field>
            <Field label="Operational company"><select id="ef-co" value={f.company} onChange={set('company')}>{cfg.companies.filter((c) => c.active).map((c) => <option key={c.id} value={c.name}>{c.short}</option>)}</select></Field>
            <Field label="Visa sponsoring company" span={2} hint="Visa may be under Adroit or another group company."><select id="ef-sponsor" value={f.sponsor} onChange={set('sponsor')}>{cfg.companies.filter((c) => c.active).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select></Field>
            <Field label="Notes"><input id="ef-notes" value={f.notes} onChange={set('notes')} /></Field>
          </div>
        </fieldset>
        <fieldset className="panel">
          <legend>Insurance</legend>
          <div className="form-grid cols-3">
            <Field label="Plan"><select id="ef-plan" value={f.insurancePlan} onChange={set('insurancePlan')}><option>Group Health Insurance</option><option>Group Health Insurance – Enhanced</option></select></Field>
            <Field label="Provider"><input id="ef-prov" value={f.insuranceProvider} onChange={set('insuranceProvider')} placeholder="e.g. Daman" /></Field>
            <Field label="Policy / member no."><input id="ef-no-HealthInsurance" value={doc('Health Insurance').ref} onChange={setDoc('Health Insurance', 'ref')} /></Field>
          </div>
        </fieldset>
        <fieldset className="panel">
          <legend>Identity &amp; compliance documents</legend>
          <div className="doc-form-rows">
            {EXP_TYPES.filter((t) => t !== 'Health Insurance').concat('Health Insurance').map((t) => (
              <div className="doc-form-row" key={t}>
                <strong>{t}</strong>
                {t !== 'Health Insurance' ? <Field label="Number"><input id={'ef-no-' + t.replace(/ /g, '')} value={doc(t).ref} onChange={setDoc(t, 'ref')} /></Field> : <span className="muted small">policy no. above</span>}
                <Field label="Issue date"><input id={'ef-is-' + t.replace(/ /g, '')} type="date" value={doc(t).issued} onChange={setDoc(t, 'issued')} /></Field>
                <Field label="Expiry date"><input id={'ef-ex-' + t.replace(/ /g, '')} type="date" value={doc(t).expiry} onChange={setDoc(t, 'expiry')} /></Field>
              </div>
            ))}
          </div>
          <p className="field-hint">Other document types ({docTypes('hr').filter((t) => !EXP_TYPES.includes(t.key)).map((t) => t.key).join(', ')}) are added from the profile.</p>
        </fieldset>
        {err && <p className="error" role="alert">{err}</p>}
        <div className="btn-row end">
          <button type="button" className="btn" onClick={() => history.back()}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create employee'}</button>
        </div>
      </form>
    </div>
  );
}
