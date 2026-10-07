import React, { useMemo } from 'react';
import { useStore } from '../core/store.jsx';
import { TODAY, iso } from '../core/shared.js';
import { DOC_TYPES, CATEGORIES, COMPANIES, LOCATIONS, assetCompliance, missingDocs, fleetExpiryRows as expiryRows } from './data.js';

const COLORS = { 'Vehicle Registration': 'var(--c-visa)', 'Motor Insurance': 'var(--c-ins)', 'Safety Certificate': 'var(--c-pp)', 'Inspection / Test Certificate': 'var(--c-eid)', 'Other Permit': 'var(--c-other)' };

export default function Reports() {
  const { state } = useStore();
  const A = state.assets;
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const d = new Date(TODAY.getFullYear(), TODAY.getMonth() + i, 1);
    const key = iso(d).slice(0, 7);
    const by = Object.fromEntries(DOC_TYPES.map((t) => [t, 0]));
    A.forEach((a) => a.docs.forEach((doc) => { if (doc.expiry?.slice(0, 7) === key) by[doc.type]++; }));
    return { label: d.toLocaleDateString('en-GB', { month: 'short' }), year: d.getFullYear(), by, total: Object.values(by).reduce((x, y) => x + y, 0) };
  }), [A]);
  const maxM = Math.max(...months.map((m) => m.total));

  const catRows = CATEGORIES.map((c) => {
    const l = A.filter((a) => a.category === c);
    const k = (key) => l.filter((a) => assetCompliance(a).key === key).length;
    return { c, n: l.length, active: l.filter((a) => a.status === 'Active').length, valid: k('valid'), due: k('due'), missing: k('missing'), expired: k('expired'), avgAge: l.length ? (l.reduce((s, a) => s + (TODAY.getFullYear() - a.year), 0) / l.length).toFixed(1) : '—' };
  });
  const tot = catRows.reduce((a, r) => ({ n: a.n + r.n, active: a.active + r.active, valid: a.valid + r.valid, due: a.due + r.due, missing: a.missing + r.missing, expired: a.expired + r.expired }), { n: 0, active: 0, valid: 0, due: 0, missing: 0, expired: 0 });
  const coRows = COMPANIES.map((c) => ({ c, n: A.filter((a) => a.company === c).length, due: new Set(expiryRows(A.filter((a) => a.company === c), 60).map((r) => r.asset.id)).size }));
  const locRows = LOCATIONS.map((l) => [l, A.filter((a) => a.location === l).length]).filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
  const maxLoc = locRows[0]?.[1] || 1;
  const pct = Math.round((tot.valid / tot.n) * 100);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Management visibility</span>
          <h1>Fleet reports</h1>
          <p className="muted">{pct}% of the fleet has every document current. Renewal workload ahead, compliance by category and where the fleet is.</p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head"><h2>Renewal workload · next 12 months</h2>
          <span className="legend small">{DOC_TYPES.map((t) => <span key={t}><i className="lg" style={{ background: COLORS[t] }} /> {t.replace(' / Test', '')}</span>)}</span>
        </div>
        <div className="colchart" role="img" aria-label="Fleet documents expiring per month over the next 12 months">
          {months.map((m, i) => (
            <div className="col" key={i} title={DOC_TYPES.map((t) => `${t}: ${m.by[t]}`).join('\n')}>
              <span className="col-val">{m.total}</span>
              <div className="col-stack" style={{ height: `${(m.total / maxM) * 100}%` }}>
                {DOC_TYPES.map((t) => m.by[t] > 0 && <span key={t} style={{ flex: m.by[t], background: COLORS[t] }} />)}
              </div>
              <span className="col-label">{m.label}{(i === 0 || m.label === 'Jan') && <b>{m.year}</b>}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel flush">
        <div className="panel-head pad"><h2>Compliance by category</h2></div>
        <div className="table-wrap">
          <table className="table num">
            <thead><tr><th>Category</th><th>Assets</th><th>Active</th><th>Avg. age (yrs)</th><th>Compliant</th><th>Renewal due</th><th>Missing docs</th><th>Expired docs</th></tr></thead>
            <tbody>{catRows.map((r) => <tr key={r.c}><td>{r.c}</td><td>{r.n}</td><td>{r.active}</td><td>{r.avgAge}</td><td>{r.valid}</td><td>{r.due || '·'}</td><td>{r.missing || '·'}</td><td className={r.expired ? 'warn-text' : ''}>{r.expired || '·'}</td></tr>)}</tbody>
            <tfoot><tr><td>Total</td><td>{tot.n}</td><td>{tot.active}</td><td /><td>{tot.valid}</td><td>{tot.due}</td><td>{tot.missing}</td><td>{tot.expired}</td></tr></tfoot>
          </table>
        </div>
      </section>

      <div className="grid-2">
        <section className="panel flush">
          <div className="panel-head pad"><h2>By registered company</h2></div>
          <div className="table-wrap"><table className="table num">
            <thead><tr><th>Company</th><th>Assets</th><th>Due ≤ 60d</th></tr></thead>
            <tbody>{coRows.map((r) => <tr key={r.c}><td>{r.c}</td><td>{r.n}</td><td>{r.due || '·'}</td></tr>)}</tbody>
          </table></div>
          <p className="muted small pad">Consistent records across group companies: assets registered to a sister concern follow the same document control.</p>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Where the fleet is</h2></div>
          <div className="bars">
            {locRows.map(([l, n]) => <div className="bar-row" key={l}><span className="bar-label">{l}</span><span className="bar-track"><span className="bar-fill bar-neutral" style={{ width: `${(n / maxLoc) * 100}%` }} /></span><span className="bar-val">{n}</span></div>)}
          </div>
          <p className="muted small">{A.filter((a) => missingDocs(a).length).length} assets have missing documents; see Fleet Documents &amp; Expiry → Missing documents.</p>
        </section>
      </div>
    </div>
  );
}
