import React, { useState } from 'react';
import { useStore, go, setPending } from '../core/store.jsx';
import { TODAY, fmt } from '../core/shared.js';
import { scopeAssets, visibleDocs, can } from '../core/access.js';
import { fleetExpiryRows as expiryRows, DOC_TYPES, CATEGORIES, missingDocs, assetCompliance, assetName, catSlug, assetParam } from './data.js';
import { Icon, StatusPill, VehicleArt } from '../core/ui.jsx';

export default function Dashboard() {
  const { state } = useStore();
  const u = state.user;
  const [ask, setAsk] = useState('');
  const A = scopeAssets(u, state.assets).filter((a) => !['Disposed', 'Inactive'].includes(a.status)).map((a) => ({ ...a, docs: visibleDocs(u, a.docs) }));
  const within60 = expiryRows(A, 60);
  const expAssets = new Set(within60.map((r) => r.asset.id));
  const missAssets = A.filter((a) => missingDocs(a).length);
  const comp = A.filter((a) => assetCompliance(a).key === 'valid');
  const byType = [
    ['Registration expiry', ['Vehicle Registration']],
    ['Insurance expiry', ['Motor Insurance']],
    ['Safety certificate expiry', ['Safety Certificate']],
    ['Other permits / certificates', ['Inspection / Test Certificate', 'Other Permit']],
  ].map(([label, types]) => ({ label, n: new Set(within60.filter((r) => types.includes(r.doc.type)).map((r) => r.asset.id)).size }));
  const maxT = Math.max(1, ...byType.map((x) => x.n));
  const inProgress = [];
  A.forEach((a) => a.docs.forEach((d) => { if (d.renewal) inProgress.push({ a, d }); }));
  const byCat = CATEGORIES.map((c) => {
    const l = A.filter((a) => a.category === c);
    const k = (key) => l.filter((a) => assetCompliance(a).key === key).length;
    return { c, n: l.length, valid: k('valid'), due: k('due'), missing: k('missing'), expired: k('expired') };
  });
  const maxC = Math.max(...byCat.map((x) => x.n));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Vehicle &amp; Equipment Management</span>
          <h1>Fleet Dashboard</h1>
          <p className="muted">Overall condition of fleet documents across {A.length} vehicles and machines.</p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => go('fleet-documents', 'library')}><Icon n="upload" size={16} /> Upload / view document</button>
          {can(u, 'editAsset') && <button className="btn btn-primary" onClick={() => go('fleet-new')}><Icon n="plus" size={16} /> Add vehicle / machine</button>}
        </div>
      </div>

      <section className="kpis">
        <button className="kpi" onClick={() => go('fleet-master')}>
          <span className="kpi-label">Total assets</span><span className="kpi-num">{A.length}</span><span className="kpi-sub">vehicles &amp; machines</span>
        </button>
        <button className="kpi kpi-warn" onClick={() => go('fleet-documents', 'expiry')}>
          <span className="kpi-label">Expiring ≤ 60 days</span><span className="kpi-num">{expAssets.size}</span><span className="kpi-sub">assets · registration / insurance / safety</span>
        </button>
        <button className="kpi kpi-crit" onClick={() => go('fleet-documents', 'missing')}>
          <span className="kpi-label">Documents missing</span><span className="kpi-num">{missAssets.length}</span><span className="kpi-sub">assets require completion</span>
        </button>
        <button className="kpi kpi-ok" onClick={() => go('fleet-master', 'compliant')}>
          <span className="kpi-label">Compliant assets</span><span className="kpi-num">{comp.length}</span><span className="kpi-sub">all documents current</span>
        </button>
      </section>

      <form className="ask" onSubmit={(e) => { e.preventDefault(); setPending('ask', ask); go('assistant'); }}>
        <Icon n="ai" />
        <input id="dash-ask" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder='Ask Fleet AI: "Show all heavy vehicles whose insurance or registration expires within the next 60 days"' aria-label="Ask the fleet assistant" />
        <button className="btn btn-primary" type="submit">Ask</button>
      </form>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><h2>Documents requiring attention</h2><a href="#fleet-documents.expiry" className="link">Open Expiry Centre <Icon n="arrow" size={14} /></a></div>
          <div className="bars">
            {byType.map(({ label, n }) => (
              <div className="bar-row wide-l" key={label}>
                <span className="bar-label">{label}</span>
                <span className="bar-track"><span className="bar-fill" style={{ width: `${(n / maxT) * 100}%` }} /></span>
                <span className="bar-val">{n}</span>
              </div>
            ))}
          </div>
          <div className="table-wrap">
            <table className="table compact">
              <thead><tr><th>Asset</th><th>Document</th><th>Expiry</th><th>Status</th></tr></thead>
              <tbody>
                {within60.slice(0, 8).map((r, i) => (
                  <tr key={i} className="clickable" onClick={() => go('fleet-vehicle', assetParam(r.asset.id))}>
                    <td><div className="who"><strong className="mono">{r.asset.id}</strong><small>{assetName(r.asset)} · {r.asset.plate || r.asset.body}</small></div></td>
                    <td>{r.doc.name}</td>
                    <td className="mono nowrap">{fmt(r.doc.expiry)}</td>
                    <td><StatusPill doc={r.doc} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="stack">
          <section className="panel">
            <div className="panel-head"><h2>Quick actions</h2></div>
            <div className="quick">
              {can(u, 'editAsset') && <button onClick={() => go('fleet-new')}><Icon n="plus" /> Add vehicle / machine</button>}
              <button onClick={() => go('search')}><Icon n="search" /> Search fleet / documents</button>
              <button onClick={() => go('fleet-documents', 'expiry')}><Icon n="bell" /> Open Expiry Centre</button>
              <button onClick={() => go('fleet-documents', 'library')}><Icon n="upload" /> Upload / view document</button>
              <button onClick={() => go('assistant')}><Icon n="ai" /> Ask Fleet AI Assistant</button>
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Renewals in progress</h2><span className="muted small">{inProgress.length}</span></div>
            <ul className="follow">
              {inProgress.slice(0, 6).map(({ a, d }) => (
                <li key={a.id + d.type}><a href={'#fleet-vehicle.' + assetParam(a.id)}><span><strong className="mono">{a.id}</strong> · {d.name}<br /><small className="muted">{d.renewal.note} · {d.renewal.by}</small></span><StatusPill doc={d} /></a></li>
              ))}
              {inProgress.length === 0 && <li className="muted small">No renewals are being tracked.</li>}
            </ul>
          </section>
        </div>
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><h2>Fleet by category</h2>
            <span className="legend small"><span><i className="lg lg-valid" /> compliant</span><span><i className="lg lg-due" /> renewal due</span><span><i className="lg lg-missing" /> missing</span><span><i className="lg lg-expired" /> expired</span></span>
          </div>
          <div className="cat-rows">
            {byCat.map((r) => (
              <button className="cat-row" key={r.c} onClick={() => go('fleet-master', catSlug(r.c))}>
                <VehicleArt category={r.c} size={46} />
                <span className="cat-name"><strong>{r.c}</strong><small>{r.n} assets</small></span>
                <span className="stackbar" style={{ width: `${(r.n / maxC) * 100}%` }}>
                  {['valid', 'due', 'missing', 'expired'].map((k) => r[k] > 0 && <span key={k} className={'sb-' + k} style={{ flex: r[k] }} title={`${k}: ${r[k]}`} />)}
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Document control process</h2></div>
          <ol className="process">
            {[['Record', 'Create / update document record'], ['Upload', 'Attach scanned digital copy'], ['Monitor', 'System watches expiry date'], ['Alert', 'Responsible officer is notified'], ['Renew', 'Renewal action is completed'], ['Update', 'New document replaces current; history retained']].map(([t, d], i) => (
              <li key={t}><span className="p-n">{i + 1}</span><span><strong>{t}</strong><small>{d}</small></span></li>
            ))}
          </ol>

        </section>
      </div>
    </div>
  );
}
