// Controlled data migration (§16): validate first, then import; every row is accepted or rejected with a reason.
import React, { useEffect, useState } from 'react';
import { useStore } from '../core/store.jsx';
import { fmtStamp } from '../core/shared.js';
import { Icon } from '../core/ui.jsx';

export default function Import({ kind }) {
  const { act, notify } = useStore();
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [batches, setBatches] = useState([]);
  const label = kind === 'employees' ? 'employees' : 'vehicles & machines';
  const back = kind === 'employees' ? '#hr-employees' : '#fleet-master';
  const loadBatches = () => act.importBatches().then((b) => setBatches(b.items.filter((x) => x.kind === kind))).catch(() => {});
  useEffect(() => { loadBatches(); }, [kind]);
  const send = async (mode) => {
    if (!file) { setErr('Choose a CSV file first.'); return; }
    setBusy(mode); setErr('');
    try {
      const r = await act.importCsv(kind, mode, file);
      setResult(r);
      if (mode === 'commit') { notify(`${r.accepted} ${label} imported, ${r.rejected} rejected`); await act.refresh(); }
      loadBatches();
    } catch (x) { setErr(x.message); }
    setBusy('');
  };
  return (
    <div className="page">
      <a className="back" href={back}><Icon n="back" size={16} /> Back</a>
      <div className="page-head">
        <div><span className="eyebrow">Data migration</span><h1>Import {label}</h1>
          <p className="muted">Upload a CSV, check it with <strong>Validate</strong>, fix any rejected rows, then <strong>Import</strong>. Take a database backup before a large import. Rows that fail are never imported.</p></div>
        <div className="head-actions"><a className="btn" href={`/api/import/template/${kind}`}><Icon n="docs" size={16} /> Download CSV template</a></div>
      </div>
      <section className="panel">
        <div className="form-grid">
          <label className="drop span-2">
            <input id="imp-file" type="file" accept=".csv,text/csv" onChange={(e) => { setFile(e.target.files[0] || null); setResult(null); setErr(''); }} />
            <span>{file ? `${file.name} · ${Math.round(file.size / 1024)} KB` : 'Choose a CSV file (UTF-8, first row = column names)'}</span>
          </label>
        </div>
        <p className="field-hint">Dates as YYYY-MM-DD or DD/MM/YYYY. Department, location, company{kind === 'assets' ? ' and category' : ' and sponsor'} must match the names in Administration exactly. Leave the {kind === 'employees' ? 'emp_no' : 'fleet_no'} column empty to have numbers assigned.</p>
        {err && <p className="error" role="alert">{err}</p>}
        <div className="btn-row">
          <button className="btn" onClick={() => send('validate')} disabled={!!busy}>{busy === 'validate' ? 'Checking…' : 'Validate'}</button>
          <button className="btn btn-primary" onClick={() => send('commit')} disabled={!!busy || !result || result.mode !== 'validate' || result.accepted === 0}>{busy === 'commit' ? 'Importing…' : `Import ${result?.mode === 'validate' ? result.accepted : ''} valid rows`}</button>
        </div>
      </section>
      {result && (
        <section className="panel flush">
          <div className="panel-head pad"><h2>{result.mode === 'commit' ? 'Import result' : 'Validation result'} · batch {result.batchId}</h2>
            <span className="small"><strong>{result.total}</strong> rows · <span className="c-valid"><strong>{result.accepted}</strong> {result.mode === 'commit' ? 'imported' : 'valid'}</span> · <span className="c-expired"><strong>{result.rejected}</strong> rejected</span>{result.mode === 'commit' && <> · {result.recordsInSystem} {label} now in the system</>}</span></div>
          <div className="table-wrap"><table className="table import-log">
            <thead><tr><th>Line</th><th>Record</th><th>Result</th><th>Reason</th></tr></thead>
            <tbody>{result.log.map((l) => <tr key={l.line}><td className="mono">{l.line}</td><td>{l.key}</td><td><span className={'pill pill-' + (l.status === 'accepted' ? 'valid' : 'expired')}>{l.status}</span></td><td className="small">{l.errors.join('; ') || '—'}</td></tr>)}</tbody>
          </table></div>
        </section>
      )}
      {batches.length > 0 && (
        <section className="panel flush">
          <div className="panel-head pad"><h2>Previous batches</h2></div>
          <div className="table-wrap"><table className="table num">
            <thead><tr><th>Batch</th><th>When</th><th>By</th><th>File</th><th>Mode</th><th>Rows</th><th>Accepted</th><th>Rejected</th></tr></thead>
            <tbody>{batches.map((b) => <tr key={b.id}><td>{b.id}</td><td className="small">{fmtStamp(b.at)}</td><td>{b.uploaded_by}</td><td className="small">{b.file_name}</td><td>{b.mode}</td><td>{b.total}</td><td>{b.accepted}</td><td>{b.rejected}</td></tr>)}</tbody>
          </table></div>
        </section>
      )}
    </div>
  );
}
