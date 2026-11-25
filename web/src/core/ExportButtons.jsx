import React from 'react';
import { Icon } from './ui.jsx';
import { docStatus } from './shared.js';

// "Download Excel" + "Download PDF / Print" pair; `exp` comes from reportExporter() in export.js.
export const ExportButtons = ({ exp, disabled }) => (
  <div className="pager-btns">
    <button className="btn btn-sm" onClick={exp.excel} disabled={disabled}><Icon n="download" size={14} /> Download Excel</button>
    <button className="btn btn-sm btn-primary" onClick={exp.pdf} disabled={disabled}><Icon n="print" size={14} /> Download PDF / Print</button>
  </div>
);

// Same wording as <StatusPill>, as plain text for exports.
export const statusText = (doc) => {
  const st = docStatus(doc);
  const extra = st.d != null && ['expired', 'critical', 'due', 'monitor'].includes(st.key) ? (st.d < 0 ? ` · ${-st.d}d ago` : ` · ${st.d}d`) : '';
  return st.label + extra;
};
