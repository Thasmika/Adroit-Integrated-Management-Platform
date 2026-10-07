import React, { useState } from 'react';
import { useStore, go } from '../core/store.jsx';
import { requiredFor, docTypes, officerFor } from '../core/shared.js';
import { can } from '../core/access.js';
import { CATEGORIES, STATUSES, USAGE, assetIdFromParam, assetParam } from './data.js';
import { Field, Icon, VehicleArt, Empty, DateInput } from '../core/ui.jsx';

export default function VehicleForm({ param }) {
  const { state, act, notify } = useStore();
  const [busy, setBusy] = useState(false);
  const cfg = state.config;
  const fleetOfficers = cfg.users.filter((x) => x.active && ['fleet', 'insurance'].includes(x.role));
  const editing = param ? state.assets.find((a) => a.id === assetIdFromParam(param)) : null;
  const nextNo = 'New asset';
  const [f, setF] = useState(() => editing ? { ...editing } : {
    id: nextNo, category: CATEGORIES[0], make: '', model: '', body: '', year: new Date().getFullYear(), colour: 'White', emirate: 'Dubai', plate: '',
    vin: '', engine: '', company: cfg.companies[0].name, department: 'Transport Department', location: 'Aweer', status: 'Active',
    usage: 'Delivery', officer: officerFor('Vehicle Registration').name, photo: null, capacity: '', acquired: '', odometer: '', remarks: '', docs: [],
  });
  const [err, setErr] = useState('');
  if (!can(state.user, 'editAsset')) return <div className="page"><Empty title="Only the Fleet / Transport Officer can add or edit assets" /></div>;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const machine = f.category === 'Heavy Machine / Equipment';

  const save = async (e) => {
    e.preventDefault();
    if (!f.make.trim() || !f.model.trim() || !f.vin.trim()) { setErr('Make, model and chassis / serial number are required.'); return; }
    if (!machine && !f.plate.trim()) { setErr('Enter the registration (plate) number, or choose Heavy Machine / Equipment for unregistered machines.'); return; }
        setBusy(true); setErr('');
    try {
      const saved = await act.saveAsset({ ...f, year: f.year ? +f.year : null }, editing?.id);
      notify(editing ? `${saved.id} updated` : `${saved.id} added to the fleet. Record its documents next.`);
      go('fleet-vehicle', assetParam(saved.id));
    } catch (x) { setErr(x.message); setBusy(false); }
  };

  return (
    <div className="page narrow">
      <button className="back" onClick={() => (editing ? go('fleet-vehicle', param) : go('fleet-master'))}><Icon n="back" size={16} /> {editing ? editing.id : 'Fleet Master'}</button>
      <div className="page-head">
        <div>
          <span className="eyebrow mono">{editing ? f.id : 'Fleet number is assigned on save'}</span>
          <h1>{editing ? 'Edit vehicle / machine' : 'Add vehicle / machine'}</h1>
          <p className="muted">Each asset keeps this fleet number for its whole working life. Documents are added from the profile after saving.</p>
        </div>
      </div>
      <form className="stack" onSubmit={save}>
        <fieldset className="panel">
          <legend>Category</legend>
          <div className="cat-pick">
            {CATEGORIES.map((c) => (
              <label key={c} className={f.category === c ? 'on' : ''}>
                <input type="radio" name="cat" value={c} checked={f.category === c} onChange={set('category')} />
                <VehicleArt category={c} size={48} /><span>{c}</span>
              </label>
            ))}
          </div>
          <p className="field-hint">Documents expected for this category: {requiredFor('fleet', f.category).join(', ')} (set in Administration → Document types).</p>
        </fieldset>
        <fieldset className="panel">
          <legend>Identity</legend>
          <div className="form-grid cols-3">
            <Field label="Make"><input id="vf-make" value={f.make} onChange={set('make')} placeholder="e.g. Mercedes-Benz" required /></Field>
            <Field label="Model"><input id="vf-model" value={f.model} onChange={set('model')} placeholder="e.g. Actros 2641" required /></Field>
            <Field label="Body / machine type"><input id="vf-body" value={f.body} onChange={set('body')} placeholder="e.g. HIAB crane truck, Forklift" /></Field>
            <Field label="Year"><input id="vf-year" type="number" min="1990" max="2027" value={f.year} onChange={set('year')} /></Field>
            <Field label="Colour"><input id="vf-colour" value={f.colour} onChange={set('colour')} /></Field>
            <Field label="Capacity"><input id="vf-cap" value={f.capacity} onChange={set('capacity')} placeholder="e.g. 25 t, 5-ton" /></Field>
            <Field label="Emirate of registration"><select id="vf-emirate" value={f.emirate} onChange={set('emirate')}><option>Dubai</option><option>Sharjah</option><option>Ajman</option><option>Abu Dhabi</option></select></Field>
            <Field label={machine ? 'Registration no. (if road-registered)' : 'Registration (plate) no.'}><input id="vf-plate" value={f.plate} onChange={set('plate')} placeholder="e.g. Dubai K 48210" /></Field>
            <Field label="Chassis / VIN / serial no."><input id="vf-vin" value={f.vin} onChange={set('vin')} required /></Field>
            <Field label="Engine no."><input id="vf-engine" value={f.engine} onChange={set('engine')} /></Field>
            <Field label="In service since"><DateInput id="vf-acq" value={f.acquired} onChange={set('acquired')} /></Field>
            <Field label={machine ? 'Hour meter' : 'Odometer'}><input id="vf-odo" value={f.odometer || ''} onChange={set('odometer')} placeholder={machine ? 'e.g. 4,200 hrs' : 'e.g. 125,000 km'} /></Field>
          </div>
        </fieldset>
        <fieldset className="panel">
          <legend>Ownership &amp; operation</legend>
          <div className="form-grid cols-3">
            <Field label="Owning / registered company" span={2} hint="Assets may be registered under Adroit or a group company."><select id="vf-co" value={f.company} onChange={set('company')}>{cfg.companies.filter((c) => c.active || c.name === f.company).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select></Field>
            <Field label="Operational / lifecycle status" hint="Inactive and Disposed assets keep their profile and history but leave expiry monitoring."><select id="vf-status" value={f.status} onChange={set('status')}>{STATUSES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Department / branch"><select id="vf-dept" value={f.department} onChange={set('department')}>{cfg.departments.filter((d) => d.active || d.name === f.department).map((d) => <option key={d.id}>{d.name}</option>)}</select></Field>
            <Field label="Current location"><select id="vf-loc" value={f.location} onChange={set('location')}>{cfg.locations.filter((d) => d.active || d.name === f.location).map((d) => <option key={d.id}>{d.name}</option>)}</select></Field>
            <Field label="Assigned category (use)"><select id="vf-use" value={f.usage} onChange={set('usage')}>{USAGE.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Responsible officer"><select id="vf-off" value={f.officer} onChange={set('officer')}>{fleetOfficers.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}</select></Field>
            <Field label="Remarks" span={2}><input id="vf-rem" value={f.remarks} onChange={set('remarks')} /></Field>
          </div>
        </fieldset>
        {err && <p className="error" role="alert">{err}</p>}
        <div className="btn-row end">
          <button type="button" className="btn" onClick={() => history.back()}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add to fleet'}</button>
        </div>
      </form>
    </div>
  );
}
