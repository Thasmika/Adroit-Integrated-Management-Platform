import React, { useEffect, useMemo, useState } from 'react';
import { useStore, go } from '../core/store.jsx';
import { docStatus, docCfg } from '../core/shared.js';
import { scopeAssets, canSeeDoc, can } from '../core/access.js';
import { CATEGORIES, CAT_SHORT, DEPARTMENTS, LOCATIONS, COMPANIES, STATUSES, DOC_TYPES, DOC_SHORT, REQUIRED, expiryState, assetCompliance, catSlug, assetParam, isGroup } from './data.js';
import { Icon, VehicleArt } from '../core/ui.jsx';

const PAGE = 20;
const COMP_PILL = { valid: 'valid', due: 'due', missing: 'missing', expired: 'expired' };

export default function Fleet({ initialCat }) {
  const { state } = useStore();
  const u = state.user;
  const fromParam = (p) => CATEGORIES.find((c) => catSlug(c) === p) || '';
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(() => fromParam(initialCat));
  const [dept, setDept] = useState('');
  const [loc, setLoc] = useState('');
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState('');
  const [comp, setComp] = useState(initialCat === 'compliant' ? 'valid' : '');
  const [page, setPage] = useState(0);

  useEffect(() => { if (initialCat === 'compliant') { setComp('valid'); setCat(''); } else if (initialCat) setCat(fromParam(initialCat)); setPage(0); }, [initialCat]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return scopeAssets(u, state.assets).filter((a) => {
      if (cat && a.category !== cat) return false;
      if (dept && a.department !== dept) return false;
      if (loc && a.location !== loc) return false;
      if (company && a.company !== company) return false;
      if (status && a.status !== status) return false;
      if (comp && assetCompliance(a).key !== comp) return false;
      if (!t) return true;
      return [a.id, a.plate, a.vin, a.engine, a.make, a.model, a.body, a.company, a.location, a.department, ...a.docs.map((d) => d.ref)].join(' ').toLowerCase().includes(t);
    });
  }, [state.assets, q, cat, dept, loc, company, status, comp]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const view = rows.slice(page * PAGE, (page + 1) * PAGE);
  const any = q || cat || dept || loc || company || status || comp;
  const reset = () => { setQ(''); setCat(''); setDept(''); setLoc(''); setCompany(''); setStatus(''); setComp(''); setPage(0); };
  const f = (setter) => (e) => { setter(e.target.value); setPage(0); };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Fleet Master</span>
          <h1>Vehicles &amp; machines</h1>
          <p className="muted">Central register of all company heavy vehicles, light vehicles, trailers and machines.</p>
        </div>
        {can(u, 'editAsset') && <div className="head-actions"><a className="btn" href="#fleet-import"><Icon n="upload" size={16} /> Import CSV</a><button className="btn btn-primary" onClick={() => go('fleet-new')}><Icon n="plus" size={16} /> Add vehicle / machine</button></div>}
      </div>

      <div className="cat-tabs" role="group" aria-label="Category">
        <button className={!cat ? 'on' : ''} onClick={() => { setCat(''); setPage(0); }}><strong>{state.assets.length}</strong><span>All assets</span></button>
        {CATEGORIES.map((c) => (
          <button key={c} className={cat === c ? 'on' : ''} onClick={() => { setCat(c); setPage(0); }}>
            <VehicleArt category={c} size={34} />
            <strong>{state.assets.filter((a) => a.category === c).length}</strong><span>{c}</span>
          </button>
        ))}
      </div>

      <div className="filters">
        <div className="search-box">
          <Icon n="search" />
          <input id="fleet-search" value={q} onChange={f(setQ)} placeholder="Fleet no., plate, chassis, make, policy no.…" aria-label="Search fleet" />
        </div>
        <select id="f-dept" value={dept} onChange={f(setDept)} aria-label="Department"><option value="">All departments</option>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select>
        <select id="f-loc" value={loc} onChange={f(setLoc)} aria-label="Location"><option value="">All locations</option>{LOCATIONS.map((d) => <option key={d}>{d}</option>)}</select>
        <select id="f-co" value={company} onChange={f(setCompany)} aria-label="Registered company"><option value="">Any registered company</option>{COMPANIES.map((d) => <option key={d}>{d}</option>)}</select>
        <select id="f-status" value={status} onChange={f(setStatus)} aria-label="Operational status"><option value="">Any status</option>{STATUSES.map((d) => <option key={d}>{d}</option>)}</select>
        <select id="f-comp" value={comp} onChange={f(setComp)} aria-label="Document compliance">
          <option value="">Any compliance</option><option value="valid">Compliant</option><option value="due">Renewal due ≤ 60 days</option><option value="missing">Missing document</option><option value="expired">Expired document</option>
        </select>
        {any && <button className="btn btn-ghost" onClick={reset}>Clear</button>}
      </div>

      <section className="panel flush">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Asset</th><th>Category</th><th>Plate / serial</th><th>Registered company</th><th>Department · location</th><th>Status</th><th>Documents</th></tr></thead>
            <tbody>
              {view.map((a) => {
                const c = assetCompliance(a);
                return (
                  <tr key={a.id} className="clickable" onClick={() => go('fleet-vehicle', assetParam(a.id))}>
                    <td>
                      <div className="who-row">
                        <span className="art-chip"><VehicleArt category={a.category} size={36} /></span>
                        <div className="who"><a href={'#fleet-vehicle.' + assetParam(a.id)} onClick={(e) => e.stopPropagation()}><strong className="mono">{a.id}</strong></a><small>{a.make} {a.model} · {a.year}</small></div>
                      </div>
                    </td>
                    <td>{CAT_SHORT[a.category]}<small className="block muted">{a.body}</small></td>
                    <td className="mono nowrap">{a.plate || <span className="muted">{a.vin}</span>}</td>
                    <td>{!isGroup(a.company) ? 'Adroit' : <span className="tag">{a.company.replace(' L.L.C', '')}</span>}</td>
                    <td>{a.department.replace(' Department', '')}<small className="block muted">{a.location}</small></td>
                    <td><span className={'pill pill-' + (a.status === 'Active' ? 'valid' : ['Off-road', 'Inactive', 'Disposed'].includes(a.status) ? 'missing' : a.status === 'Under Repair' ? 'due' : 'info')}>{a.status}</span></td>
                    <td>
                      <div className="dots">
                        {DOC_TYPES.map((t) => {
                          const d = a.docs.find((x) => x.type === t);
                          const req = (docCfg(t).requiredFor || []).includes(a.category);
                          if (!canSeeDoc(u, t)) return null;
                          if (!d && !req) return null;
                          const k = !d || !d.file ? 'missing' : expiryState(d);
                          return <span key={t} className={'dot-chip dc-' + k} title={`${t}: ${docStatus(d).label}`}>{DOC_SHORT[t]}</span>;
                        })}
                      </div>
                      <small className={'comp comp-' + COMP_PILL[c.key]}>{c.label}</small>
                    </td>
                  </tr>
                );
              })}
              {view.length === 0 && <tr><td colSpan={7} className="empty-cell">No assets match these filters. <button className="link" onClick={reset}>Clear filters</button></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="pager">
          <span className="muted small">Showing {rows.length ? page * PAGE + 1 : 0}–{Math.min(rows.length, (page + 1) * PAGE)} of {rows.length}</span>
          <div className="pager-btns">
            <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
            <span className="small">Page {page + 1} / {pages}</span>
            <button className="btn btn-sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      </section>
      <p className="legend small muted">
        Document chips: <span className="dot-chip dc-valid">OK</span> valid · <span className="dot-chip dc-monitor">MON</span> monitor · <span className="dot-chip dc-due">DUE</span> renewal due · <span className="dot-chip dc-critical">URG</span> urgent · <span className="dot-chip dc-expired">EXP</span> expired · <span className="dot-chip dc-missing">—</span> no scan / not recorded
      </p>
    </div>
  );
}
