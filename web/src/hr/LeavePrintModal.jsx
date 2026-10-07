import React from 'react';
import { fmt } from '../core/shared.js';
import { Icon } from '../core/ui.jsx';

export default function LeavePrintModal({ leave, emp, close }) {
  if (!leave || !emp) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: '800px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }} className="no-print">
          <h2>Leave Application Print Preview</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" onClick={() => window.print()}><Icon n="download" size={16} /> Print / PDF</button>
            <button className="btn btn-ghost" onClick={close}>Close</button>
          </div>
        </div>

        <div className="print-area" style={{ background: '#fff', color: '#000', padding: '40px', border: '1px solid #ccc', borderRadius: '4px', fontFamily: 'serif' }}>
          <h2 style={{ textAlign: 'center', margin: '0 0 10px 0', fontSize: '24px' }}>{emp.company || 'Adroit Building Material Trading Enterprises'}</h2>
          <h3 style={{ textAlign: 'center', margin: '0 0 30px 0', fontSize: '18px', textDecoration: 'underline' }}>Leave Application</h3>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <p>The Manager</p>
              <p>{emp.company || 'Adroit Building Material Trading Enterprises'}</p>
              <p>Dubai, U.A.E</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '200px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Leave No</span> <span>{leave.id.replace('L-', '')}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Emp Code</span> <span>{emp.code}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Emp No</span> <span>{emp.id.replace('EMP ', '')}</span></div>
            </div>
          </div>

          <p>Dear Sir</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '20px' }}>
            <span>I</span>
            <span style={{ flex: 1, borderBottom: '1px solid #000', padding: '0 10px' }}>{emp.name}</span>
            <span>working as</span>
            <span style={{ flex: 1, borderBottom: '1px solid #000', padding: '0 10px' }}>{emp.designation}</span>
            <span style={{ whiteSpace: 'nowrap' }}>wish to</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '15px' }}>
            <span>proceed on</span>
            <span style={{ flex: 1, borderBottom: '1px solid #000', padding: '0 10px' }}>{leave.type}</span>
            <span>to my country</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '15px' }}>
            <span>It is therefore, requested that I may please be sanction</span>
            <span style={{ width: '100px', borderBottom: '1px solid #000', textAlign: 'center' }}>{leave.days}</span>
            <span>days leave</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '15px' }}>
            <span>with effect from</span>
            <span style={{ flex: 1, borderBottom: '1px solid #000', padding: '0 10px' }}>{fmt(leave.start)} to {fmt(leave.end)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '60px' }}>
            <div style={{ textAlign: 'center', width: '250px' }}>
              <div style={{ borderTop: '1px solid #000', paddingTop: '5px' }}>Signature of Employee</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', marginTop: '40px', alignItems: 'center' }}>
            <div style={{ border: '1px solid #000', padding: '5px 10px', width: '150px' }}>Last Leave Availed</div>
            <div style={{ border: '1px solid #000', padding: '5px 10px', width: '80px', height: '34px' }}></div>
            <div style={{ border: '1px solid #000', padding: '5px 10px' }}>Days</div>
          </div>

          <div style={{ display: 'flex', gap: '20px', marginTop: '10px', alignItems: 'center' }}>
            <div style={{ border: '1px solid #000', padding: '5px 10px', width: '150px' }}>Period Completed</div>
            <div style={{ border: '1px solid #000', padding: '5px 10px', width: '80px', height: '34px' }}></div>
            <div style={{ border: '1px solid #000', padding: '5px 10px' }}>Years</div>
            <div style={{ border: '1px solid #000', padding: '5px 10px', width: '80px', height: '34px' }}></div>
            <div style={{ border: '1px solid #000', padding: '5px 10px' }}>Months</div>
          </div>

          <h3 style={{ textAlign: 'center', margin: '40px 0 20px 0', fontSize: '18px' }}>Approval of Divisional Incharge</h3>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>He is entitled for</span>
            <span style={{ width: '80px', borderBottom: '1px solid #000', textAlign: 'center' }}>{leave.days}</span>
            <span>days leave with effect from</span>
            <span style={{ width: '100px', borderBottom: '1px solid #000', textAlign: 'center' }}>/ /</span>
            <span>to</span>
            <span style={{ width: '100px', borderBottom: '1px solid #000', textAlign: 'center' }}>/ /</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '80px' }}>
            <div style={{ textAlign: 'center', width: '250px' }}>
              <div style={{ borderTop: '1px solid #000', paddingTop: '5px' }}>Signature</div>
            </div>
            <div style={{ textAlign: 'center', width: '350px' }}>
              <div style={{ borderTop: '1px solid #000', paddingTop: '5px' }}>HR Manager/Managing Director</div>
              <div style={{ fontSize: '14px', marginTop: '5px' }}>{emp.company || 'Adroit Building Material Trading Enterprises'}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '150px 150px 1fr', gap: '10px', marginTop: '50px', alignItems: 'center' }}>
            <div>Departure On</div>
            <div style={{ border: '1px solid #000', height: '30px' }}></div>
            <div style={{ border: '1px solid #000', height: '30px', padding: '4px' }}><span style={{borderRight: '1px solid #000', paddingRight: '5px'}}>Home Address</span></div>

            <div>Returned On</div>
            <div style={{ border: '1px solid #000', height: '30px' }}></div>
            <div style={{ border: '1px solid #000', height: '30px' }}></div>

            <div>Work Started On</div>
            <div style={{ border: '1px solid #000', height: '30px' }}></div>
            <div style={{ border: '1px solid #000', height: '30px' }}></div>
          </div>

        </div>
      </div>
    </div>
  );
}
