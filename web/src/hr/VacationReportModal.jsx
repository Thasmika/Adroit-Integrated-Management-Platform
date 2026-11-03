import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../core/store.jsx';
import { fmt, iso, TODAY, daysUntil } from '../core/shared.js';
import { Icon } from '../core/ui.jsx';
import { DEPARTMENTS } from './data.js';

export default function VacationReportModal({ onClose }) {
  const { state } = useStore();

  useEffect(() => {
    document.body.classList.add('has-print-modal');
    return () => document.body.classList.remove('has-print-modal');
  }, []);
  const emps = state.employees;
  const empMap = useMemo(() => new Map(emps.map((e) => [e.id, e])), [emps]);

  const [dept, setDept] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, onLeave, awaiting

  const rows = useMemo(() => {
    return state.leaves
      .filter((l) => {
        if (!['On Leave', 'Awaiting Rejoining'].includes(l.status)) return false;
        if (statusFilter === 'onLeave' && l.status !== 'On Leave') return false;
        if (statusFilter === 'awaiting' && l.status !== 'Awaiting Rejoining') return false;
        const e = empMap.get(l.empId);
        if (dept && e?.department !== dept) return false;
        if (search) {
          const q = search.toLowerCase();
          const matchName = e?.name?.toLowerCase().includes(q);
          const matchId = e?.id?.toLowerCase().includes(q);
          const matchCode = e?.code?.toLowerCase().includes(q);
          const matchRef = l.id?.toLowerCase().includes(q);
          if (!matchName && !matchId && !matchCode && !matchRef) return false;
        }
        return true;
      })
      .map((l) => {
        const e = empMap.get(l.empId) || { id: l.empId, name: 'Unknown', department: '—', sponsor: '—' };
        const back = new Date(l.end + 'T00:00:00');
        back.setDate(back.getDate() + 1);
        const backStr = iso(back);
        const daysLeft = daysUntil(backStr);

        return { leave: l, emp: e, backStr, daysLeft };
      })
      .sort((a, b) => a.emp.name.localeCompare(b.emp.name));
  }, [state.leaves, empMap, dept, search, statusFilter]);

  const onLeaveCount = rows.filter((r) => r.leave.status === 'On Leave').length;
  const awaitingCount = rows.filter((r) => r.leave.status === 'Awaiting Rejoining').length;
  const totalDays = rows.reduce((s, r) => s + (r.leave.days || 0), 0);

  return createPortal(
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '980px', width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Screen Controls Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }} className="no-print">
          <div>
            <h2 style={{ margin: 0 }}>On Vacation Report (PDF)</h2>
            <p className="muted small" style={{ margin: '2px 0 0 0' }}>Current list of employees away on leave with contact info and expected return dates</p>
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
            <div style={{ flex: '1 1 180px' }}>
              <label htmlFor="vac-status" className="muted small block" style={{ marginBottom: '4px', fontWeight: 'bold' }}>Status</label>
              <select id="vac-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: '100%', height: '38px' }}>
                <option value="all">All ({onLeaveCount + awaitingCount})</option>
                <option value="onLeave">Currently on Leave ({onLeaveCount})</option>
                <option value="awaiting">Awaiting Rejoining ({awaitingCount})</option>
              </select>
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label htmlFor="vac-dept" className="muted small block" style={{ marginBottom: '4px', fontWeight: 'bold' }}>Department</label>
              <select id="vac-dept" value={dept} onChange={(e) => setDept(e.target.value)} style={{ width: '100%', height: '38px' }}>
                <option value="">All Departments</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ flex: '2 1 240px' }}>
              <label htmlFor="vac-search" className="muted small block" style={{ marginBottom: '4px', fontWeight: 'bold' }}>Search</label>
              <input id="vac-search" type="search" placeholder="Search by employee name, ID or code..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', height: '38px' }} />
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
                Human Resources Department · Workforce Leave &amp; Vacation Tracking
              </p>
              <h2 style={{ margin: '10px 0 2px 0', fontSize: '17px', textTransform: 'uppercase', letterSpacing: '.04em', textDecoration: 'underline' }}>
                Employees Currently on Vacation / Leave Report
              </h2>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold' }}>
                As of: {fmt(iso(TODAY))} {dept ? `· Department: ${dept}` : '· All Departments'}
              </p>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f5f5f5', border: '1px solid #ccc', padding: '10px 18px', borderRadius: '4px', marginBottom: '16px', fontSize: '13px' }}>
              <div><strong>Currently on Vacation:</strong> {onLeaveCount}</div>
              <div><strong>Awaiting Rejoining:</strong> {awaitingCount}</div>
              <div><strong>Total Vacation Days:</strong> {totalDays} days</div>
              <div><strong>Generated Date:</strong> {fmt(iso(TODAY))}</div>
            </div>

            {/* Table */}
            {rows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#666' }}>
                <p>No employees currently matching the selected vacation filter.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '10px' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0', borderBottom: '2px solid #000' }}>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', width: '30px' }}>#</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left' }}>Employee Name</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center' }}>Emp No</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left' }}>Department</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left' }}>Visa Sponsor</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left' }}>Leave Type</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center' }}>Period (From → To)</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center' }}>Days</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', background: '#fef3c7' }}>Expected Back</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left' }}>Contact While Away</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.leave.id} style={{ borderBottom: '1px solid #ccc', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', fontWeight: 'bold' }}>{r.emp.name}</td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontFamily: 'monospace' }}>{r.emp.id}</td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px' }}>{r.emp.department.replace(' Department', '')}</td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', fontSize: '11px' }}>{r.emp.sponsor || r.emp.company}</td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px' }}>{r.leave.type}</td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: '11px' }}>
                        {fmt(r.leave.start)} → {fmt(r.leave.end)}
                      </td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center' }}>{r.leave.days}</td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', background: '#fffbeb', whiteSpace: 'nowrap' }}>
                        {fmt(r.backStr)}
                        <small style={{ display: 'block', fontSize: '10px', color: r.daysLeft < 0 ? '#b91c1c' : '#047857' }}>
                          {r.daysLeft < 0 ? `Overdue by ${-r.daysLeft}d` : `In ${r.daysLeft}d`}
                        </small>
                      </td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', fontFamily: 'monospace', fontSize: '11px' }}>
                        {r.leave.contactAbroad || r.emp.emergencyContact || r.emp.mobile || '—'}
                      </td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontSize: '11px' }}>
                        <span style={{ fontWeight: 'bold', color: r.leave.status === 'Awaiting Rejoining' ? '#b91c1c' : '#0369a1' }}>
                          {r.leave.status}
                        </span>
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
                  <div style={{ fontSize: '11.5px', color: '#555' }}>HR &amp; Personnel Officer</div>
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
