import React, { useEffect, useState } from 'react';
import { useStore } from '../core/store.jsx';
import { fmtStamp } from '../core/shared.js';
import { Icon } from '../core/ui.jsx';

const PAGE = 100;

export default function Audit() {
  const { act } = useStore();
  const [f, setF] = useState({ q: '', user: '', action: '', entity: '', from: '', to: '' });
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setPage(0); };
  useEffect(() => {
    const t = setTimeout(() => {
      act.audit({ ...f, limit: PAGE, offset: page * PAGE }).then((d) => { setData(d); setErr(''); }).catch((x) => setErr(x.message));
    }, 250);
    return () => clearTimeout(t);
  }, [f, page]);
  const fc = data?.facets || {};
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Audit trail</span>
          <h1>Audit log</h1>
          <p className="muted">Who did what and when: record changes, uploads and document views, approvals, renewals, configuration changes, AI questions and sign-ins. The database refuses edits or deletions of these entries.</p>
        </div>
      </div>
      <section className="panel flush">
        <div className="panel-tools">
          <div className="search-box"><Icon n="search" /><input id="au-q" value={f.q} onChange={set('q')} placeholder="Record or detail, e.g. EMP 0115, VH-0108" aria-label="Search audit log" /></div>
          <select id="au-user" value={f.user} onChange={set('user')} aria-label="User"><option value="">All users</option>{(fc.users || []).filter(Boolean).sort().map((x) => <option key={x}>{x}</option>)}</select>
          <select id="au-act" value={f.action} onChange={set('action')} aria-label="Action"><option value="">All actions</option>{(fc.actions || []).filter(Boolean).sort().map((x) => <option key={x}>{x}</option>)}</select>
          <select id="au-ent" value={f.entity} onChange={set('entity')} aria-label="Record type"><option value="">All record types</option>{(fc.entities || []).filter(Boolean).sort().map((x) => <option key={x}>{x}</option>)}</select>
          <label className="small muted">From <input id="au-from" type="date" value={f.from} onChange={set('from')} /></label>
          <label className="small muted">To <input id="au-to" type="date" value={f.to} onChange={set('to')} /></label>
        </div>
        {err && <p className="error pad">{err}</p>}
        <div className="table-wrap"><table className="table">
          <thead><tr><th>When</th><th>User</th><th>Action</th><th>Record type</th><th>Record</th><th>Detail (before → after)</th></tr></thead>
          <tbody>
            {(data?.items || []).map((a) => (
              <tr key={a.id}>
                <td className="mono small nowrap">{fmtStamp(a.at)}</td>
                <td className="small"><strong>{a.user}</strong><span className="block muted">{a.role}</span></td>
                <td><span className={'act act-' + a.action.split(' ')[0].toLowerCase()}>{a.action}</span></td>
                <td className="small">{a.entity}</td>
                <td className="mono small">{a.record}</td>
                <td className="small">{a.detail}</td>
              </tr>
            ))}
            {data && data.items.length === 0 && <tr><td colSpan={6} className="empty-cell">No audit events match.</td></tr>}
            {!data && !err && <tr><td colSpan={6} className="empty-cell">Loading…</td></tr>}
          </tbody>
        </table></div>
        <div className="pager">
          <span className="muted small">{data ? `${data.total.toLocaleString()} events` : ''}</span>
          <div className="pager-btns">
            <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Newer</button>
            <span className="small">Page {page + 1} / {pages}</span>
            <button className="btn btn-sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Older</button>
          </div>
        </div>
      </section>
    </div>
  );
}
