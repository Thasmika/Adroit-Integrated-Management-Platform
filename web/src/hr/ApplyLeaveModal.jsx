import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../core/store.jsx';
import { Modal, Field, DateInput, Icon } from '../core/ui.jsx';
import { iso, TODAY } from '../core/shared.js';
import { scopeEmployees } from '../core/access.js';
import { LEAVE_TYPES, leaveTaken } from './data.js';
import LeavePrintModal from './LeavePrintModal.jsx';

export default function ApplyLeaveModal({ emp: fixedEmp, onClose }) {
  const { state, act, notify } = useStore();
  const [busy, setBusy] = useState(false);
  const u = state.user;
  const pool = useMemo(() => scopeEmployees(u, state.employees).filter((e) => e.status === 'Active' || e.status === 'On Notice'), [state.employees, u]);
  const depts = [...new Set(pool.map((e) => e.department))];
  const [dept, setDept] = useState(fixedEmp?.department || depts[0]);
  const deptEmps = pool.filter((e) => e.department === dept);
  const [empId, setEmpId] = useState(fixedEmp?.id || deptEmps[0]?.id);
  const emp = state.employees.find((e) => e.id === empId);
  const [type, setType] = useState(LEAVE_TYPES[0]);
  const [start, setStart] = useState(iso(new Date(TODAY.getTime() + 14 * 864e5)));
  const [end, setEnd] = useState(iso(new Date(TODAY.getTime() + 43 * 864e5)));
  const [reason, setReason] = useState('');
  const [contact, setContact] = useState(emp ? (emp.emergencyContact || emp.mobile || '') : '');
  const [err, setErr] = useState('');
  const [printAfterSubmit, setPrintAfterSubmit] = useState(null); // leave object if user wants to print

  // Item 7: Once select employee, auto-fill home number / emergency contact
  useEffect(() => {
    if (emp) {
      const homeNumber = emp.emergencyContact || emp.mobile || '';
      setContact(homeNumber);
    }
  }, [empId]);

  const days = start && end ? Math.round((new Date(end) - new Date(start)) / 864e5) + 1 : 0;
  const overlap = emp && state.leaves.some((l) => l.empId === emp.id && !['Rejected', 'Completed'].includes(l.status) && !(l.end < start || l.start > end));

  const submit = async (e) => {
    e.preventDefault();
    if (!emp) { setErr('Select the employee.'); return; }
    if (!start || !end) { setErr('Enter the first and last day of leave.'); return; }
    if (days < 1) { setErr('The last day must be on or after the first day.'); return; }
    if (!reason.trim()) { setErr('Enter the reason or remarks.'); return; }
    if (overlap) { setErr('This employee already has leave recorded in these dates.'); return; }
    setBusy(true);
    try {
      const l = await act.submitLeave({ empId: emp.id, type, start, end, reason, contactAbroad: contact });
      notify(`Leave request ${l.id} submitted for ${emp.name}. HR will review it.`);
      setPrintAfterSubmit(l);
    } catch (x) { setErr(x.message); setBusy(false); }
  };

  if (printAfterSubmit) {
    return <LeavePrintModal leave={printAfterSubmit} emp={emp} close={() => { setPrintAfterSubmit(null); onClose(); }} />;
  }

  return (
    <Modal title="New leave request" onClose={onClose}
      footer={<><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="leave-form" type="submit" disabled={busy}><Icon n="check" size={16} /> {busy ? 'Submitting…' : 'Submit request'}</button></>}>
      <form id="leave-form" className="form-grid" onSubmit={submit}>
        {!fixedEmp && (
          <>
            <Field label="Department / branch">
              <select id="lv-dept" value={dept} disabled={depts.length === 1} onChange={(e) => { const newDept = e.target.value; setDept(newDept); const first = pool.find((x) => x.department === newDept); setEmpId(first?.id); }}>
                {depts.map((d) => <option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Employee">
              <select id="lv-emp" value={empId} onChange={(e) => setEmpId(e.target.value)}>
                {deptEmps.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.name}</option>)}
              </select>
            </Field>
          </>
        )}
        <Field label="Leave type" span={2}>
          <div className="seg">
            {LEAVE_TYPES.map((t) => <button type="button" key={t} className={type === t ? 'on' : ''} onClick={() => setType(t)}>{t}</button>)}
          </div>
        </Field>
        <Field label="From"><DateInput id="lv-start" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="To (last day of leave)"><DateInput id="lv-end" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        <div className="calc span-2">
          <span><strong>{Math.max(0, days)}</strong> calendar days</span>
          {emp && type === 'Annual Leave' && <span>Annual leave already taken in {TODAY.getFullYear()}: <strong>{leaveTaken(state.leaves, emp)}</strong> days</span>}
          {type === 'Sick Leave' && <span>Attach the medical certificate after submission</span>}
        </div>
        <Field label="Reason / remarks" span={2}>
          <textarea id="lv-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Annual vacation to home country" />
        </Field>
        <Field label="Contact while on leave / Home number" hint="Auto-filled from employee profile; update if using a different overseas number" span={2}>
          <input id="lv-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Home number / phone abroad" />
        </Field>
        {err && <p className="error span-2" role="alert">{err}</p>}
        <p className="field-hint span-2">
          Route: Department Head / HR submits → HR review → Management approval → vacation → rejoining recorded.
          {emp?.sponsor && <> (Visa Sponsor: <strong>{emp.sponsor}</strong>)</>}
        </p>
      </form>
    </Modal>
  );
}
