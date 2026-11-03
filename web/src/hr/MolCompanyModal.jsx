import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore, href } from '../core/store.jsx';
import { fmt, iso, TODAY } from '../core/shared.js';
import { Icon, Avatar } from '../core/ui.jsx';
import { empParam } from './data.js';

export default function MolCompanyModal({ company, onClose }) {
  const { state } = useStore();

  useEffect(() => {
    document.body.classList.add('has-print-modal');
    return () => document.body.classList.remove('has-print-modal');
  }, []);

  const [search, setSearch] = useState('');

  // All employees sponsored under this company
  const companyEmployees = useMemo(() => {
    return state.employees.filter((e) => e.sponsor === company.name);
  }, [state.employees, company.name]);

  // Filtered rows for search
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companyEmployees;
    return companyEmployees.filter((e) => {
      const labourDoc = e.docs?.find((d) => d.type === 'Labour Card');
      return [
        e.name,
        e.id,
        e.code,
        e.molId,
        e.designation,
        e.department,
        labourDoc?.ref,
      ].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [companyEmployees, search]);

  const withMolCount = companyEmployees.filter((e) => e.molId).length;

  return createPortal(
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '1040px', width: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>

        {/* Screen Controls Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }} className="no-print">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0 }}>{company.name}</h2>
              {company.molCode && <span className="tag mono" style={{ fontSize: '13px' }}>MOL: {company.molCode}</span>}
            </div>
            <p className="muted small" style={{ margin: '3px 0 0 0' }}>
              Ministry of Labour (MOHRE) Register · {companyEmployees.length} sponsored employee{companyEmployees.length !== 1 ? 's' : ''} ({withMolCount} recorded with Emp MOL ID)
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" onClick={() => window.print()} disabled={rows.length === 0}>
              <Icon n="print" size={16} /> Print / Save as PDF ({rows.length})
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>

        {/* Screen Search Filter */}
        <div className="panel pad no-print" style={{ marginBottom: '14px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <input
                id="mol-co-emp-search"
                type="search"
                placeholder="Search within company by employee name, EMP ID, code or MOL ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', height: '36px' }}
              />
            </div>
            {search && (
              <button className="btn btn-sm btn-ghost" onClick={() => setSearch('')}>
                Clear
              </button>
            )}
            <span className="small muted">
              Showing <strong>{rows.length}</strong> of {companyEmployees.length}
            </span>
          </div>
        </div>

        {/* Printable Area & Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div className="print-area" style={{ background: '#fff', color: '#000', padding: '28px', border: '1px solid #ddd', borderRadius: '6px', fontFamily: '"Times New Roman", Times, serif' }}>

            {/* Formal MOHRE Compliance Letterhead */}
            <div style={{ borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '16px', textAlign: 'center' }}>
              <h1 style={{ margin: '0 0 4px 0', fontSize: '22px', textTransform: 'uppercase', letterSpacing: '.02em' }}>
                {company.name}
              </h1>
              <p style={{ margin: '2px 0', fontSize: '13px', color: '#444' }}>
                Ministry of Human Resources &amp; Emiratisation (MOHRE) · Sponsoring Company Register
              </p>
              <h2 style={{ margin: '8px 0 2px 0', fontSize: '16px', textTransform: 'uppercase', letterSpacing: '.03em', textDecoration: 'underline' }}>
                Sponsored Workforce Information &amp; Labour Card Register
              </h2>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '6px', fontSize: '13px', fontWeight: 'bold' }}>
                <span>Company MOL Code: <span style={{ fontFamily: 'monospace' }}>{company.molCode || 'Not Recorded'}</span></span>
                <span>·</span>
                <span>Total Sponsored Employees: {companyEmployees.length}</span>
                <span>·</span>
                <span>Report Date: {fmt(iso(TODAY))}</span>
              </div>
            </div>

            {/* Table */}
            {rows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <p>No employees found for this company.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '8px' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0', borderBottom: '2px solid #000' }}>
                    <th style={{ border: '1px solid #bbb', padding: '6px 6px', textAlign: 'center', width: '30px' }}>#</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left' }}>Employee Name</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 6px', textAlign: 'center' }}>EMP No.</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 6px', textAlign: 'center' }}>EMP Code</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left' }}>Designation</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left' }}>Department</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', background: '#f5faf7' }}>Emp (MOL) ID</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center' }}>Labour Card No.</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center' }}>Labour Card Expiry</th>
                    <th style={{ border: '1px solid #bbb', padding: '6px 6px', textAlign: 'center' }}>Join Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e, idx) => {
                    const labourDoc = e.docs?.find((d) => d.type === 'Labour Card');
                    return (
                      <tr key={e.id} style={{ borderBottom: '1px solid #ccc', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ border: '1px solid #bbb', padding: '6px 6px', textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #bbb', padding: '6px 8px', fontWeight: 'bold' }}>
                          <span className="no-print">
                            <a href={href('hr-employee', empParam(e.id))} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                              {e.name}
                            </a>
                          </span>
                          <span className="only-print">{e.name}</span>
                        </td>
                        <td style={{ border: '1px solid #bbb', padding: '6px 6px', textAlign: 'center', fontFamily: 'monospace' }}>
                          {e.id.replace(/^EMP\s*/i, '')}
                        </td>
                        <td style={{ border: '1px solid #bbb', padding: '6px 6px', textAlign: 'center', fontFamily: 'monospace' }}>
                          {e.code || '—'}
                        </td>
                        <td style={{ border: '1px solid #bbb', padding: '6px 8px' }}>{e.designation}</td>
                        <td style={{ border: '1px solid #bbb', padding: '6px 8px' }}>
                          {e.department.replace(' Department', '')}
                        </td>
                        <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold', background: '#f5faf7' }}>
                          {e.molId || <span style={{ color: '#888', fontWeight: 'normal' }}>—</span>}
                        </td>
                        <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontFamily: 'monospace' }}>
                          {labourDoc?.ref || '—'}
                        </td>
                        <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {labourDoc?.expiry ? fmt(labourDoc.expiry) : '—'}
                        </td>
                        <td style={{ border: '1px solid #bbb', padding: '6px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {fmt(e.joined)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Corporate Compliance Sign-off Block */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '50px', paddingTop: '18px' }}>
              <div style={{ textAlign: 'center', width: '220px' }}>
                <div style={{ borderTop: '1px solid #000', paddingTop: '6px' }}>
                  <strong>Prepared By</strong>
                  <div style={{ fontSize: '11.5px', color: '#555' }}>PRO / HR Compliance Officer</div>
                </div>
              </div>
              <div style={{ textAlign: 'center', width: '220px' }}>
                <div style={{ borderTop: '1px solid #000', paddingTop: '6px' }}>
                  <strong>Verified By</strong>
                  <div style={{ fontSize: '11.5px', color: '#555' }}>Head of HR &amp; Personnel</div>
                </div>
              </div>
              <div style={{ textAlign: 'center', width: '220px' }}>
                <div style={{ borderTop: '1px solid #000', paddingTop: '6px' }}>
                  <strong>Approved By</strong>
                  <div style={{ fontSize: '11.5px', color: '#555' }}>Authorized Signatory / MD</div>
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
