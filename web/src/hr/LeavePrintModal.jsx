import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { fmt } from '../core/shared.js';
import { Icon } from '../core/ui.jsx';

export default function LeavePrintModal({ leave, emp, close }) {
  if (!leave || !emp) return null;

  useEffect(() => {
    document.body.classList.add('has-print-modal');
    return () => document.body.classList.remove('has-print-modal');
  }, []);

  const sponsorCo = emp.sponsor || emp.company || 'Adroit Building Material Trading Enterprises';
  const operatingCo = emp.company || 'Adroit Building Material Trading Enterprises';
  const contactNo = leave.contactAbroad || emp.emergencyContact || emp.mobile || '—';

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = '';
    const restore = () => {
      document.title = originalTitle;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
    setTimeout(restore, 1500);
  };

  return createPortal(
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="modal" style={{ maxWidth: '840px', width: '100%', margin: 'auto' }}>
        
        {/* Screen Controls Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }} className="no-print">
          <div>
            <h2 style={{ margin: 0 }}>Leave Application Print Preview</h2>
            <p className="muted small" style={{ margin: '2px 0 0 0' }}>Official leave submission document</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" onClick={handlePrint}>
              <Icon n="download" size={16} /> Print / Save PDF
            </button>
            <button className="btn btn-ghost" onClick={close}>Close</button>
          </div>
        </div>

        {/* Printable Document (Single-Page Fit) */}
        <div
          className="print-area leave-print-document"
          style={{
            background: '#fff',
            color: '#000',
            padding: '24px 28px',
            border: '1px solid #ccc',
            borderRadius: '6px',
            fontFamily: '"Times New Roman", Times, serif',
            fontSize: '13.5px',
            lineHeight: '1.45',
            boxSizing: 'border-box',
          }}
        >
          {/* Header */}
          <div style={{ borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '14px', textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: '20px', letterSpacing: '.02em', textTransform: 'uppercase' }}>
              {operatingCo}
            </h1>
          </div>

          {/* Form Title */}
          <h2
            style={{
              textAlign: 'center',
              margin: '0 0 16px 0',
              fontSize: '17px',
              textDecoration: 'underline',
              textTransform: 'uppercase',
              letterSpacing: '.05em',
            }}
          >
            Leave Application Form
          </h2>

          {/* Recipient & Metadata Box */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', gap: '20px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, fontSize: '13px', lineHeight: '1.4' }}>
              <p style={{ margin: '0 0 2px 0', fontWeight: 'bold' }}>To: The Manager / HR Directorate</p>
              <p style={{ margin: 0 }}>Dubai, United Arab Emirates</p>
            </div>
            <div style={{ width: '260px', border: '1px solid #777', padding: '6px 10px', borderRadius: '4px', background: '#fafafa', fontSize: '12.5px', lineHeight: '1.4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #ccc', paddingBottom: '2px' }}>
                <strong>Leave Ref:</strong> <span style={{ fontFamily: 'monospace' }}>{leave.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #ccc', padding: '2px 0' }}>
                <strong>Emp No:</strong> <span style={{ fontFamily: 'monospace' }}>{emp.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #ccc', padding: '2px 0' }}>
                <strong>Emp Code:</strong> <span style={{ fontFamily: 'monospace' }}>{emp.code || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '2px' }}>
                <strong>Department:</strong> <span>{emp.department?.replace(' Department', '')}</span>
              </div>
            </div>
          </div>

          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>Dear Sir,</p>
          
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '7px 0' }}>
            <span style={{ whiteSpace: 'nowrap' }}>I,</span>
            <span style={{ flex: 2, borderBottom: '1px solid #000', padding: '0 6px', fontWeight: 'bold' }}>{emp.name}</span>
            <span style={{ whiteSpace: 'nowrap' }}>working as</span>
            <span style={{ flex: 2, borderBottom: '1px solid #000', padding: '0 6px' }}>{emp.designation}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '7px 0' }}>
            <span style={{ whiteSpace: 'nowrap' }}>under visa sponsorship of</span>
            <span style={{ flex: 1, borderBottom: '1px solid #000', padding: '0 6px', fontWeight: 'bold' }}>{sponsorCo}</span>
            <span style={{ whiteSpace: 'nowrap' }}>wish to proceed on</span>
            <span style={{ flex: 1, borderBottom: '1px solid #000', padding: '0 6px', fontWeight: 'bold' }}>{leave.type}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '7px 0' }}>
            <span style={{ whiteSpace: 'nowrap' }}>It is therefore requested that I may please be sanctioned</span>
            <span style={{ width: '80px', borderBottom: '1px solid #000', textAlign: 'center', fontWeight: 'bold' }}>{leave.days}</span>
            <span style={{ whiteSpace: 'nowrap' }}>days leave</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '7px 0' }}>
            <span style={{ whiteSpace: 'nowrap' }}>with effect from</span>
            <span style={{ flex: 1, borderBottom: '1px solid #000', padding: '0 6px', textAlign: 'center', fontWeight: 'bold' }}>{fmt(leave.start)}</span>
            <span style={{ whiteSpace: 'nowrap' }}>to (last day)</span>
            <span style={{ flex: 1, borderBottom: '1px solid #000', padding: '0 6px', textAlign: 'center', fontWeight: 'bold' }}>{fmt(leave.end)}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '7px 0' }}>
            <span style={{ whiteSpace: 'nowrap' }}>Reason / Remarks:</span>
            <span style={{ flex: 1, borderBottom: '1px solid #000', padding: '0 6px' }}>{leave.reason || 'Annual leave'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '7px 0' }}>
            <span style={{ whiteSpace: 'nowrap' }}>Contact while away / Home Number:</span>
            <span style={{ flex: 1, borderBottom: '1px solid #000', padding: '0 6px', fontWeight: 'bold' }}>{contactNo}</span>
          </div>

          {/* Employee Signature */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '22px', marginBottom: '14px' }}>
            <div style={{ textAlign: 'center', width: '240px' }}>
              <div style={{ borderTop: '1px solid #000', paddingTop: '4px' }}>
                <strong>Signature of Employee</strong>
                <div style={{ fontSize: '11px', color: '#555' }}>Date: {fmt(leave.requestedOn || new Date())}</div>
              </div>
            </div>
          </div>

          {/* HR Prior Record */}
          <div style={{ border: '1px solid #555', padding: '7px 12px', borderRadius: '4px', margin: '12px 0', background: '#fcfcfc', fontSize: '12px' }}>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <div style={{ fontWeight: 'bold', width: '150px' }}>Last Leave Availed:</div>
              <div style={{ borderBottom: '1px solid #000', width: '120px', height: '20px' }}></div>
              <div style={{ fontWeight: 'bold', width: '130px' }}>Period of Service:</div>
              <div style={{ borderBottom: '1px solid #000', flex: 1, height: '20px' }}></div>
            </div>
          </div>

          {/* Departmental & Management Approval */}
          <h3 style={{ textAlign: 'center', margin: '14px 0 8px 0', fontSize: '14px', textDecoration: 'underline', textTransform: 'uppercase' }}>
            Departmental &amp; Management Approval
          </h3>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0', fontSize: '13px' }}>
            <span>The employee is recommended for</span>
            <span style={{ width: '50px', borderBottom: '1px solid #000', textAlign: 'center', fontWeight: 'bold' }}>{leave.days}</span>
            <span>days leave with effect from</span>
            <span style={{ width: '100px', borderBottom: '1px solid #000', textAlign: 'center', fontWeight: 'bold' }}>{fmt(leave.start)}</span>
            <span>to</span>
            <span style={{ width: '100px', borderBottom: '1px solid #000', textAlign: 'center', fontWeight: 'bold' }}>{fmt(leave.end)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px', gap: '20px' }}>
            <div style={{ textAlign: 'center', width: '220px' }}>
              <div style={{ borderTop: '1px solid #000', paddingTop: '4px' }}>
                <strong>Divisional / Dept Incharge</strong>
                <div style={{ fontSize: '11px', color: '#555' }}>Signature &amp; Date</div>
              </div>
            </div>
            <div style={{ textAlign: 'center', width: '280px' }}>
              <div style={{ borderTop: '1px solid #000', paddingTop: '4px' }}>
                <strong>HR Manager / Managing Director</strong>
                <div style={{ fontSize: '11.5px', marginTop: '3px' }}>{sponsorCo}</div>
              </div>
            </div>
          </div>

          {/* Rejoining Record */}
          <div style={{ borderTop: '1px dashed #777', marginTop: '18px', paddingTop: '10px', fontSize: '12px' }}>
            <p style={{ fontWeight: 'bold', margin: '0 0 6px 0', fontSize: '12px', textTransform: 'uppercase' }}>
              Rejoining Record (To be filled upon return to duty):
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '150px 140px 1fr', gap: '6px', alignItems: 'center' }}>
              <div>Actual Departure On:</div>
              <div style={{ border: '1px solid #000', height: '22px' }}></div>
              <div style={{ fontSize: '11px', color: '#555' }}>Boarding confirmed</div>

              <div>Actual Rejoined On:</div>
              <div style={{ border: '1px solid #000', height: '22px' }}></div>
              <div style={{ fontSize: '11px', color: '#555' }}>Duty resumed (HR confirmed)</div>

              <div>Work Resumed Remarks:</div>
              <div style={{ border: '1px solid #000', height: '22px', gridColumn: 'span 2' }}></div>
            </div>
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
}
