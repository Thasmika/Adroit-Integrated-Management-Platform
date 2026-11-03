import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../core/store.jsx';
import { fmt, iso, TODAY } from '../core/shared.js';
import { Icon, DateInput } from '../core/ui.jsx';
import { DEPARTMENTS } from './data.js';

export default function RejectedReportModal({ onClose }) {
  const { state } = useStore();

  useEffect(() => {
    document.body.classList.add('has-print-modal');
    return () => document.body.classList.remove('has-print-modal');
  }, []);
  const emps = state.employees;
  const empMap = useMemo(() => new Map(emps.map((e) => [e.id, e])), [emps]);

  const defaultFrom = iso(new Date(TODAY.getFullYear(), 0, 1));
  const defaultTo = iso(TODAY);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [dept, setDept] = useState('');
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    return state.leaves
      .filter((l) => {
        if (l.status !== 'Rejected') return false;
        const refDate = l.requestedOn || l.start;
        if (from && refDate < from) return false;
        if (to && refDate > to) return false;
        const e = empMap.get(l.empId);
        if (dept && e?.department !== dept) return false;
        if (search) {
          const q = search.toLowerCase();
          const matchName = e?.name?.toLowerCase().includes(q);
          const matchId = e?.id?.toLowerCase().includes(q);
          const matchCode = e?.code?.toLowerCase().includes(q);
          const matchRef = l.id?.toLowerCase().includes(q);
          const matchReason = l.rejectReason?.toLowerCase().includes(q);
          const matchDecider = l.decidedBy?.toLowerCase().includes(q);
          if (!matchName && !matchId && !matchCode && !matchRef && !matchReason && !matchDecider) return false;
        }
        return true;
      })
      .map((l) => {
        const e = empMap.get(l.empId) || { id: l.empId, name: 'Unknown', department: '—', sponsor: '—' };
        return { leave: l, emp: e };
      })
      .sort((a, b) => (b.leave.requestedOn > a.leave.requestedOn ? 1 : -1));
  }, [state.leaves, empMap, from, to, dept, search]);

  const totalDays = rows.reduce((s, r) => s + (r.leave.days || 0), 0);

  return createPortal(
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '980px', width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Screen Controls Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }} className="no-print">
          <div>
            <h2 style={{ margin: 0 }}>Rejected Leaves Report (PDF)</h2>
            <p className="muted small" style={{ margin: '2px 0 0 0' }}>Formal register of rejected leave applications, deciders, and reasons</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" onClick={() => window.print()} disabled={rows.length === 0}>
              <Icon n="download" size={16} /> Print / Export PDF
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="panel pad no-print" style={{ marginBottom: '16px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 140px' }}>
              <label htmlFor="rej-from" className="muted small block" style={{ marginBottom: '4px', fontWeight: 'bold' }}>From Date</label>
              <DateInput id="rej-from" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label htmlFor="rej-to" className="muted small block" style={{ marginBottom: '4px', fontWeight: 'bold' }}>To Date</label>
              <DateInput id="rej-to" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label htmlFor="rej-dept" className="muted small block" style={{ marginBottom: '4px', fontWeight: 'bold' }}>Department</label>
              <select id="rej-dept" value={dept} onChange={(e) => setDept(e.target.value)} style={{ width: '100%', height: '38px' }}>
                <option value="">All Departments</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ flex: '2 1 220px' }}>
              <label htmlFor="rej-search" className="muted small block" style={{ marginBottom: '4px', fontWeight: 'bold' }}>Search</label>
              <input id="rej-search" type="search" placeholder="Search by name, ID, ref or reason..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', height: '38px' }} />
            </div>
          </div>
        </div>

        {/* Printable Area */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div className="print-area" style={{ background: '#fff', color: '#000', padding: '30px', border: '1px solid #ddd', borderRadius: '6px', fontFamily: '"Times New Roman", Times, serif' }}>
            
            {/* Header */}
            <div style={{ borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '18px', textAlign: 'center' }}>
              <h1 style={{ margin: '0 0 4px 0', fontSize: '22px', textTransform: 'uppercase', letterSpacing: '.02em' }}>
                Adroit Building Material Trading Enterprises
              </h1>
              <p style={{ margin: '2px 0', fontSize: '13px', color: '#444' }}>
                Human Resources Department · Leave Administration &amp; Approvals
              </p>
              <h2 style={{ margin: '10px 0 2px 0', fontSize: '17px', textTransform: 'uppercase', letterSpacing: '.04em', textDecoration: 'underline' }}>
                Rejected Leave Applications Report
              </h2>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold' }}>
                Period: {fmt(from)} to {fmt(to)} {dept ? `· Department: ${dept}` : '· All Departments'}
              </p>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f5f5f5', border: '1px solid #ccc', padding: '10px 18px', borderRadius: '4px', marginBottom: '16px', fontSize: '13px' }}>
              <div><strong>Rejected Requests:</strong> {rows.length}</div>
              <div><strong>Total Days Requested:</strong> {totalDays} days</div>
              <div><strong>Generated Date:</strong> {fmt(iso(TODAY))}</div>
            </div>

            {/* Table */}
            {rows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#666' }}>
                <p>No rejected leave applications found for the selected period.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '10px' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0', borderBottom: '2px solid #000' }}>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', width: '30px' }}>#</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center' }}>Ref</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left' }}>Employee Name</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center' }}>Emp No</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left' }}>Department</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left' }}>Leave Type</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center' }}>Requested Dates</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center' }}>Days</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left' }}>Requested By</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left', fontWeight: 'bold' }}>Decided By &amp; Date</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left', background: '#fee2e2' }}>Reason for Rejection</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.leave.id} style={{ borderBottom: '1px solid #ccc', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontFamily: 'monospace' }}>{r.leave.id}</td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', fontWeight: 'bold' }}>{r.emp.name}</td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontFamily: 'monospace' }}>{r.emp.id}</td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px' }}>{r.emp.department.replace(' Department', '')}</td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px' }}>{r.leave.type}</td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: '11px' }}>
                        {fmt(r.leave.start)} → {fmt(r.leave.end)}
                      </td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center' }}>{r.leave.days}</td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', fontSize: '11px' }}>
                        {r.leave.requestedBy}
                        <small style={{ display: 'block', color: '#666' }}>{fmt(r.leave.requestedOn)}</small>
                      </td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', fontSize: '11px' }}>
                        <strong>{r.leave.decidedBy || 'Management'}</strong>
                        <small style={{ display: 'block', color: '#555' }}>
                          {fmt(r.leave.decidedAt || r.leave.trail?.find((t) => t.what?.includes('Rejected'))?.at?.slice(0, 10) || r.leave.requestedOn)}
                        </small>
                      </td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', color: '#991b1b', fontSize: '11px', background: '#fff5f5' }}>
                        {r.leave.rejectReason || r.leave.hrNote || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Signatures */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', paddingTop: '20px' }}>
              <div style={{ textAlign: 'center', width: '220px' }}>
                <div style={{ borderTop: '1px solid #000', paddingTop: '6px' }}>
                  <strong>Prepared By</strong>
                  <div style={{ fontSize: '11.5px', color: '#555' }}>HR Officer</div>
                </div>
              </div>
              <div style={{ textAlign: 'center', width: '220px' }}>
                <div style={{ borderTop: '1px solid #000', paddingTop: '6px' }}>
                  <strong>Verified By</strong>
                  <div style={{ fontSize: '11.5px', color: '#555' }}>Head of Department</div>
                </div>
              </div>
              <div style={{ textAlign: 'center', width: '220px' }}>
                <div style={{ borderTop: '1px solid #000', paddingTop: '6px' }}>
                  <strong>Approved By</strong>
                  <div style={{ fontSize: '11.5px', color: '#555' }}>Managing Director</div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
