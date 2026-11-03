import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../core/store.jsx';
import { Modal, Field, DateInput, Icon, Avatar } from '../core/ui.jsx';
import { fmt, iso, TODAY } from '../core/shared.js';
import { scopeEmployees } from '../core/access.js';

export default function RejoinAddModal({ onClose, onDone }) {
  const { state, act, run } = useStore();
  const u = state.user;
  const scopedEmps = useMemo(() => scopeEmployees(u, state.employees), [u, state.employees]);
  const scopeSet = useMemo(() => new Set(scopedEmps.map((e) => e.id)), [scopedEmps]);

  // Find all employees currently on vacation / awaiting rejoining
  const awayLeaves = useMemo(() => {
    return state.leaves
      .filter((l) => scopeSet.has(l.empId) && ['On Leave', 'Awaiting Rejoining'].includes(l.status))
      .map((l) => {
        const emp = state.employees.find((e) => e.id === l.empId) || { id: l.empId, name: 'Unknown' };
        return { leave: l, emp };
      })
      .sort((a, b) => a.emp.name.localeCompare(b.emp.name)); // Ordered by name alphabetically (A-Z)
  }, [state.leaves, scopeSet, state.employees]);

  const [selectedLeaveId, setSelectedLeaveId] = useState(awayLeaves[0]?.leave?.id || '');
  const [date, setDate] = useState(iso(TODAY));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Auto-fill details when selection changes
  const activePair = useMemo(() => awayLeaves.find((x) => x.leave.id === selectedLeaveId) || awayLeaves[0], [awayLeaves, selectedLeaveId]);
  const activeLeave = activePair?.leave;
  const activeEmp = activePair?.emp;

  useEffect(() => {
    if (!selectedLeaveId && awayLeaves.length > 0) {
      setSelectedLeaveId(awayLeaves[0].leave.id);
    }
  }, [awayLeaves, selectedLeaveId]);

  const expectedBack = useMemo(() => {
    if (!activeLeave?.end) return '';
    const b = new Date(activeLeave.end + 'T00:00:00');
    b.setDate(b.getDate() + 1);
    return iso(b);
  }, [activeLeave?.end]);

  const submit = async (e) => {
    e.preventDefault();
    if (!activeLeave) { setErr('No leave record selected.'); return; }
    if (!date) { setErr('Please specify the date employee reported back.'); return; }
    if (date < activeLeave.start) { setErr('Rejoining date cannot be before the leave start date.'); return; }
    if (date > iso(TODAY)) { setErr('Rejoining date cannot be in the future.'); return; }

    setBusy(true);
    setErr('');
    const ok = await run(
      () => act.leaveAction(activeLeave.id, 'rejoin', { date, note }),
      `Rejoining recorded successfully for ${activeEmp.name} on ${fmt(date)}.`
    );
    setBusy(false);
    if (ok) {
      if (onDone) onDone();
      onClose();
    }
  };

  if (awayLeaves.length === 0) {
    return (
      <Modal title="Add Rejoining" onClose={onClose}
        footer={<button className="btn" onClick={onClose}>Close</button>}>
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p><strong>No employees currently on leave</strong></p>
          <p className="muted small" style={{ marginTop: '6px' }}>All approved leaves have either been rejoined or are not yet started.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`Add Rejoining · (${awayLeaves.length} on vacation · ordered by name)`} onClose={onClose}
      footer={<>
        <button className="btn" type="button" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" form="rejoin-add-form" type="submit" disabled={busy}>
          <Icon n="plus" size={16} /> {busy ? 'Adding rejoining…' : 'Add Rejoining'}
        </button>
      </>}>

      <form id="rejoin-add-form" className="form-grid" onSubmit={submit}>
        
        <Field label={`Select Employee (${awayLeaves.length} on vacation · ordered by name)`} span={2}>
          <select id="rj-emp-select" value={activeLeave?.id || ''} onChange={(e) => setSelectedLeaveId(e.target.value)}>
            {awayLeaves.map(({ leave, emp }) => (
              <option key={leave.id} value={leave.id}>
                {emp.name} — {emp.id} ({emp.department.replace(' Department', '')}) · {leave.type} ({fmt(leave.start)} to {fmt(leave.end)})
              </option>
            ))}
          </select>
        </Field>

        {activeEmp && activeLeave && (
          <div className="panel span-2" style={{ background: 'var(--surface-2)', padding: '14px 18px', border: '1px solid var(--line)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <Avatar name={activeEmp.name} size={40} photo={activeEmp.photo} />
              <div>
                <strong style={{ fontSize: '1.05rem' }}>{activeEmp.name}</strong>
                <span className="mono muted small" style={{ display: 'block' }}>{activeEmp.id} {activeEmp.code ? `· Code: ${activeEmp.code}` : ''} · {activeEmp.designation}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px 16px', fontSize: '13px' }}>
              <div><span className="muted small block">Department</span><strong>{activeEmp.department}</strong></div>
              <div><span className="muted small block">Visa Sponsor</span><strong>{activeEmp.sponsor || activeEmp.company}</strong></div>
              <div><span className="muted small block">Leave Reference</span><strong className="mono">{activeLeave.id}</strong></div>
              <div><span className="muted small block">Leave Type</span><strong>{activeLeave.type}</strong></div>
              <div><span className="muted small block">Period</span><strong>{fmt(activeLeave.start)} → {fmt(activeLeave.end)}</strong></div>
              <div><span className="muted small block">Duration</span><strong>{activeLeave.days} days</strong></div>
              <div><span className="muted small block">Expected Back</span><strong className="mono">{fmt(expectedBack)}</strong></div>
              <div><span className="muted small block">Contact on Leave</span><strong className="mono">{activeLeave.contactAbroad || activeEmp.emergencyContact || activeEmp.mobile || '—'}</strong></div>
            </div>
          </div>
        )}

        <Field label="Actual date reported back for duty" hint="Date employee resumed duties (defaults to today)">
          <DateInput id="rj-date" value={date} max={iso(TODAY)} min={activeLeave?.start} onChange={(e) => setDate(e.target.value)} />
        </Field>

        <Field label="Rejoining remarks / notes" hint="e.g. Reported back on time, handover completed" span={2}>
          <textarea id="rj-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Enter any return-to-duty notes or fitness check remarks" />
        </Field>

        {err && <p className="error span-2" role="alert">{err}</p>}
      </form>
    </Modal>
  );
}
