import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../core/store.jsx';
import { fmt, iso, TODAY, OPERATING } from '../core/shared.js';
import { Icon } from '../core/ui.jsx';
import { HR_STATUSES, SPONSORS } from './data.js';

export default function EmployeePrintModal({ onClose }) {
  const { state } = useStore();

  useEffect(() => {
    document.body.classList.add('has-print-modal');
    return () => document.body.classList.remove('has-print-modal');
  }, []);

  const emps = state.employees;
  const companies = state.config.companies || [];
  const departments = state.config.departments || [];

  const [dept, setDept] = useState('');
  const [sponsor, setSponsor] = useState('');
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState('');
  const [nat, setNat] = useState('');
  const [search, setSearch] = useState('');

  const nats = useMemo(() => [...new Set(emps.map((e) => e.nationality).filter(Boolean))].sort(), [emps]);

  // Filtered pool
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return emps.filter((e) => {
      if (dept && e.department !== dept) return false;
      if (sponsor && e.sponsor !== sponsor) return false;
      if (company && e.company !== company) return false;
      if (status && e.status !== status) return false;
      if (nat && e.nationality !== nat) return false;
      if (!q) return true;
      return [e.name, e.id, e.code, e.molId, e.designation, e.department, e.nationality, e.mobile]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [emps, dept, sponsor, company, status, nat, search]);

  // Selected employee IDs set
  const [selectedIds, setSelectedIds] = useState(() => new Set(emps.map((e) => e.id)));

  // If filtered set changes and all filtered were selected, keep them selected; otherwise keep existing selections
  const allFilteredSelected = filtered.length > 0 && filtered.every((e) => selectedIds.has(e.id));
  const someFilteredSelected = filtered.some((e) => selectedIds.has(e.id));

  const toggleSelectAllFiltered = () => {
    const next = new Set(selectedIds);
    if (allFilteredSelected) {
      filtered.forEach((e) => next.delete(e.id));
    } else {
      filtered.forEach((e) => next.add(e.id));
    }
    setSelectedIds(next);
  };

  const toggleEmployee = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const printableRows = useMemo(() => {
    return filtered.filter((e) => selectedIds.has(e.id));
  }, [filtered, selectedIds]);

  return createPortal(
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '1080px', width: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>

        {/* Screen Controls Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }} className="no-print">
          <div>
            <h2 style={{ margin: 0 }}>Print Employees Register</h2>
            <p className="muted small" style={{ margin: '2px 0 0 0' }}>
              Select any category, filter criteria, or individual employees to print or export to PDF
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" onClick={() => window.print()} disabled={printableRows.length === 0}>
              <Icon n="print" size={16} /> Print / Save as PDF ({printableRows.length})
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>

        {/* Multi-Criteria Filters Bar */}
        <div className="panel pad no-print" style={{ marginBottom: '14px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', alignItems: 'flex-end' }}>
            <div>
              <label htmlFor="p-dept" className="muted small block" style={{ marginBottom: '4px', fontWeight: 'bold' }}>Department</label>
              <select id="p-dept" value={dept} onChange={(e) => setDept(e.target.value)} style={{ width: '100%', height: '36px' }}>
                <option value="">All Departments</option>
                {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="p-sponsor" className="muted small block" style={{ marginBottom: '4px', fontWeight: 'bold' }}>Visa Sponsor</label>
              <select id="p-sponsor" value={sponsor} onChange={(e) => setSponsor(e.target.value)} style={{ width: '100%', height: '36px' }}>
                <option value="">All Visa Sponsors</option>
                {(companies.length ? companies.map((c) => c.name) : SPONSORS).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="p-co" className="muted small block" style={{ marginBottom: '4px', fontWeight: 'bold' }}>Operational Co.</label>
              <select id="p-co" value={company} onChange={(e) => setCompany(e.target.value)} style={{ width: '100%', height: '36px' }}>
                <option value="">All Operational Co.</option>
                {companies.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="p-status" className="muted small block" style={{ marginBottom: '4px', fontWeight: 'bold' }}>Status</label>
              <select id="p-status" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '100%', height: '36px' }}>
                <option value="">All Statuses</option>
                {HR_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="p-nat" className="muted small block" style={{ marginBottom: '4px', fontWeight: 'bold' }}>Nationality</label>
              <select id="p-nat" value={nat} onChange={(e) => setNat(e.target.value)} style={{ width: '100%', height: '36px' }}>
                <option value="">All Nationalities</option>
                {nats.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="p-search" className="muted small block" style={{ marginBottom: '4px', fontWeight: 'bold' }}>Search</label>
              <input id="p-search" type="search" placeholder="Name, EMP no., designation…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', height: '36px' }} />
            </div>
          </div>

          {/* Quick selection bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={allFilteredSelected}
                ref={(el) => { if (el) el.indeterminate = !allFilteredSelected && someFilteredSelected; }}
                onChange={toggleSelectAllFiltered}
              />
              Select All Matching ({filtered.length})
            </label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span className="small muted">
                <strong>{printableRows.length}</strong> of {emps.length} selected for print
              </span>
              {(dept || sponsor || company || status || nat || search) && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => { setDept(''); setSponsor(''); setCompany(''); setStatus(''); setNat(''); setSearch(''); }}
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Preview & Print Area */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div className="print-area" style={{ background: '#fff', color: '#000', padding: '28px', border: '1px solid #ddd', borderRadius: '6px', fontFamily: '"Times New Roman", Times, serif' }}>

            {/* Corporate Formal Header */}
            <div style={{ borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '16px', textAlign: 'center' }}>
              <h1 style={{ margin: '0 0 4px 0', fontSize: '22px', textTransform: 'uppercase', letterSpacing: '.02em' }}>
                Adroit Building Material Trading Enterprises
              </h1>
              <p style={{ margin: '2px 0', fontSize: '13px', color: '#444' }}>
                Human Resources Department · Master Employee Register
              </p>
              <h2 style={{ margin: '8px 0 2px 0', fontSize: '16px', textTransform: 'uppercase', letterSpacing: '.03em', textDecoration: 'underline' }}>
                Employee Information Summary Report
              </h2>
              <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 'bold' }}>
                Generated on: {fmt(iso(TODAY))} · Total Headcount: {printableRows.length} {dept ? `· Department: ${dept}` : ''} {sponsor ? `· Sponsor: ${sponsor}` : ''}
              </p>
            </div>

            {/* Printable Table */}
            {printableRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <p>No employees match the current selection criteria.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '8px' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0', borderBottom: '2px solid #000' }}>
                    <th className="no-print" style={{ border: '1px solid #bbb', padding: '6px 4px', textAlign: 'center', width: '32px' }}>
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        ref={(el) => { if (el) el.indeterminate = !allFilteredSelected && someFilteredSelected; }}
                        onChange={toggleSelectAllFiltered}
                      />
                    </th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 6px', textAlign: 'center', width: '30px' }}>#</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left' }}>Employee Name</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 6px', textAlign: 'center' }}>EMP No.</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 6px', textAlign: 'center' }}>EMP Code</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left' }}>Department</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left' }}>Visa Sponsor</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left' }}>Operational Co.</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left' }}>Designation</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 6px', textAlign: 'center' }}>Status</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 6px', textAlign: 'center' }}>Join Date</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 6px', textAlign: 'center' }}>Contact No.</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e, idx) => {
                    const isSelected = selectedIds.has(e.id);
                    return (
                      <tr
                        key={e.id}
                        className={isSelected ? '' : 'no-print'}
                        style={{
                          borderBottom: '1px solid #ccc',
                          background: idx % 2 === 0 ? '#fff' : '#fafafa',
                          opacity: isSelected ? 1 : 0.4,
                        }}
                      >
                        <td className="no-print" style={{ border: '1px solid #bbb', padding: '6px 4px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleEmployee(e.id)}
                          />
                        </td>
                        <td style={{ border: '1px solid #bbb', padding: '6px 6px', textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #bbb', padding: '6px 8px', fontWeight: 'bold' }}>{e.name}</td>
                        <td style={{ border: '1px solid #bbb', padding: '6px 6px', textAlign: 'center', fontFamily: 'monospace' }}>
                          {e.id.replace(/^EMP\s*/i, '')}
                        </td>
                        <td style={{ border: '1px solid #bbb', padding: '6px 6px', textAlign: 'center', fontFamily: 'monospace' }}>
                          {e.code || '—'}
                        </td>
                        <td style={{ border: '1px solid #bbb', padding: '6px 8px' }}>
                          {e.department.replace(' Department', '')}
                        </td>
                        <td style={{ border: '1px solid #bbb', padding: '6px 8px', fontSize: '11px' }}>
                          {e.sponsor || '—'}
                        </td>
                        <td style={{ border: '1px solid #bbb', padding: '6px 8px', fontSize: '11px' }}>
                          {e.company || '—'}
                        </td>
                        <td style={{ border: '1px solid #bbb', padding: '6px 8px' }}>{e.designation}</td>
                        <td style={{ border: '1px solid #bbb', padding: '6px 6px', textAlign: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: e.status === 'Active' ? 'normal' : 'bold' }}>{e.status}</span>
                        </td>
                        <td style={{ border: '1px solid #bbb', padding: '6px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {fmt(e.joined)}
                        </td>
                        <td style={{ border: '1px solid #bbb', padding: '6px 6px', textAlign: 'center', fontFamily: 'monospace', fontSize: '11px' }}>
                          {e.mobile?.replace(/^\+971\s*/, '0') || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Corporate Compliance Signatures */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '50px', paddingTop: '18px' }}>
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
