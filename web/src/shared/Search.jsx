import React, { useEffect, useMemo, useState } from 'react';
import { useStore, takePending } from '../core/store.jsx';
import { fmt, ROLES } from '../core/shared.js';
import { canModule, scopeEmployees, scopeAssets, canSeeDoc } from '../core/access.js';
import { Icon, Avatar, StatusPill, VehicleArt, Empty } from '../core/ui.jsx';
import { empParam } from '../hr/data.js';
import { assetParam } from '../fleet/data.js';

export default function Search() {
  const { state } = useStore();
  const u = state.user;
  const [q, setQ] = useState(() => takePending('search'));
  useEffect(() => { const on = () => setQ(takePending('search')); window.addEventListener('pending-search', on); return () => window.removeEventListener('pending-search', on); }, []);
  const t = q.trim().toLowerCase();
  const hr = canModule(u, 'hr');
  const fl = canModule(u, 'fleet');
  const limited = ROLES[u.role].noDocs;

  const res = useMemo(() => {
    if (t.length < 2) return { emps: [], assets: [], docs: [] };
    const emps = scopeEmployees(u, state.employees).filter((e) => [e.id, e.id.replace(' ', ''), e.code, e.name, e.designation, ...(limited ? [] : [e.molId, e.nationality, e.mobile])].join(' ').toLowerCase().includes(t));
    const assets = scopeAssets(u, state.assets).filter((a) => [a.id, a.plate, a.vin, a.make, a.model, a.body].join(' ').toLowerCase().includes(t));
    const docs = [];
    scopeEmployees(u, state.employees).forEach((e) => e.docs.forEach((d) => { if (canSeeDoc(u, d.type) && [d.ref, d.type].join(' ').toLowerCase().includes(t) && (d.ref || '').toLowerCase().includes(t)) docs.push({ module: 'hr', owner: e, doc: d }); }));
    scopeAssets(u, state.assets).forEach((a) => a.docs.forEach((d) => { if (canSeeDoc(u, d.type) && (d.ref || '').toLowerCase().includes(t)) docs.push({ module: 'fleet', owner: a, doc: d }); }));
    return { emps, assets, docs };
  }, [t, state, u]);
  const total = res.emps.length + res.assets.length + res.docs.length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Unified search</span>
          <h1>Search</h1>
          <p className="muted">One search across {hr && fl ? 'employees, vehicles & machines and their documents' : hr ? 'employees and their documents' : 'vehicles, machines and their documents'}. Results only include what your role may see.</p>
        </div>
      </div>
      <div className="search-big">
        <Icon n="search" size={22} />
        <input id="search-q" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={[hr && 'employee ID or name', fl && 'fleet no., plate or chassis', !limited && 'document / policy no.'].filter(Boolean).join(', ')} aria-label="Search" />
        {q && <button className="icon-btn" onClick={() => setQ('')} aria-label="Clear"><Icon n="close" /></button>}
      </div>
      {t.length >= 2 && <p className="muted small">{total} result{total !== 1 ? 's' : ''} for “{q}”. Searching by expiry date, status or responsible officer? Use the <a href="#attention">Attention Centre</a> filters.</p>}
      {t.length < 2 && (
        <div className="search-tips">
          {hr && <button onClick={() => setQ('0115')}>Employee <span className="mono">0115</span></button>}
          {hr && <button onClick={() => setQ('Wickramasinghe')}>Name “Wickramasinghe”</button>}
          {fl && <button onClick={() => setQ('VH-0108')}>Fleet no. <span className="mono">VH-0108</span></button>}
          {fl && <button onClick={() => setQ('Dubai K 48210')}>Plate <span className="mono">Dubai K 48210</span></button>}
          {fl && <button onClick={() => setQ('forklift')}>Machine type “forklift”</button>}
          {!limited && <button onClick={() => setQ('POL-MV')}>Policy no. <span className="mono">POL-MV</span></button>}
        </div>
      )}
      {t.length >= 2 && total === 0 && <Empty title="No matches">Check the spelling or try part of the number, e.g. the last 4 digits.</Empty>}

      {res.emps.length > 0 && (
        <section className="panel flush"><div className="panel-head pad"><h2>Employees</h2><span className="muted small">{res.emps.length}</span></div>
          <ul className="result-list">{res.emps.slice(0, 20).map((e) => (
            <li key={e.id}><a href={`#hr-employee.${empParam(e.id)}`}><Avatar name={e.name} size={34} photo={e.photo} /><span className="who"><strong>{e.name}</strong><small className="mono">{e.id} · {e.designation} · {e.department}</small></span><Icon n="arrow" size={16} /></a></li>
          ))}</ul>
        </section>
      )}
      {res.assets.length > 0 && (
        <section className="panel flush"><div className="panel-head pad"><h2>Vehicles &amp; machines</h2><span className="muted small">{res.assets.length}</span></div>
          <ul className="result-list">{res.assets.slice(0, 20).map((a) => (
            <li key={a.id}><a href={`#fleet-vehicle.${assetParam(a.id)}`}><span className="art-chip"><VehicleArt category={a.category} size={34} /></span><span className="who"><strong className="mono">{a.id}</strong><small>{a.make} {a.model} · {a.plate || a.vin} · {a.location}</small></span><Icon n="arrow" size={16} /></a></li>
          ))}</ul>
        </section>
      )}
      {res.docs.length > 0 && (
        <section className="panel flush"><div className="panel-head pad"><h2>Documents</h2><span className="muted small">{res.docs.length}</span></div>
          <ul className="result-list">{res.docs.slice(0, 20).map((r, i) => (
            <li key={i}><a href={r.module === 'hr' ? `#hr-employee.${empParam(r.owner.id)}` : `#fleet-vehicle.${assetParam(r.owner.id)}`}><Icon n="docs" size={22} /><span className="who"><strong>{r.doc.name || r.doc.type} · <span className="mono">{r.doc.ref}</span></strong><small>{r.owner.id} · {r.owner.name || `${r.owner.make} ${r.owner.model}`} · exp. {fmt(r.doc.expiry)}</small></span><StatusPill doc={r.doc} /></a></li>
          ))}</ul>
        </section>
      )}
    </div>
  );
}
