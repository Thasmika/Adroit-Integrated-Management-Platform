import React, { useEffect, useState } from 'react';
import { useStore, go } from '../core/store.jsx';
import { fmt, docStatus, officerFor, TODAY, actionStatus, docTypes, docCfg } from '../core/shared.js';
import { scopeAssets, canSeeDoc, can } from '../core/access.js';
import { Icon, Tabs, KV, StatusPill, DocViewer, Empty, VehicleArt, PhotoBox, ActionPill } from '../core/ui.jsx';
import { UploadDocModal, RenewalActionModal } from '../core/docModals.jsx';
import { missingDocs, assetCompliance, REQUIRED, assetIdFromParam, assetParam, isGroup } from './data.js';

const TABS = ['Overview', 'Registration', 'Insurance', 'Safety', 'Certificates', 'Documents', 'History'];
const TAB_TYPES = { Registration: ['Vehicle Registration'], Insurance: ['Motor Insurance'], Safety: ['Safety Certificate'], Certificates: ['Inspection / Test Certificate', 'Other Permit'] };
const age = (y) => TODAY.getFullYear() - y;

export default function VehicleProfile({ param }) {
  const { state } = useStore();
  const u = state.user;
  const asset = scopeAssets(u, state.assets).find((a) => a.id === assetIdFromParam(param));
  const [tab, setTab] = useState('Overview');
  const [viewing, setViewing] = useState(null);
  const [upload, setUpload] = useState(null);
  const [tracking, setTracking] = useState(null);

  if (!asset) return <div className="page"><Empty title="Asset not found">Check the fleet number, or go back to the <a href="#fleet-master">Fleet Master</a>.</Empty></div>;

  const comp = assetCompliance(asset);
  const miss = missingDocs(asset).filter((m) => canSeeDoc(u, m.type));
  const docs = asset.docs.filter((d) => canSeeDoc(u, d.type));
  const canEdit = can(u, 'editAsset');
  const attention = docs.filter((d) => ['expired', 'critical', 'due'].includes(docStatus(d).key));

  const DocPanel = ({ type }) => {
    const d = asset.docs.find((x) => x.type === type);
    if (!d) {
      const required = (docCfg(type).requiredFor || []).includes(asset.category);
      const up = can(u, 'uploadDoc', { type });
      return (
        <div className="doc-panel doc-none">
          <div className="doc-panel-main">
            <div className="doc-title-row"><h3>{type}</h3><span className={'pill ' + (required ? 'pill-missing' : 'pill-onfile')}>{required ? 'Required · not recorded' : 'Not applicable yet'}</span></div>
            <p className="muted">{required ? `A ${type.toLowerCase()} is expected for ${asset.category.toLowerCase()}s. Record it to complete this profile.` : 'No document of this type is recorded for this asset.'}</p>
            {up && <div className="btn-row"><button className="btn btn-primary" onClick={() => setUpload({ type, mode: 'upload' })}><Icon n="plus" size={16} /> Record {type.toLowerCase()}</button></div>}
          </div>
        </div>
      );
    }
    const s = docStatus(d);
    const o = officerFor(type);
    const up = can(u, 'uploadDoc', { type });
    return (
      <div className="doc-block">
        <div className="doc-panel">
          <div className="doc-panel-main">
            <div className="doc-title-row"><h3>{d.name}</h3><StatusPill doc={d} /></div>
            <dl className="kv-grid">
              <KV k="Reference / policy no." v={d.ref} mono />
              <KV k="Issued by" v={d.issuer} />
              <KV k="Issue date" v={fmt(d.issued)} />
              <KV k="Expiry date" v={fmt(d.expiry)} />
              <KV k="Days remaining" v={s.d != null ? (s.d < 0 ? `Expired ${-s.d} days ago` : `${s.d} days`) : '—'} />
              <KV k="Responsible officer" v={`${o.name} (${o.roleLabel})`} />
              <KV k="Warning thresholds" v={`Urgent ≤ ${docCfg(type).urgent}d · due ≤ ${docCfg(type).due}d`} />
            </dl>
            <div className={'renewal-box' + (d.renewal ? ' on' : '')}>
              <Icon n="history" size={18} />
              <div>{d.renewal ? <><strong>Renewal action: {d.renewal.status}</strong><small>{d.renewal.note} · {d.renewal.by}, {fmt(d.renewal.date)}</small></> : <><strong>Renewal action: {actionStatus(d) === 'Open' ? 'Open' : 'none needed yet'}</strong><small>{actionStatus(d) === 'Open' ? 'Record progress when the renewal starts.' : 'An action opens automatically when the document enters its warning window.'}</small></>}</div>
              {up && <button className="btn btn-sm" onClick={() => setTracking(d)}>Update action</button>}
            </div>
            {up && <div className="btn-row">
              <button className="btn btn-primary" onClick={() => setUpload({ type, mode: 'renew' })}><Icon n="check" size={16} /> Renew · record new document</button>
              <button className="btn" onClick={() => setUpload({ type, mode: 'upload' })}><Icon n="upload" size={16} /> {d.file ? 'Replace scan' : 'Upload scan'}</button>
            </div>}
          </div>
          <button className={'doc-thumb' + (d.file ? '' : ' none')} onClick={() => (d.file ? setViewing(d) : up && setUpload({ type, mode: 'upload' }))}>
            {d.file ? <><Icon n="docs" size={32} /><span>{d.file.name}</span><small>{d.file.size} · Click to view</small></> : <><Icon n="upload" size={28} /><span>No scanned copy</span><small>{up ? 'Click to upload' : 'Not uploaded yet'}</small></>}
          </button>
        </div>
        {d.history.length > 0 && (
          <div className="table-wrap hist">
            <table className="table compact">
              <thead><tr><th colSpan={5}>Previous versions (retained)</th></tr><tr><th>Reference</th><th>Issued</th><th>Expired</th><th>File</th><th>Replaced on</th></tr></thead>
              <tbody>{d.history.map((h, i) => <tr key={i}><td className="mono">{h.ref}</td><td className="mono">{fmt(h.issued)}</td><td className="mono">{fmt(h.expiry)}</td><td className="small mono">{h.file}</td><td className="small">{fmt(h.replacedOn)}{h.completedBy ? ` · ${h.completedBy}` : ''}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const DocTable = () => (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Document</th><th>Reference / policy no.</th><th>Expiry date</th><th>Status</th><th>Action</th><th className="right">Digital copy</th></tr></thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.type}>
              <td><strong>{d.name}</strong>{d.name !== d.type && <small className="block muted">{d.type}</small>}</td>
              <td className="mono">{d.ref}</td>
              <td className="mono nowrap">{fmt(d.expiry)}</td>
              <td><StatusPill doc={d} /></td>
              <td><ActionPill status={actionStatus(d)} /></td>
              <td className="right">{d.file ? <button className="btn btn-sm" onClick={() => setViewing(d)}><Icon n="eye" size={14} /> View</button> : can(u, 'uploadDoc', { type: d.type }) ? <button className="btn btn-sm btn-ghost" onClick={() => setUpload({ type: d.type, mode: 'upload' })}><Icon n="upload" size={14} /> Upload</button> : <span className="muted small">No scan</span>}</td>
            </tr>
          ))}
          {miss.filter((m) => !m.recorded).map((m) => (
            <tr key={m.type}><td><strong>{m.type}</strong></td><td className="muted">—</td><td className="muted">—</td><td><span className="pill pill-missing">Not recorded</span></td><td /><td className="right">{can(u, 'uploadDoc', { type: m.type }) && <button className="btn btn-sm btn-primary" onClick={() => setUpload({ type: m.type, mode: 'upload' })}><Icon n="plus" size={14} /> Record</button>}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="page">
      <button className="back" onClick={() => go('fleet-master')}><Icon n="back" size={16} /> Fleet Master</button>

      <section className="vehicle-head">
        <div className="v-id">
          <span className="v-no mono">{asset.id}</span>
          <PhotoBox module="fleet" owner={asset} canEdit={canEdit} />
          <span className={'v-status v-' + asset.status.split(' ')[0].toLowerCase()}>{asset.status}</span>
        </div>
        <div className="v-block">
          <h2>Vehicle information</h2>
          <h1>{asset.make} {asset.model}</h1>
          <dl className="kv-list">
            <KV k="Fleet no." v={asset.id} mono />
            <KV k={asset.plate ? 'Registration no.' : 'Registration'} v={asset.plate || 'Not road-registered'} mono />
            <KV k="Category" v={`${asset.category} · ${asset.body}`} />
            <KV k="Year / colour" v={`${asset.year} · ${asset.colour} · ${age(asset.year)} yrs old`} />
            <KV k="Chassis / VIN" v={asset.vin} mono />
            <KV k="Engine no." v={asset.engine || '—'} mono />
          </dl>
        </div>
        <div className="v-block">
          <h2>Company &amp; operation</h2>
          <div className="chips"><span className={'pill pill-' + comp.key}>{comp.label}</span>{isGroup(asset.company) && <span className="tag">Group company</span>}</div>
          <dl className="kv-list">
            <KV k="Registered company" v={asset.company} />
            <KV k="Department" v={asset.department} />
            <KV k="Current location" v={asset.location} />
            <KV k="Assigned category" v={`${asset.usage} · capacity ${asset.capacity}`} />
            <KV k="Responsible officer" v={asset.officer} />
            <KV k={asset.category === 'Heavy Machine / Equipment' ? 'Hour meter' : 'Odometer'} v={asset.odometer || '—'} mono />
          </dl>
          <div className="btn-row">
            {canEdit && <button className="btn btn-sm" onClick={() => go('fleet-edit', assetParam(asset.id))}><Icon n="edit" size={14} /> Edit profile</button>}
            {docTypes('fleet').some((t) => can(u, 'uploadDoc', { type: t.key })) && <button className="btn btn-sm btn-primary" onClick={() => setUpload({ type: null, mode: 'upload' })}><Icon n="upload" size={14} /> Upload document</button>}
          </div>
          <p className="meta small"><Icon n="history" size={13} /> Created {fmt(asset.created.at)} by {asset.created.by} · updated {fmt(asset.updated.at)} by {asset.updated.by}</p>
        </div>
      </section>

      {(attention.length > 0 || miss.length > 0) && (
        <div className="alert-strip" role="note">
          <Icon n="bell" />
          <span>{[...attention.map((d) => `${d.name} ${docStatus(d).d < 0 ? 'expired' : 'expires'} ${fmt(d.expiry)}`), ...miss.map((m) => `${m.type} ${m.recorded ? 'scan missing' : 'not recorded'}`)].join(' · ')}</span>
          <button className="link" onClick={() => setTab('Documents')}>Review</button>
        </div>
      )}

      <Tabs tabs={TABS.filter((t) => !TAB_TYPES[t] || TAB_TYPES[t].some((x) => canSeeDoc(u, x))).map((t) => ({ key: t, label: t, count: TAB_TYPES[t] ? docs.filter((d) => TAB_TYPES[t].includes(d.type) && ['expired', 'critical', 'due', 'missing'].includes(docStatus(d).key)).length || null : null }))} value={tab} onChange={setTab} />

      <section className="panel tab-panel">
        {tab === 'Overview' && (
          <div className="stack">
            <DocTable />
            <div className="grid-2 inner">
              <div><h3 className="sub">Remarks</h3><p>{asset.remarks || <span className="muted">No remarks recorded.</span>}</p></div>
              <div><h3 className="sub">In service since</h3><p>{fmt(asset.acquired)}</p></div>
            </div>
          </div>
        )}
        {TAB_TYPES[tab] && <div className="stack">{TAB_TYPES[tab].filter((t) => canSeeDoc(u, t)).map((t) => <DocPanel key={t} type={t} />)}</div>}
        {tab === 'Documents' && (
          <div className="stack">
            <DocTable />
            {docTypes('fleet').some((t) => can(u, 'uploadDoc', { type: t.key })) && <div className="btn-row"><button className="btn btn-primary" onClick={() => setUpload({ type: null, mode: 'upload' })}><Icon n="plus" size={16} /> Add another document</button></div>}
          </div>
        )}
        {tab === 'History' && (
          <History no={asset.id} />
        )}
      </section>

      {viewing && <DocViewer owner={asset} module="fleet" doc={viewing} onClose={() => setViewing(null)} />}
      {upload && <UploadDocModal module="fleet" owner={asset} docType={upload.type} mode={upload.mode} onClose={() => setUpload(null)} />}
      {tracking && <RenewalActionModal module="fleet" owner={asset} doc={tracking} onClose={() => setTracking(null)} />}
    </div>
  );
}

function History({ no }) {
  const { act } = useStore();
  const [items, setItems] = useState(null);
  useEffect(() => { act.assetHistory(no).then((r) => setItems(r.items)).catch(() => setItems([])); }, [no]);
  if (!items) return <p className="muted">Loading history…</p>;
  if (!items.length) return <p className="muted">No history recorded yet.</p>;
  return <ol className="timeline">{items.map((e, i) => <li key={i}><span className="mono small">{fmt(e.date)}</span><span>{e.what}</span></li>)}</ol>;
}
