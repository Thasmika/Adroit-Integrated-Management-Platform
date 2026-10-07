import React, { useEffect, useRef, useState } from 'react';
import { docStatus, fmt, docCfg } from './shared.js';
import { useStore } from './store.jsx';

const P = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  people: 'M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.7 0-8 1.3-8 4v3h16v-3c0-2.7-5.3-4-8-4zm8 0c-.3 0-.7 0-1.1.1 1.2.9 2.1 2.1 2.1 3.9v3h7v-3c0-2.7-5.3-4-8-4z',
  docs: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zM8 13h8v2H8v-2zm0 4h8v2H8v-2z',
  bell: 'M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6V11c0-3.1-1.6-5.6-4.5-6.3V4a1.5 1.5 0 0 0-3 0v.7C7.6 5.4 6 7.9 6 11v5l-2 2v1h16v-1l-2-2z',
  leave: 'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14v11zM7 11h5v5H7v-5z',
  ai: 'M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2zm7 11l1 2.6 2.6 1-2.6 1L19 21l-1-2.4-2.6-1 2.6-1L19 13zM5 15l.8 1.9L7.7 18l-1.9.8L5 21l-.8-2.2L2.3 18l1.9-1.1L5 15z',
  settings: 'M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.9c-.6.3-1.2.6-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1L11 21h4l.4-2.9c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5-2.2-1.6zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z',
  reports: 'M5 21V10h3v11H5zm5.5 0V3h3v18h-3zM16 21v-7h3v7h-3z',
  search: 'M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z',
  plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  upload: 'M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z',
  eye: 'M12 5C7 5 2.7 8.1 1 12.5 2.7 16.9 7 20 12 20s9.3-3.1 11-7.5C21.3 8.1 17 5 12 5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  close: 'M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z',
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z',
  arrow: 'M12 4l-1.4 1.4 5.6 5.6H4v2h12.2l-5.6 5.6L12 20l8-8z',
  back: 'M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20v-2z',
  menu: 'M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z',
  logout: 'M10 17l1.4-1.4-2.6-2.6H20v-2H8.8l2.6-2.6L10 7l-5 5 5 5zM4 3h8v2H4v14h8v2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
  send: 'M2 21l21-9L2 3v7l15 2-15 2v7z',
  edit: 'M3 17.2V21h3.8l11-11-3.8-3.8-11 11zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.8 3.8L20.7 7z',
  filter: 'M3 5h18l-7 8v6l-4 2v-8L3 5z',
  truck: 'M20 8h-3V4H3a2 2 0 0 0-2 2v11h2a3 3 0 0 0 6 0h6a3 3 0 0 0 6 0h2v-5l-3-4zM6 18.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm13.5-9 2 2.5H17V9.5h2.5zM18 18.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
  history: 'M13 3a9 9 0 0 0-9 9H1l4 4 4-4H6a7 7 0 1 1 2.1 5l-1.4 1.4A9 9 0 1 0 13 3zm-1 5v5l4.3 2.5.7-1.2-3.5-2.1V8H12z',
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  shield: 'M12 1 3 5v6c0 5.6 3.8 10.7 9 12 5.2-1.3 9-6.4 9-12V5l-9-4zm-2 16-4-4 1.4-1.4L10 14.2l6.6-6.6L18 9l-8 8z',
  audit: 'M19 3h-4.2A3 3 0 0 0 12 1a3 3 0 0 0-2.8 2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
  camera: 'M9 3 7.2 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3H9zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  lock: 'M18 8h-1V6A5 5 0 0 0 7 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm3.1-9H8.9V6a3.1 3.1 0 0 1 6.2 0v2z',
  swap: 'M6.99 11 3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z',
};
export const Icon = ({ n, size = 18, className = '' }) => (
  <svg className={'ic ' + className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d={P[n]} fill="currentColor" /></svg>
);

export const StatusPill = ({ doc, noScanFlag = true }) => {
  const st = docStatus(doc);
  const extra = st.d != null && ['expired', 'critical', 'due', 'monitor'].includes(st.key) ? (st.d < 0 ? ` · ${-st.d}d ago` : ` · ${st.d}d`) : '';
  return <span className="pill-wrap"><span className={`pill pill-${st.key}`}>{st.label}{extra}</span>{noScanFlag && st.noScan && <span className="pill pill-missing">No scan</span>}</span>;
};
const LEAVE_PILL = { 'Pending HR Review': 'due', 'Pending Approval': 'due', Approved: 'info', 'On Leave': 'info', 'Awaiting Rejoining': 'critical', Completed: 'valid', Rejected: 'expired' };
export const LeavePill = ({ status }) => <span className={`pill pill-${LEAVE_PILL[status] || 'onfile'}`}>{status}</span>;
export const ActionPill = ({ status }) => status === '—' ? <span className="muted">—</span> : <span className={'act act-' + status.split(' ')[0].toLowerCase()}>{status}</span>;

const CAT_ART = {
  'Heavy Vehicle': 'M4 10h31v21H4z M35 16h10l7 8v7H35z M39 18h5.5l4.5 5.5H39z',
  'Light Vehicle': 'M5 30v-6l5-1.5 6-7.5h13l6 8h14.5a2.5 2.5 0 0 1 2.5 2.5v4.5z M18 16.5v6 M29 16v7',
  Trailer: 'M3 25h47v5H3z M50 27.5h7 M8 25v-4 M45 25v-4',
  'Heavy Machine / Equipment': 'M19 20h20v11H19z M22 20V8h11l4 12 M12 4v28 M12 31H3 M12 14h7',
  'Other Company Vehicle': 'M5 30v-7l5-1 5-8h21l6 8h7a3 3 0 0 1 3 3v5z M21 14v8 M31 14v8',
};
const CAT_WHEELS = { 'Heavy Vehicle': [11, 25, 45], 'Light Vehicle': [15, 45], Trailer: [33, 42], 'Heavy Machine / Equipment': [24, 35], 'Other Company Vehicle': [15, 43] };
export const VehicleArt = ({ category, size = 96 }) => (
  <svg className="vart" width={size} height={size * 0.66} viewBox="0 0 60 40" aria-hidden="true">
    <path d={CAT_ART[category]} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
    {CAT_WHEELS[category].map((x) => <circle key={x} cx={x} cy="33" r="4" fill="var(--surface)" stroke="currentColor" strokeWidth="2.2" />)}
  </svg>
);

export function Modal({ title, onClose, children, wide, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    ref.current?.querySelector('input,select,textarea,button')?.focus();
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' modal-wide' : '')} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon n="close" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => {
        const key = typeof t === 'string' ? t : t.key;
        const label = typeof t === 'string' ? t : t.label;
        return (
          <button key={key} role="tab" aria-selected={value === key} className={'tab' + (value === key ? ' on' : '')} onClick={() => onChange(key)}>
            {label}{t.count != null && <span className="tab-count">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export const Avatar = ({ name, size = 36, photo }) => {
  if (photo) return <img className="avatar avatar-img" src={photo} alt="" style={{ width: size, height: size }} />;
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, '--h': h }}>{initials}</span>;
};

export const Field = ({ label, children, hint, span }) => (
  <label className={'field' + (span ? ' span-' + span : '')}>
    <span className="field-label">{label}</span>
    {children}
    {hint && <span className="field-hint">{hint}</span>}
  </label>
);

export const KV = ({ k, v, mono }) => (
  <div className="kv"><dt>{k}</dt><dd className={mono ? 'mono' : ''}>{v || '—'}</dd></div>
);

// Preview of the stored scan. The server checks permission and writes each view to the audit log (§9).
export function DocViewer({ owner, module, doc, onClose }) {
  const [reveal, setReveal] = useState(false);
  const f = doc.file;
  const hr = module === 'hr';
  const mask = (v) => (!hr || reveal || !v || ['Health Insurance', 'Qualification Certificate'].includes(doc.type) ? v : v.slice(0, 2) + '•'.repeat(Math.max(0, v.length - 5)) + v.slice(-3));
  return (
    <Modal title={`${doc.name || doc.type} · ${owner.id}`} onClose={onClose} wide
      footer={<><span className="muted small"><Icon n="lock" size={13} /> {f?.name} {f?.size ? `· ${f.size}` : ''} · views are recorded in the audit log</span>
        {f?.url && <a className="btn" href={`${f.url}?download=1`}>Download</a>}<button className="btn" onClick={onClose}>Close</button></>}>
      <div className="viewer">
        <dl className="viewer-meta">
          <div><dt>{hr ? 'Employee' : 'Asset'}</dt><dd>{hr ? owner.name : `${owner.make || ''} ${owner.model || ''}`}</dd></div>
          <div><dt>Number</dt><dd className="mono">{mask(doc.ref) || '—'} {hr && doc.ref && !['Health Insurance', 'Qualification Certificate'].includes(doc.type) && <button className="link small" onClick={() => setReveal(!reveal)}>{reveal ? 'mask' : 'show'}</button>}</dd></div>
          <div><dt>Issued by</dt><dd>{doc.issuer || '—'}</dd></div>
          {docCfg(doc.type).expires && <div><dt>Expiry</dt><dd>{fmt(doc.expiry)}</dd></div>}
        </dl>
        {!f && <p className="muted">No scanned copy is stored for this document.</p>}
        {f?.kind?.startsWith('image/') && <img src={f.url} alt={`${doc.type} scan`} className="viewer-img" />}
        {f?.kind === 'application/pdf' && <iframe title={`${doc.type} scan`} src={f.url} className="viewer-pdf" />}
        {f && !f.kind?.startsWith('image/') && f.kind !== 'application/pdf' && <p className="muted">This file type can't be previewed in the browser. Use Download to open it.</p>}
      </div>
    </Modal>
  );
}

// Photo block for a profile, with upload
export function PhotoBox({ module, owner, canEdit, size = 'lg' }) {
  const { state, act, run, notify } = useStore();
  const pick = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { notify('Choose a JPG or PNG image for the photo.'); return; }
    if (file.size > state.config.system.maxFileMB * 1048576) { notify(`The photo is larger than ${state.config.system.maxFileMB} MB.`); return; }
    await run(() => act.uploadPhoto(module, owner.id, file), 'Photo updated');
    e.target.value = '';
  };
  return (
    <div className={'photo-box pb-' + module}>
      {owner.photo ? <img src={owner.photo} alt={`${owner.name || owner.id} photo`} /> : module === 'hr' ? <Avatar name={owner.name} size={88} /> : <VehicleArt category={owner.category} size={132} />}
      {canEdit && <label className="photo-edit" title="Upload photo"><input type="file" accept="image/*" onChange={pick} /><Icon n="camera" size={15} /> Photo</label>}
    </div>
  );
}

export const Empty = ({ title, children }) => (
  <div className="empty"><strong>{title}</strong>{children && <p>{children}</p>}</div>
);
