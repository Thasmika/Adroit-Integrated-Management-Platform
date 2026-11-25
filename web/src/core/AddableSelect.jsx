import React, { useState } from 'react';
import { useStore } from './store.jsx';

// Policy: item lists are never limited to the built-in items. Every data-entry dropdown whose list can grow
// uses this select, which has a "+" button to add a new item on the spot.
//   options: strings or { value, label }   onAdd(name): Promise that saves the new item   canAdd: show the "+" button
export function AddableSelect({ id, value, onChange, options, onAdd, canAdd = true, placeholder = 'New item name', ...rest }) {
  const { notify } = useStore();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const known = opts.some((o) => o.value === value);
  const pick = (v) => onChange({ target: { value: v } });

  const add = async () => {
    const n = text.trim();
    if (n.length < 2) { setErr('Enter at least 2 characters.'); return; }
    const dup = opts.find((o) => o.value.toLowerCase() === n.toLowerCase());
    if (dup) { pick(dup.value); setAdding(false); setText(''); setErr(''); return; }
    setBusy(true); setErr('');
    try {
      await onAdd(n);
      pick(n); setAdding(false); setText('');
      notify(`"${n}" added to the list`);
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };

  return (
    <span className="addable" style={{ display: 'block' }}>
      <span style={{ display: 'flex', gap: '8px' }}>
        <select id={id} style={{ flex: 1, minWidth: 0 }} value={value ?? ''} onChange={onChange} {...rest}>
          {value && !known && <option value={value}>{value}</option>}
          {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {canAdd && onAdd && (
          <button type="button" className="btn" id={id + '-add'} title="Add a new item to this list" aria-label="Add a new item to this list"
            onClick={(e) => { e.preventDefault(); setAdding((a) => !a); setErr(''); }}>{adding ? '×' : '+'}</button>
        )}
      </span>
      {adding && (
        <span style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          <input id={id + '-new'} style={{ flex: 1, minWidth: 0 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } if (e.key === 'Escape') setAdding(false); }} />
          <button type="button" className="btn btn-primary" onClick={(e) => { e.preventDefault(); add(); }} disabled={busy}>{busy ? 'Adding…' : 'Add'}</button>
        </span>
      )}
      {err && <span className="error" role="alert" style={{ display: 'block', marginTop: '4px' }}>{err}</span>}
    </span>
  );
}

// Built-in items plus the ones users added (config.lookups[list]), without duplicates
export const withLookup = (config, list, defaults) => {
  const extra = (config?.lookups?.[list] || []).filter((v) => !defaults.some((d) => d.toLowerCase() === v.toLowerCase()));
  return [...defaults, ...extra];
};
