import React, { useState } from 'react';
import { useStore, checkFile } from './store.jsx';
import { Modal, Field, DateInput } from './ui.jsx';
import { iso, TODAY, docTypes, docCfg, ACTION_STATES, fmt } from './shared.js';
import { can } from './access.js';

const CYCLE = { Passport: 3650, 'Employment Visa': 730, 'Emirates ID': 730, 'Labour Card': 730 };

// mode 'renew': the new document replaces the current one, the old one moves to history (§8.3 step 6, §9)
// mode 'upload': add or update the current record and/or its scan
export function UploadDocModal({ module, owner, docType, mode = 'upload', onClose }) {
  const { state, act, notify } = useStore();
  const [busy, setBusy] = useState(false);
  const types = docTypes(module).map((t) => t.key).filter((t) => can(state.user, 'uploadDoc', { type: t }));
  const [type, setType] = useState(docType || types.find((t) => !owner.docs.some((d) => d.type === t)) || types[types.length - 1]);
  const existing = owner.docs.find((d) => d.type === type);
  const cfg = docCfg(type);
  const renew = mode === 'renew' && existing;
  const cycle = CYCLE[type] || 365;
  const base = existing?.expiry && existing.expiry > iso(TODAY) ? new Date(existing.expiry + 'T00:00:00') : TODAY;
  const suggested = iso(new Date(base.getTime() + cycle * 864e5));
  const [name, setName] = useState(existing?.name || (type === 'Other Permit' ? '' : type));
  const [ref, setRef] = useState(renew ? '' : existing?.ref || '');
  const [issuer, setIssuer] = useState(existing?.issuer || '');
  const [issued, setIssued] = useState(renew ? iso(TODAY) : existing?.issued || '');
  const [expiry, setExpiry] = useState(renew ? suggested : existing?.expiry || '');
  const [file, setFile] = useState(null);
  const [err, setErr] = useState('');
  const isPhotoPage = type.includes('Passport Page') || type === 'Emirates ID Back';
  const switchType = (t) => { setType(t); const ex = owner.docs.find((d) => d.type === t); setName(ex?.name || (t === 'Other Permit' ? '' : t)); setRef(ex?.ref || ''); setIssuer(ex?.issuer || ''); setIssued(ex?.issued || ''); setExpiry(ex?.expiry || ''); };

  const save = async (e) => {
    e.preventDefault();
    const fe = checkFile(file, state.config.system);
    if (fe) { setErr(fe); return; }
    if (renew && cfg.expires && (!expiry || expiry <= iso(TODAY))) { setErr('Enter the new expiry date. It must be after today.'); return; }
    if (!renew && !existing && !isPhotoPage && (!ref || (cfg.expires && !expiry))) { setErr(`Enter the reference number${cfg.expires ? ' and expiry date' : ''} for the new document.`); return; }
    if (!renew && existing && !file && ref === existing.ref && expiry === existing.expiry && issuer === existing.issuer) { setErr('Choose a scanned file, or change the document details.'); return; }
    if (type === 'Other Permit' && !name.trim()) { setErr('Enter the permit name, e.g. RTA Heavy Vehicle Permit.'); return; }
    const fields = { name: name || type, ref: isPhotoPage ? '-' : ref, issuer, issued, expiry: cfg.expires ? expiry : '' };
    setBusy(true); setErr('');
    try {
      await act.saveDoc(module, owner.id, type, renew ? 'renew' : 'upload', fields, file);
      notify(renew ? `${fields.name} renewed for ${owner.id}. Previous copy moved to history.` : `${fields.name} saved for ${owner.id}`);
      onClose();
    } catch (x) { setErr(x.message); setBusy(false); }
  };
  const sys = state.config.system;

  return (
    <Modal title={renew ? `Renew ${existing.name} · ${owner.id}` : `${existing ? 'Update' : 'Add'} document · ${owner.id}`} onClose={onClose}
      footer={<><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="doc-form" type="submit" disabled={busy}>{busy ? 'Saving…' : renew ? 'Save renewal' : 'Save document'}</button></>}>
      <form id="doc-form" className="form-grid" onSubmit={save}>
        {!docType && (
          <Field label="Document type" span={2}>
            <select id="doc-type" value={type} onChange={(e) => switchType(e.target.value)}>
              {types.map((t) => <option key={t} value={t}>{t}{owner.docs.some((d) => d.type === t) ? ' (update existing)' : ''}</option>)}
            </select>
          </Field>
        )}
        {renew && <p className="note span-2">Current: <strong className="mono">{existing.ref}</strong>, expires <strong>{fmt(existing.expiry)}</strong>. It stays in the document history, and the open renewal action is marked Completed.</p>}
        {type === 'Other Permit' && <Field label="Permit name" span={2}><input id="doc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. RTA Heavy Vehicle Permit" /></Field>}
        {!isPhotoPage && (
          <>
            <Field label={renew ? 'New document / policy no.' : 'Document / policy no.'}><input id="doc-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder={existing?.ref || ''} /></Field>
            <Field label={type.includes('Insurance') ? 'Provider / insurer' : 'Issued by'}><input id="doc-issuer" value={issuer} onChange={(e) => setIssuer(e.target.value)} /></Field>
            <Field label="Issue date"><DateInput id="doc-issued" value={issued} onChange={(e) => setIssued(e.target.value)} /></Field>
            {cfg.expires && <Field label="Expiry date" hint={renew ? `Suggested from a ${Math.round(cycle / 365)}-year cycle` : null}><DateInput id="doc-expiry" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field>}
          </>
        )}
        <Field label={`Scanned copy (${sys.fileTypes.join(', ')} · max ${sys.maxFileMB} MB)`} span={2}>
          <label className="drop">
            <input id="doc-file" type="file" accept={sys.fileTypes.map((t) => '.' + t.toLowerCase()).join(',') + (sys.fileTypes.includes('JPG') ? ',.jpeg' : '')} onChange={(e) => { setFile(e.target.files[0] || null); setErr(''); }} />
            <span>{file ? `${file.name} · ${Math.round(file.size / 1024)} KB` : 'Click to choose a file, or drop it here'}</span>
          </label>
        </Field>
        {renew && !file && <p className="field-hint span-2">Attach the new scan now. Without it the record shows "No scan" until one is uploaded.</p>}
        {err && <p className="error span-2" role="alert">{err}</p>}
      </form>
    </Modal>
  );
}

export function RenewalActionModal({ module, owner, doc, onClose }) {
  const { act, run } = useStore();
  const [busy, setBusy] = useState(false);
  const opts = ACTION_STATES.filter((s) => s !== 'Open');
  const [status, setStatus] = useState(doc.renewal?.status === 'In Progress' ? 'Submitted to authority' : 'In Progress');
  const [note, setNote] = useState('');
  return (
    <Modal title={`Renewal action · ${doc.name || doc.type}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="rn-form" type="submit" disabled={busy}>Update action</button></>}>
      <form id="rn-form" className="form-grid" onSubmit={async (e) => { e.preventDefault(); setBusy(true); if (await run(() => act.updateAction(module, owner.id, doc.type, status, note), `${owner.id} · ${doc.name || doc.type}: ${status}`)) onClose(); else setBusy(false); }}>
        <p className="note span-2">{owner.id} · {owner.name || `${owner.make} ${owner.model}`} · expires {fmt(doc.expiry)}<br />Current action: <strong>{doc.renewal ? `${doc.renewal.status} (${doc.renewal.by}, ${fmt(doc.renewal.date)})` : 'Open'}</strong></p>
        <Field label="Action status" span={2}>
          <div className="seg">{opts.map((s) => <button type="button" key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{s}</button>)}</div>
        </Field>
        <Field label="Note" span={2}><textarea id="rn-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Application submitted, awaiting typing centre" /></Field>
        <p className="field-hint span-2">The action closes as <strong>Completed</strong> when the renewed document is recorded with <strong>Renew</strong>.</p>
      </form>
    </Modal>
  );
}
