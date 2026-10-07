import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../core/store.jsx';
import { fmt, officerFor, actionStatus, docTypes } from '../core/shared.js';
import { scopeAssets, canSeeDoc, can } from '../core/access.js';
import { Icon, Tabs, StatusPill, DocViewer, Avatar, Empty, VehicleArt, ActionPill } from '../core/ui.jsx';
import { UploadDocModal, RenewalActionModal } from '../core/docModals.jsx';
import { fleetExpiryRows as expiryRows, CATEGORIES, CAT_SHORT, missingDocs, expiryState, assetParam } from './data.js';

const TABS = ['expiry', 'alerts', 'library', 'missing'];

export default function Documents({ initialTab }) {
  const { state } = useStore();
  const [tab, setTab] = useState(TABS.includes(initialTab) ? initialTab : 'expiry');
  useEffect(() => { if (TABS.includes(initialTab)) setTab(initialTab); }, [initialTab]);
  const [win, setWin] = useState(60);
  const DOC_TYPES = docTypes('fleet').map((t) => t.key).filter((t) => canSeeDoc(state.user, t));
  const [types, setTypes] = useState(DOC_TYPES);
  const [company, setCompany] = useState('');
  const [loc, setLoc] = useState('');
  const [act, setAct] = useState('');
  const [cat, setCat] = useState('');
  const [officer, setOfficer] = useState('');
  const [q, setQ] = useState('');
  const [libType, setLibType] = useState('');
  const [viewing, setViewing] = useState(null);
  const [upload, setUpload] = useState(null);
  const [tracking, setTracking] = useState(null);

  const u = state.user;
  const A = scopeAssets(u, state.assets).filter((a) => !['Disposed', 'Inactive'].includes(a.status)).map((a) => ({ ...a, docs: a.docs.filter((d) => canSeeDoc(u, d.type)) }));
  const OFFICERS = state.config.users.filter((x) => docTypes('fleet').some((t) => t.officer === x.id)).map((x) => ({ ...x, handles: docTypes('fleet').filter((t) => t.officer === x.id).map((t) => t.key) }));
  const me = OFFICERS.find((o) => o.id === u.id);
  const all90 = expiryRows(A, 90);
  const count = (k) => all90.filter((r) => expiryState(r.doc) === k).length;
  const missing = useMemo(() => { const out = []; A.forEach((a) => missingDocs(a).forEach((m) => { if (canSeeDoc(u, m.type)) out.push({ asset: a, ...m }); })); return out; }, [A]);
  const rows = expiryRows(A, win, types).filter((r) => (!cat || r.asset.category === cat) && (!officer || r.officer.id === officer) && (!company || r.asset.company === company) && (!loc || r.asset.location === loc) && (!act || actionStatus(r.doc) === act));
  const mine = expiryRows(A, 60).filter((r) => !me || r.officer.id === me.id);
  const lib = useMemo(() => {
    const t = q.trim().toLowerCase();
    const out = [];
    A.forEach((a) => {
      if (t && !`${a.id} ${a.plate} ${a.vin} ${a.make} ${a.model} ${a.docs.map((d) => d.ref).join(' ')}`.toLowerCase().includes(t)) return;
      a.docs.forEach((d) => { if (d.file && (!libType || d.type === libType)) out.push({ asset: a, doc: d }); });
    });
    return out;
  }, [A, q, libType]);

  const fresh = (r) => state.assets.find((a) => a.id === r.asset.id).docs.find((d) => d.type === r.doc.type);
  const freshAsset = (id) => state.assets.find((a) => a.id === id);

  const ExpiryTable = ({ list, showOfficer = true }) => (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Asset</th><th>Document</th><th>Expiry</th><th>Status</th><th>Action tracking</th><th className="right">Action</th></tr></thead>
        <tbody>
          {list.map((r, i) => (
            <tr key={r.asset.id + r.doc.type + i}>
              <td><a className="who-row" href={'#fleet-vehicle.' + assetParam(r.asset.id)}><span className="art-chip"><VehicleArt category={r.asset.category} size={30} /></span><span className="who"><strong className="mono">{r.asset.id}</strong><small>{r.asset.plate || r.asset.body} · {CAT_SHORT[r.asset.category]}</small></span></a></td>
              <td>{r.doc.name}<small className="block muted mono">{r.doc.ref}</small></td>
              <td className="mono nowrap">{fmt(r.doc.expiry)}</td>
              <td><StatusPill doc={r.doc} /></td>
              <td className="small"><ActionPill status={actionStatus(r.doc)} />{showOfficer && <span className="block muted">{r.officer.name}</span>}{!showOfficer && r.doc.renewal && <span className="block muted">{r.doc.renewal.by} · {fmt(r.doc.renewal.date)}</span>}</td>
              <td className="right nowrap actions">
                {r.doc.file && <button className="btn btn-sm btn-ghost" onClick={() => setViewing(r)} aria-label="View scan"><Icon n="eye" size={14} /></button>}
                {can(u, 'uploadDoc', { type: r.doc.type }) && <><button className="btn btn-sm" onClick={() => setTracking(r)}>Action</button>
                <button className="btn btn-sm btn-primary" onClick={() => setUpload({ asset: r.asset, type: r.doc.type, mode: 'renew' })}>Renew</button></>}
              </td>
            </tr>
          ))}
          {list.length === 0 && <tr><td colSpan={6} className="empty-cell">Nothing expires in this window.</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Vehicle Document Centre</span>
          <h1>Fleet Documents &amp; Expiry</h1>
          <p className="muted">Registration, insurance, safety and inspection certificates and permits, linked to each vehicle with their scanned copies.</p>
        </div>
      </div>

      <section className="status-row five">
        <button className="status-card sc-expired" onClick={() => { setTab('expiry'); setWin(0); }}><strong>{count('expired')}</strong><span>Expired</span></button>
        <button className="status-card sc-critical" onClick={() => { setTab('expiry'); setWin(30); }}><strong>{count('critical')}</strong><span>Urgent · ≤ 30 days</span></button>
        <button className="status-card sc-due" onClick={() => { setTab('expiry'); setWin(60); }}><strong>{count('due')}</strong><span>Renewal due · 31–60</span></button>
        <button className="status-card sc-monitor" onClick={() => { setTab('expiry'); setWin(90); }}><strong>{count('monitor')}</strong><span>Monitor · 61–90</span></button>
        <button className="status-card sc-missing" onClick={() => setTab('missing')}><strong>{missing.length}</strong><span>Missing / no scan</span></button>
      </section>

      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'expiry', label: 'Expiry Centre' },
        { key: 'alerts', label: me ? 'Assigned to me' : 'Alerts by officer', count: mine.length },
        { key: 'library', label: 'Document library' },
        { key: 'missing', label: 'Missing documents', count: missing.length },
      ]} />

      {tab === 'expiry' && (
        <section className="panel flush">
          <div className="panel-tools">
            <div className="seg" role="group" aria-label="Expiry window">
              {[[0, 'Expired'], [30, '30 days'], [60, '60 days'], [90, '90 days'], [180, '6 months']].map(([d, l]) => <button key={d} className={win === d ? 'on' : ''} onClick={() => setWin(d)}>{l}</button>)}
            </div>
            <div className="chips">
              {DOC_TYPES.map((t) => <button key={t} className={'chip' + (types.includes(t) ? ' on' : '')} aria-pressed={types.includes(t)} onClick={() => setTypes(types.includes(t) ? types.filter((x) => x !== t) : [...types, t])}>{t.replace(' / Test', '')}</button>)}
            </div>
            <select id="ex-cat" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category"><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            <select id="ex-off" value={officer} onChange={(e) => setOfficer(e.target.value)} aria-label="Responsible officer"><option value="">All officers</option>{OFFICERS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
            <select id="ex-act" value={act} onChange={(e) => setAct(e.target.value)} aria-label="Action status"><option value="">Any action status</option>{['Open', 'In Progress', 'Submitted to authority', 'Awaiting payment', 'On hold'].map((x) => <option key={x}>{x}</option>)}</select>
            <select id="ex-co" value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Registered company"><option value="">Any registered company</option>{state.config.companies.map((c) => <option key={c.id} value={c.name}>{c.short}</option>)}</select>
            <select id="ex-loc" value={loc} onChange={(e) => setLoc(e.target.value)} aria-label="Location"><option value="">All locations</option>{state.config.locations.map((l) => <option key={l.id}>{l.name}</option>)}</select>
          </div>
          <ExpiryTable list={rows} />
          <div className="pager"><span className="muted small">{rows.length} documents {win === 0 ? 'already expired' : `expired or expiring within ${win} days`}</span></div>
        </section>
      )}

      {tab === 'alerts' && (
        <div className="stack">
          <div className="officer-cards">
            {OFFICERS.map((o) => (
              <div key={o.id} className={'officer' + (me?.id === o.id ? ' on' : '')}>
                <Avatar name={o.name} size={40} />
                <div><strong>{o.name}</strong><small>{o.handles.join(', ')}</small></div>
                <span className="officer-n">{expiryRows(A, 60).filter((r) => r.officer.id === o.id).length}</span>
              </div>
            ))}
          </div>
          <section className="panel flush">
            <div className="panel-head pad"><h2>{me ? 'Assigned to you' : 'All routed alerts'} · next 60 days</h2><span className="muted small">Alerts go out 90, 60, 30 and 7 days before expiry, then daily once expired.</span></div>
            <ExpiryTable list={mine} showOfficer={!me} />
          </section>
        </div>
      )}

      {tab === 'library' && (
        <section className="panel flush">
          <div className="panel-tools">
            <div className="search-box grow"><Icon n="search" /><input id="lib-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Fleet no., plate, chassis or document reference" aria-label="Search documents" /></div>
            <select id="lib-type" value={libType} onChange={(e) => setLibType(e.target.value)} aria-label="Document type"><option value="">All document types</option>{DOC_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            {DOC_TYPES.some((t) => can(u, 'uploadDoc', { type: t })) && <button className="btn btn-primary" onClick={() => setUpload({ pick: true })}><Icon n="upload" size={16} /> Upload document</button>}
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Asset</th><th>Document</th><th>File</th><th>Expiry</th><th>Status</th><th className="right">Open</th></tr></thead>
              <tbody>
                {lib.slice(0, 60).map((r, i) => (
                  <tr key={i}>
                    <td><a className="who" href={'#fleet-vehicle.' + assetParam(r.asset.id)}><strong className="mono">{r.asset.id}</strong><small>{r.asset.make} {r.asset.model}</small></a></td>
                    <td>{r.doc.name}<small className="block muted mono">{r.doc.ref}</small></td>
                    <td className="small mono">{r.doc.file.name}<br /><span className="muted">{r.doc.file.size}</span></td>
                    <td className="mono nowrap">{fmt(r.doc.expiry)}</td>
                    <td><StatusPill doc={r.doc} /></td>
                    <td className="right"><button className="btn btn-sm" onClick={() => setViewing(r)}><Icon n="eye" size={14} /> View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager"><span className="muted small">{lib.length} scanned documents{lib.length > 60 ? ' · showing first 60, refine the search to narrow down' : ''}</span></div>
        </section>
      )}

      {tab === 'missing' && (
        <section className="panel flush">
          {missing.length === 0 ? <Empty title="Every required document is recorded with a scan" /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Asset</th><th>Category</th><th>Document</th><th>Problem</th><th className="right">Action</th></tr></thead>
                <tbody>
                  {missing.map((m, i) => (
                    <tr key={i}>
                      <td><a className="who" href={'#fleet-vehicle.' + assetParam(m.asset.id)}><strong className="mono">{m.asset.id}</strong><small>{m.asset.make} {m.asset.model} · {m.asset.plate || m.asset.body}</small></a></td>
                      <td>{m.asset.category}</td>
                      <td>{m.doc?.name || m.type}</td>
                      <td><span className="pill pill-missing">{m.recorded ? 'Recorded, no scanned copy' : 'Required, not recorded'}</span></td>
                      <td className="right">{can(u, 'uploadDoc', { type: m.type }) && <button className="btn btn-sm btn-primary" onClick={() => setUpload({ asset: m.asset, type: m.type, mode: 'upload' })}><Icon n={m.recorded ? 'upload' : 'plus'} size={14} /> {m.recorded ? 'Upload scan' : 'Record'}</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {viewing && <DocViewer owner={freshAsset(viewing.asset.id)} module="fleet" doc={fresh(viewing)} onClose={() => setViewing(null)} />}
      {tracking && <RenewalActionModal module="fleet" owner={freshAsset(tracking.asset.id)} doc={fresh(tracking)} onClose={() => setTracking(null)} />}
      {upload?.pick && <PickAsset onPick={(a) => setUpload({ asset: a, type: null, mode: 'upload' })} onClose={() => setUpload(null)} />}
      {upload && !upload.pick && <UploadDocModal module="fleet" owner={freshAsset(upload.asset.id)} docType={upload.type} mode={upload.mode} onClose={() => setUpload(null)} />}
    </div>
  );
}

function PickAsset({ onPick, onClose }) {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  const list = scopeAssets(state.user, state.assets).filter((a) => !t || `${a.id} ${a.plate} ${a.make} ${a.model} ${a.vin}`.toLowerCase().includes(t)).slice(0, 8);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Choose asset">
        <div className="modal-head"><h3>Which vehicle or machine?</h3><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon n="close" /></button></div>
        <div className="modal-body stack">
          <div className="search-box grow"><Icon n="search" /><input id="pick-q" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Fleet no., plate, make…" /></div>
          <ul className="pick-list">
            {list.map((a) => <li key={a.id}><button onClick={() => onPick(a)}><VehicleArt category={a.category} size={34} /><span className="who"><strong className="mono">{a.id}</strong><small>{a.make} {a.model} · {a.plate || a.body}</small></span></button></li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
