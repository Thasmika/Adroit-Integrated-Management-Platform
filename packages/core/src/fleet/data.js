// Vehicle & Equipment module sample data (fictional).
import { TODAY, iso, addDays, daysUntil, fmt, docStatus, docCfg, officerFor, requiredFor, COMPANIES_INIT, FLEET_CATEGORIES, LOCATIONS_INIT, DEPARTMENTS_INIT } from '../core/shared.js';

export const CATEGORIES = FLEET_CATEGORIES;
export const CAT_SHORT = { 'Heavy Vehicle': 'Heavy', 'Light Vehicle': 'Light', Trailer: 'Trailer', 'Heavy Machine / Equipment': 'Machine', 'Other Company Vehicle': 'Other Co.' };

export const DEPARTMENTS = DEPARTMENTS_INIT.map((d) => d.name);
export const LOCATIONS = LOCATIONS_INIT.map((l) => l.name);
export const COMPANIES = COMPANIES_INIT.map((c) => c.name);
export const STATUSES = ['Active', 'Under Repair', 'Standby', 'Off-road', 'Inactive', 'Disposed'];
export const USAGE = ['Delivery', 'Long haul', 'Yard operation', 'Staff transport', 'Sales & site visits', 'Management use', 'Pool vehicle'];

export const DOC_TYPES = ['Vehicle Registration', 'Motor Insurance', 'Safety Certificate', 'Inspection / Test Certificate', 'Other Permit'];
export const DOC_SHORT = { 'Vehicle Registration': 'REG', 'Motor Insurance': 'INS', 'Safety Certificate': 'SAFE', 'Inspection / Test Certificate': 'INSP', 'Other Permit': 'PMT' };
export const DOC_CYCLE = { 'Vehicle Registration': 365, 'Motor Insurance': 365, 'Safety Certificate': 365, 'Inspection / Test Certificate': 365, 'Other Permit': 365 };
const REQUIRED = Object.fromEntries(FLEET_CATEGORIES.map((c) => [c, requiredFor('fleet', c)]));

const MODELS = {
  'Heavy Vehicle': [
    ['Mercedes-Benz', 'Actros 2641', 'Tractor head'], ['Volvo', 'FH 460', 'Tractor head'], ['Isuzu', 'FVR 34', 'Flatbed truck'],
    ['Hino', '700 Series', 'Tipper'], ['Tata', 'LPT 1618', 'Flatbed truck'], ['Ashok Leyland', 'Falcon 2518', 'Box truck'],
    ['Mitsubishi Fuso', 'FJ 2528', 'HIAB crane truck'], ['Isuzu', 'NPR 85', '3-ton pickup truck'],
  ],
  'Light Vehicle': [
    ['Toyota', 'Hilux Double Cab', 'Pickup'], ['Nissan', 'Navara', 'Pickup'], ['Mitsubishi', 'L200', 'Pickup'],
    ['Toyota', 'Hiace', 'Van'], ['Nissan', 'Urvan 14-seater', 'Staff bus'], ['Toyota', 'Corolla', 'Sedan'],
    ['Nissan', 'Sunny', 'Sedan'], ['Toyota', 'Land Cruiser 79', 'Pickup'],
  ],
  Trailer: [['Schmitz Cargobull', 'S.KO 40ft', 'Flatbed trailer'], ['Local fabricated', '3-axle 40ft', 'Flatbed trailer'], ['Local fabricated', '60-ton', 'Lowbed trailer'], ['Krone', 'Profi Liner', 'Curtain-side trailer']],
  'Heavy Machine / Equipment': [
    ['Toyota', '8FD30 3-ton', 'Forklift'], ['Komatsu', 'FD50 5-ton', 'Forklift'], ['TCM', 'FD70 7-ton', 'Forklift'],
    ['Caterpillar', '950 GC', 'Wheel loader'], ['JCB', '540-170', 'Telehandler'], ['Bobcat', 'S650', 'Skid-steer loader'],
    ['Tadano', 'GR-250N 25-ton', 'Mobile crane'],
  ],
  'Other Company Vehicle': [['Toyota', 'Hilux Single Cab', 'Pickup'], ['Nissan', 'Patrol', 'SUV'], ['Mitsubishi', 'Canter', 'Light truck'], ['Toyota', 'Fortuner', 'SUV']],
};
const COLOURS = ['White', 'White', 'White', 'Silver', 'Grey', 'Blue', 'Red', 'Yellow'];
const CAT_COUNTS = [['Heavy Vehicle', 38], ['Light Vehicle', 42], ['Trailer', 16], ['Heavy Machine / Equipment', 22], ['Other Company Vehicle', 8]];
const PERMITS = { 'Heavy Vehicle': 'RTA Heavy Vehicle Permit', Trailer: 'Oversize Load Permit', 'Heavy Machine / Equipment': 'Dubai Municipality Equipment Permit', 'Light Vehicle': 'Salik / Free Zone Access Pass', 'Other Company Vehicle': 'Free Zone Access Pass' };
const INSURERS = ['Oman Insurance', 'Orient Insurance', 'AXA Gulf', 'RSA Insurance', 'Sukoon Insurance'];
const TPI = ['Bureau Veritas', 'Intertek', 'TÜV Middle East', 'Applus Velosi'];

let seed = 20260929;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const digits = (n) => Array.from({ length: n }, () => Math.floor(rnd() * 10)).join('');

function plate(emirate) {
  const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (emirate === 'Dubai') return `Dubai ${L[Math.floor(rnd() * 26)]} ${digits(5)}`;
  if (emirate === 'Sharjah') return `Sharjah ${1 + Math.floor(rnd() * 3)} ${digits(5)}`;
  return `Ajman ${L[Math.floor(rnd() * 8)]} ${digits(4)}`;
}

function makeDoc(type, asset, off, withFile = true) {
  const expiry = addDays(TODAY, off);
  const issued = addDays(expiry, -DOC_CYCLE[type] + 1);
  const ref = type === 'Vehicle Registration' ? `TC ${digits(8)}`
    : type === 'Motor Insurance' ? `POL-${pick(['MV', 'FL', 'EQ'])}-${digits(7)}`
    : type === 'Safety Certificate' ? `SC-${digits(6)}`
    : type === 'Inspection / Test Certificate' ? `INSP-${digits(6)}`
    : `PMT-${digits(6)}`;
  const issuer = type === 'Vehicle Registration' ? (asset.emirate === 'Dubai' ? 'RTA Dubai' : asset.emirate === 'Sharjah' ? 'Sharjah Police – Traffic' : 'Ajman Police – Traffic')
    : type === 'Motor Insurance' ? pick(INSURERS)
    : type === 'Other Permit' ? (asset.category === 'Heavy Machine / Equipment' ? 'Dubai Municipality' : 'RTA Dubai')
    : pick(TPI);
  const fname = `${asset.id.replace('-', '')}_${type.split(' ')[0]}_${iso(issued).slice(0, 4)}.pdf`;
  // one previous version, kept in history
  const prevExp = addDays(issued, -1);
  return {
    type, name: type === 'Other Permit' ? PERMITS[asset.category] : type, ref, issuer,
    issued: iso(issued), expiry: iso(expiry),
    file: withFile ? { name: fname, size: `${160 + Math.floor(rnd() * 700)} KB`, sample: true } : null,
    renewal: null,
    history: [{ ref: ref.replace(/\d{3}$/, digits(3)), issued: iso(addDays(prevExp, -DOC_CYCLE[type] + 1)), expiry: iso(prevExp), file: `${asset.id.replace('-', '')}_${type.split(' ')[0]}_${iso(prevExp).slice(0, 4)}.pdf`, replacedOn: iso(addDays(issued, -3)) }],
  };
}

function makeAssets() {
  const list = [];
  let n = 0;
  CAT_COUNTS.forEach(([cat, count]) => {
    for (let i = 0; i < count; i++) {
      n++;
      const [make, model, body] = pick(MODELS[cat]);
      const emirate = rnd() < 0.78 ? 'Dubai' : rnd() < 0.6 ? 'Sharjah' : 'Ajman';
      const dept = cat === 'Heavy Vehicle' || cat === 'Trailer' ? pick(['Transport Department', 'Transport Department', 'Transport & Trading Department'])
        : cat === 'Heavy Machine / Equipment' ? pick(['Aweer Store', 'Aweer Branch', 'Technical Workshop', 'Satwa Branch', 'Alboom Branch'])
        : pick(DEPARTMENTS);
      const loc = dept.includes('Transport') ? pick(['Aweer', 'Aweer', 'Aweer Store Yard', 'Project Site'])
        : dept === 'Technical Workshop' ? 'Technical Workshop'
        : dept.endsWith('Branch') ? dept.replace(' Branch', '')
        : dept === 'Aweer Store' ? 'Aweer Store Yard' : 'Head Office';
      const year = 2012 + Math.floor(rnd() * 14);
      const company = cat === 'Other Company Vehicle' ? pick(COMPANIES.slice(1)) : rnd() < 0.62 ? COMPANIES[0] : cat === 'Heavy Vehicle' || cat === 'Trailer' ? COMPANIES[1] : pick(COMPANIES.slice(1));
      const vin = cat === 'Heavy Machine / Equipment' ? `${make.slice(0, 3).toUpperCase()}${digits(9)}` : `${pick(['JTF', 'WDB', 'YV2', 'JAA', 'MAT', 'MB1', 'JN1'])}${digits(3)}${'ABCDEFGHJK'[Math.floor(rnd() * 10)]}${digits(10)}`;
      list.push({
        id: `VH-${String(n).padStart(4, '0')}`,
        category: cat, make, model, body, year, colour: pick(COLOURS),
        emirate, plate: cat === 'Heavy Machine / Equipment' ? '' : plate(emirate),
        vin, engine: cat === 'Trailer' ? '' : `${pick(['OM', 'D13', '4HK', '6HK', 'J08', '1GD', 'QR25', 'YD25'])}-${digits(7)}`,
        company, department: dept, location: loc, photo: null,
        created: { by: 'Data migration', at: iso(addDays(TODAY, -28)) }, updated: { by: 'Data migration', at: iso(addDays(TODAY, -28)) },
        status: rnd() < 0.88 ? 'Active' : pick(['Under Repair', 'Standby', 'Standby', 'Off-road']),
        usage: cat === 'Heavy Machine / Equipment' ? 'Yard operation' : cat === 'Heavy Vehicle' || cat === 'Trailer' ? pick(['Delivery', 'Long haul']) : pick(USAGE.slice(3)),
        officer: '', capacity: cat === 'Heavy Machine / Equipment' ? body.includes('crane') ? '25 t' : model.match(/(\d+)-ton/)?.[1] ? model.match(/(\d+)-ton/)[1] + ' t' : '—' : cat === 'Trailer' ? '40 t' : cat === 'Heavy Vehicle' ? pick(['10 t', '18 t', '25 t', '40 t (GCW)']) : '1 t',
        acquired: iso(addDays(new Date(`${year}-06-01`), Math.floor(rnd() * 200))),
        odometer: cat === 'Trailer' ? null : cat === 'Heavy Machine / Equipment' ? `${1200 + Math.floor(rnd() * 9000)} hrs` : `${(20000 + Math.floor(rnd() * 380000)).toLocaleString('en-US')} km`,
        remarks: '',
        docs: [],
      });
    }
  });
  return list;
}

function assignDocs(assets) {
  // assets chosen to show attention states (dashboard should read like the proposal)
  const expiring = [3, 11, 19, 27, 45, 52, 60, 71, 83, 90, 97, 104, 112]; // + VH-0108 = 14 assets
  const expiringTypes = ['Vehicle Registration', 'Motor Insurance', 'Vehicle Registration', 'Safety Certificate', 'Motor Insurance', 'Vehicle Registration', 'Vehicle Registration', 'Motor Insurance', 'Inspection / Test Certificate', 'Safety Certificate', 'Motor Insurance', 'Other Permit', 'Vehicle Registration'];
  const expiringOffsets = [-12, 6, 18, 24, 33, -4, 41, 47, 15, 52, 58, 27, 9];
  const missing = [7, 34, 58, 76, 101, 119]; // six assets with a missing document
  assets.forEach((a, i) => {
    const req = [...REQUIRED[a.category]];
    // some heavy vehicles carry a crane / lifting test and a permit
    if (a.category === 'Heavy Vehicle' && (a.body === 'HIAB crane truck' || i % 5 === 0)) req.push('Inspection / Test Certificate');
    if ((a.category === 'Heavy Vehicle' && i % 3 === 0) || (a.category === 'Heavy Machine / Equipment' && i % 4 === 0) || (a.category === 'Trailer' && a.body === 'Lowbed trailer')) req.push('Other Permit');
    const ei = expiring.indexOf(i);
    if (ei >= 0 && !req.includes(expiringTypes[ei])) req.push(expiringTypes[ei]);
    a.docs = req.map((t) => {
      let off = 61 + Math.floor(rnd() * 300);
      if (ei >= 0 && t === expiringTypes[ei]) off = expiringOffsets[ei];
      return makeDoc(t, a, off, true);
    });
    const mi = missing.indexOf(i);
    if (mi >= 0) {
      if (mi % 2 === 0) a.docs[a.docs.length - 1].file = null; // record, no scan
      else a.docs = a.docs.slice(0, -1); // not recorded at all
    }
    a.docs.forEach((d) => { if (daysUntil(d.expiry) <= 30 && rnd() < 0.5) d.renewal = { status: 'In Progress', note: 'Documents submitted for renewal', by: officerFor(d.type).name, date: iso(addDays(TODAY, -3)) }; });
  });
  // pin the proposal's sample VH-0108
  const s = assets[107];
  Object.assign(s, {
    category: 'Heavy Vehicle', make: 'Mercedes-Benz', model: 'Actros 2641', body: 'HIAB crane truck', year: 2024, colour: 'White',
    emirate: 'Dubai', plate: 'Dubai K 48210', company: COMPANIES[1], department: 'Transport Department', location: 'Aweer', status: 'Active',
    usage: 'Delivery', capacity: '25 t', odometer: '38,420 km', vin: 'WDB9634031L948210', engine: 'OM471-3302401', acquired: '2024-03-14', remarks: 'Crane serviced Aug 2026. Assigned to block & steel deliveries.',
  });
  s.docs = [
    makeDoc('Vehicle Registration', s, 50),
    makeDoc('Motor Insurance', s, 115),
    makeDoc('Safety Certificate', s, 1),
    makeDoc('Inspection / Test Certificate', s, 167),
    makeDoc('Other Permit', s, 72),
  ];
  s.docs[2].renewal = { status: 'In Progress', note: 'Inspection booked with Intertek, tomorrow 08:00', by: 'Tariq Malik', date: iso(addDays(TODAY, -5)) };
  assets.forEach((a) => {
    a.officer = officerFor(a.docs.find((d) => d.type === 'Vehicle Registration') ? 'Vehicle Registration' : 'Safety Certificate').name;
  });
  return assets;
}

function makeHistory(assets) {
  const ev = {};
  assets.forEach((a) => {
    const list = [{ date: a.acquired, what: `Added to fleet · ${a.company}` }];
    a.docs.forEach((d) => d.history.forEach((h) => list.push({ date: h.replacedOn, what: `${d.name} renewed · previous ${h.ref} (exp. ${fmt(h.expiry)}) moved to history` })));
    if (a.id === 'VH-0108') list.push({ date: iso(addDays(TODAY, -331)), what: 'Transferred from Alboom to Aweer' }, { date: iso(addDays(TODAY, -41)), what: 'Crane serviced at Technical Workshop' });
    ev[a.id] = list.sort((x, y) => (x.date < y.date ? 1 : -1));
  });
  return ev;
}

export function makeFleet() {
  seed = 20260929;
  const assets = assignDocs(makeAssets());
  return { assets, events: makeHistory(assets) };
}

// ---------- helpers ----------
export const expiryState = (doc) => docStatus({ ...doc, file: doc.file || { name: 'x' } }).key;
export const missingDocs = (a) => { const req = requiredFor('fleet', a.category); return req.filter((t) => !a.docs.some((d) => d.type === t)).map((t) => ({ type: t, recorded: false }))
  .concat(a.docs.filter((d) => !d.file).map((d) => ({ type: d.type, recorded: true, doc: d }))); };
export function assetCompliance(a) {
  if (['Disposed', 'Inactive'].includes(a.status)) return { key: 'onfile', label: a.status };
  const states = a.docs.map(expiryState);
  if (states.includes('expired')) return { key: 'expired', label: 'Expired document' };
  if (missingDocs(a).length) return { key: 'missing', label: 'Missing document' };
  if (states.includes('critical') || states.includes('due')) return { key: 'due', label: 'Renewal due' };
  return { key: 'valid', label: 'Compliant' };
}
export function fleetExpiryRows(assets, withinDays = 60, types = DOC_TYPES) {
  const rows = [];
  assets.forEach((a) => { if (['Disposed', 'Inactive'].includes(a.status)) return; a.docs.forEach((doc) => {
    if (!types.includes(doc.type)) return;
    const d = daysUntil(doc.expiry);
    if (d <= withinDays) rows.push({ module: 'fleet', owner: a, asset: a, doc, d, st: docStatus(doc), officer: officerFor(doc.type) });
  }); });
  return rows.sort((x, y) => x.d - y.d);
}
export const assetName = (a) => `${a.make} ${a.model}`;
export const catSlug = (c) => c.toLowerCase().replace(/[^a-z]+/g, '');
export const assetParam = (id) => id.replace('VH-', '');
export const assetIdFromParam = (p) => `VH-${p}`;
export const isGroup = (company) => company !== COMPANIES_INIT[0].name;
export { REQUIRED };
