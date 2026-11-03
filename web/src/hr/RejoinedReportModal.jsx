import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../core/store.jsx';
import { fmt, iso, TODAY } from '../core/shared.js';
import { Icon, DateInput } from '../core/ui.jsx';
import { DEPARTMENTS } from './data.js';

export default function RejoinedReportModal({ onClose }) {
  const { state } = useStore();

  useEffect(() => {
    document.body.classList.add('has-print-modal');
    return () => document.body.classList.remove('has-print-modal');
  }, []);
  const emps = state.employees;

  // Default: current year from Jan 1st to today (or last 90 days)
  const defaultFrom = iso(new Date(TODAY.getFullYear(), 0, 1));
  const defaultTo = iso(TODAY);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [dept, setDept] = useState('');
  const [search, setSearch] = useState('');

  const empMap = useMemo(() => new Map(emps.map((e) => [e.id, e])), [emps]);

  const rows = useMemo(() => {
    return state.leaves
      .filter((l) => {
        if (!l.rejoined) return false;
        if (from && l.rejoined < from) return false;
        if (to && l.rejoined > to) return false;
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
        const expBack = new Date(l.end + 'T00:00:00');
        expBack.setDate(expBack.getDate() + 1);
        const expBackStr = iso(expBack);
        const diffDays = Math.round((new Date(l.rejoined) - expBack) / 864e5);
        let variance = 'On time';
        if (diffDays < 0) variance = `Early by ${Math.abs(diffDays)}d`;
        else if (diffDays > 0) variance = `Overdue by ${diffDays}d`;

        return { leave: l, emp: e, variance, diffDays };
      })
      .sort((a, b) => (b.leave.rejoined > a.leave.rejoined ? 1 : -1));
  }, [state.leaves, empMap, from, to, dept, search]);

  const totalDays = rows.reduce((s, r) => s + (r.leave.days || 0), 0);

  return createPortal(
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '960px', width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Screen Controls Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }} className="no-print">
          <div>
            <h2 style={{ margin: 0 }}>Rejoined Employees Report</h2>
            <p className="muted small" style={{ margin: '2px 0 0 0' }}>Comprehensive log of staff who completed leave and rejoined duty</p>
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
              <label htmlFor="rep-from" className="muted small block" style={{ marginBottom: '4px', fontWeight: 'bold' }}>From Date</label>
              <DateInput id="rep-from" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label htmlFor="rep-to" className="muted small block" style={{ marginBottom: '4px', fontWeight: 'bold' }}>To Date</label>
              <DateInput id="rep-to" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label htmlFor="rep-dept" className="muted small block" style={{ marginBottom: '4px', fontWeight: 'bold' }}>Department</label>
              <select id="rep-dept" value={dept} onChange={(e) => setDept(e.target.value)} style={{ width: '100%', height: '38px' }}>
                <option value="">All Departments</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ flex: '2 1 200px' }}>
              <label htmlFor="rep-search" className="muted small block" style={{ marginBottom: '4px', fontWeight: 'bold' }}>Search Employee</label>
              <input id="rep-search" type="search" placeholder="Filter by name, ID or code..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', height: '38px' }} />
            </div>
          </div>
        </div>

        {/* Printable & Scrollable Report Content Area */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div className="print-area" style={{ background: '#fff', color: '#000', padding: '30px', border: '1px solid #ddd', borderRadius: '6px', fontFamily: '"Times New Roman", Times, serif' }}>
            
            {/* Formal Report Header */}
            <div style={{ borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '18px', textAlign: 'center' }}>
              <h1 style={{ margin: '0 0 4px 0', fontSize: '22px', textTransform: 'uppercase', letterSpacing: '.02em' }}>
                Adroit Building Material Trading Enterprises
              </h1>
              <p style={{ margin: '2px 0', fontSize: '13px', color: '#444' }}>
                Human Resources Department · Leave &amp; Rejoining Control Register
              </p>
              <h2 style={{ margin: '10px 0 2px 0', fontSize: '17px', textTransform: 'uppercase', letterSpacing: '.04em', textDecoration: 'underline' }}>
                Employee Rejoining Summary Report
              </h2>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold' }}>
                Period: {fmt(from)} to {fmt(to)} {dept ? `· Department: ${dept}` : '· All Departments'}
              </p>
            </div>

            {/* Quick stats row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f5f5f5', border: '1px solid #ccc', padding: '10px 18px', borderRadius: '4px', marginBottom: '16px', fontSize: '13px' }}>
              <div><strong>Rejoined Employees Count:</strong> {rows.length}</div>
              <div><strong>Total Vacation Days Returned:</strong> {totalDays} days</div>
              <div><strong>Report Generated:</strong> {fmt(iso(TODAY))}</div>
            </div>

            {/* Table */}
            {rows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#666' }}>
                <p>No employee rejoining records found for the period from {fmt(from)} to {fmt(to)}.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', marginTop: '10px' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0', borderBottom: '2px solid #000' }}>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', width: '35px' }}>#</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left' }}>Employee Name</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center' }}>Emp No</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left' }}>Department</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left' }}>Visa Sponsor</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left' }}>Leave Type</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center' }}>Leave Period</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center' }}>Days</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', background: '#e8f4ec' }}>Rejoined On</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left' }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.leave.id} style={{ borderBottom: '1px solid #ccc', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', fontWeight: 'bold' }}>{r.emp.name}</td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontFamily: 'monospace' }}>{r.emp.id}</td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px' }}>{r.emp.department.replace(' Department', '')}</td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', fontSize: '11.5px' }}>{r.emp.sponsor || r.emp.company}</td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px' }}>{r.leave.type}</td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: '11.5px' }}>
                        {fmt(r.leave.start)} → {fmt(r.leave.end)}
                      </td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center' }}>{r.leave.days}</td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', background: '#f5faf7', whiteSpace: 'nowrap' }}>
                        {fmt(r.leave.rejoined)}
                        <small style={{ display: 'block', fontSize: '10.5px', color: r.diffDays > 0 ? '#b91c1c' : '#15803d' }}>
                          {r.variance}
                        </small>
                      </td>
                      <td style={{ border: '1px solid #bbb', padding: '6px 8px', fontSize: '11.5px' }}>
                        {r.leave.rejoinNote || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Authorization Sign-off block for corporate compliance */}
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
                  <div style={{ fontSize: '11.5px', color: '#555' }}>Head of HR / Operations</div>
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
