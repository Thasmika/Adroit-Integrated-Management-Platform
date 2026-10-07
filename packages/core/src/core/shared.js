// Shared platform core: reference masters, document-type configuration, the single expiry engine,
// users & roles. Used by both the Employee and the Vehicle / Equipment modules.
// Dates are calendar days in the server / browser time zone (the Docker image runs with TZ=Asia/Dubai).
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export let TODAY = startOfDay(new Date());
export const refreshToday = () => { TODAY = startOfDay(new Date()); return TODAY; };
export const iso = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const daysUntil = (d) => (d ? Math.round((new Date(String(d).slice(0, 10) + 'T00:00:00') - refreshToday()) / 864e5) : null);
export const fmt = (d) => (d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtStamp = (ts) => (ts ? new Date(ts).toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
export const NOW_STAMP = () => iso(new Date()) + ' ' + new Date().toTimeString().slice(0, 5);

export function prng(seed) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  return { rnd, pick: (a) => a[Math.floor(rnd() * a.length)], digits: (n) => Array.from({ length: n }, () => Math.floor(rnd() * 10)).join('') };
}

// ---------- reference masters (§5) ----------
export const COMPANIES_INIT = [
  { id: 'ABM', name: 'Adroit Building Materials Trading Ent. L.L.C', short: 'Adroit', kind: 'Operating company', active: true },
  { id: 'GGT', name: 'Gateway Gulf Transport L.L.C', short: 'Gateway Gulf Transport', kind: 'Group company', active: true },
  { id: 'AGT', name: 'Adroit General Trading L.L.C', short: 'Adroit General Trading', kind: 'Group company', active: true },
  { id: 'ATS', name: 'Adroit Technical Services L.L.C', short: 'Adroit Technical Services', kind: 'Group company', active: true },
];
export const OPERATING = COMPANIES_INIT[0].name;
export const DEPARTMENTS_INIT = [
  'Administrative Department', 'Trading Department', 'Transport Department', 'Transport & Trading Department', 'Satwa Branch',
  'Aweer Branch', 'Alboom Branch', 'Ajman Branch', 'Aweer Store', 'Technical Workshop',
].map((name, i) => ({ id: 'D' + String(i + 1).padStart(2, '0'), name, active: true }));
export const LOCATIONS_INIT = ['Head Office', 'Aweer', 'Satwa', 'Alboom', 'Ajman', 'Aweer Store Yard', 'Technical Workshop', 'Project Site']
  .map((name, i) => ({ id: 'L' + String(i + 1).padStart(2, '0'), name, active: true }));

// location a department normally works from
export const deptLocation = (dept, pick) => dept.endsWith('Branch') ? dept.replace(' Branch', '')
  : dept === 'Aweer Store' ? 'Aweer Store Yard' : dept === 'Technical Workshop' ? 'Technical Workshop'
  : dept.includes('Transport') ? pick(['Aweer', 'Aweer', 'Aweer Store Yard', 'Project Site']) : 'Head Office';

// ---------- users, roles, responsible officers (§4, §5) ----------
export const ROLES = {
  sysadmin: { label: 'System Administrator', modules: ['hr', 'fleet'], admin: true, audit: true, note: 'User/role setup, masters and configuration. Has full access to all modules and content.' },
  management: { label: 'Management', modules: ['hr', 'fleet'], audit: true, readOnly: true, note: 'Integrated dashboards and summaries across companies; approves leave.' },
  hr: { label: 'HR Officer', modules: ['hr'], note: 'Employee records, HR documents, leave review, expiry follow-up.' },
  pro: { label: 'PRO / Compliance Officer', modules: ['hr'], docTypes: ['Passport', 'Employment Visa', 'Emirates ID'], note: 'Assigned visa / EID / passport renewals.' },
  insurance: { label: 'Insurance Officer', modules: ['hr', 'fleet'], docTypes: ['Health Insurance', 'Motor Insurance'], note: 'Employee and fleet insurance records and their expiry actions.' },
  depthead: { label: 'Department Head', modules: ['hr'], scoped: true, noDocs: true, note: 'Submits leave and records rejoining for own department; limited profile view.' },
  fleet: { label: 'Fleet / Transport Officer', modules: ['fleet'], note: 'Fleet master, vehicle documents, compliance action tracking.' },
  auditor: { label: 'Read-Only Auditor', modules: ['hr', 'fleet'], audit: true, readOnly: true, note: 'Explicitly authorised read-only records and audit reports.' },
};
export const USERS_INIT = [
  { id: 'u-admin', name: 'Kasun Bandara', email: 'kasun.bandara@adroit.ae', role: 'sysadmin', active: true },
  { id: 'u-gm', name: 'General Manager', email: 'gm@adroit.ae', role: 'management', active: true },
  { id: 'u-hr', name: 'Nadeesha Perera', email: 'nadeesha.perera@adroit.ae', role: 'hr', active: true },
  { id: 'u-pro', name: 'Imran Qureshi', email: 'imran.qureshi@adroit.ae', role: 'pro', active: true },
  { id: 'u-ins', name: 'Maria Santos', email: 'maria.santos@adroit.ae', role: 'insurance', active: true },
  { id: 'u-dh', name: 'Rajesh Menon', email: 'rajesh.menon@adroit.ae', role: 'depthead', scope: 'Trading Department', active: true },
  { id: 'u-trn', name: 'Suresh Pillai', email: 'suresh.pillai@adroit.ae', role: 'fleet', active: true },
  { id: 'u-hse', name: 'Tariq Malik', email: 'tariq.malik@adroit.ae', role: 'fleet', active: true },
  { id: 'u-aud', name: 'Anjali Rao', email: 'anjali.rao@adroit.ae', role: 'auditor', active: true },
];

// ---------- document types (§5 Document Type, §6.3, §10) ----------
export const DEFAULT_CATEGORIES = ['Heavy Vehicle', 'Light Vehicle', 'Trailer', 'Heavy Machine / Equipment', 'Other Company Vehicle'];
// Live list; admins can add categories without code changes (§2.2)
export const FLEET_CATEGORIES = [...DEFAULT_CATEGORIES];
export const DOC_TYPES_INIT = [
  { key: 'Passport', module: 'hr', short: 'PP', expires: true, required: true, urgent: 30, due: 60, monitor: 90, officer: 'u-pro' },
  { key: 'Employment Visa', module: 'hr', short: 'VISA', expires: true, required: true, urgent: 30, due: 60, monitor: 90, officer: 'u-pro' },
  { key: 'Emirates ID', module: 'hr', short: 'EID', expires: true, required: true, urgent: 30, due: 60, monitor: 90, officer: 'u-pro' },
  { key: 'Health Insurance', module: 'hr', short: 'INS', expires: true, required: true, urgent: 30, due: 60, monitor: 90, officer: 'u-ins' },
  { key: 'Qualification Certificate', module: 'hr', short: 'QUAL', expires: false, required: false, urgent: 0, due: 0, monitor: 0, officer: 'u-hr' },
  { key: 'Vehicle Registration', module: 'fleet', short: 'REG', expires: true, requiredFor: ['Heavy Vehicle', 'Light Vehicle', 'Trailer', 'Other Company Vehicle'], urgent: 30, due: 60, monitor: 90, officer: 'u-trn' },
  { key: 'Motor Insurance', module: 'fleet', short: 'INS', expires: true, requiredFor: [...DEFAULT_CATEGORIES], urgent: 30, due: 60, monitor: 90, officer: 'u-ins' },
  { key: 'Safety Certificate', module: 'fleet', short: 'SAFE', expires: true, requiredFor: ['Heavy Vehicle', 'Heavy Machine / Equipment'], urgent: 30, due: 60, monitor: 90, officer: 'u-hse' },
  { key: 'Inspection / Test Certificate', module: 'fleet', short: 'INSP', expires: true, requiredFor: ['Trailer', 'Heavy Machine / Equipment'], urgent: 30, due: 60, monitor: 90, officer: 'u-hse' },
  { key: 'Other Permit', module: 'fleet', short: 'PMT', expires: true, requiredFor: [], urgent: 30, due: 60, monitor: 90, officer: 'u-trn' },
];

// Live configuration used by the engine. The store keeps its own copy and calls setConfig() when admins change it.
let CFG = { docTypes: DOC_TYPES_INIT, users: USERS_INIT };
export const setConfig = (c) => {
  CFG = { ...CFG, ...c };
  if (c.categories) { FLEET_CATEGORIES.length = 0; c.categories.filter((x) => x.active !== false).forEach((x) => FLEET_CATEGORIES.push(x.name || x)); }
};
export const getConfig = () => CFG;
/** @returns {any} */
export const docCfg = (type) => CFG.docTypes.find((t) => t.key === type) || { key: type, module: '', expires: true, urgent: 30, due: 60, monitor: 90, officer: null };
export const docTypes = (module) => CFG.docTypes.filter((t) => !module || t.module === module);
export const userById = (id) => CFG.users.find((u) => u.id === id);
export const officerFor = (type) => { const u = userById(docCfg(type).officer) || CFG.users[0]; return { ...u, roleLabel: ROLES[u.role]?.label }; };
export const requiredFor = (module, category) => docTypes(module).filter((t) => (module === 'hr' ? t.required : (t.requiredFor || []).includes(category))).map((t) => t.key);

// ---------- the single expiry engine (§6.3, §10) ----------
export const STATUS_LABEL = { expired: 'Expired', critical: 'Urgent', due: 'Renewal due', monitor: 'Monitor', valid: 'Valid', onfile: 'On file', missing: 'Not recorded' };
export function docStatus(doc) {
  if (!doc) return { key: 'missing', label: 'Not recorded' };
  const c = docCfg(doc.type);
  if (!c.expires || !doc.expiry) return doc.file ? { key: 'onfile', label: 'On file' } : { key: 'missing', label: 'No scan' };
  const d = daysUntil(doc.expiry);
  const key = d < 0 ? 'expired' : d <= c.urgent ? 'critical' : d <= c.due ? 'due' : c.monitor && d <= c.monitor ? 'monitor' : 'valid';
  return { key, label: STATUS_LABEL[key], d, noScan: !doc.file };
}
export const needsAction = (doc) => ['expired', 'critical', 'due'].includes(docStatus(doc).key);
// action status for the attention list (§10): Open / In Progress / Completed
export const actionStatus = (doc) => (doc.renewal ? doc.renewal.status : needsAction(doc) ? 'Open' : '—');
export const ACTION_STATES = ['Open', 'In Progress', 'Submitted to authority', 'Awaiting payment', 'On hold'];
