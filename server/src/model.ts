// Read side: database rows → the record shapes the web app uses, filtered to what the signed-in user may see.
import { q, one, Db, pool } from './db.js';
import { sizeLabel } from './storage.js';
import { ROLES } from '@adroit/core/src/core/shared.js';
import { scopeEmployees, scopeAssets, visibleDocs, canModule } from '@adroit/core/src/core/access.js';
import { notFound } from './auth.js';
import { isProd } from './env.js';

const isoDay = (t: any) => (t ? new Date(t).toISOString().slice(0, 10) : null);
const fileOut = (f: any) => (f && f.id ? { id: f.id, name: f.original_name, size: sizeLabel(Number(f.size_bytes)), kind: f.mime, url: `/api/files/${f.id}` } : null);

async function loadDocs(module: 'hr' | 'fleet', ownerIds: string[] | null, db: Db) {
  const where = ownerIds ? 'AND d.owner_id = ANY($2)' : '';
  const params: any[] = [module];
  if (ownerIds) params.push(ownerIds);
  const cur = await q<any>(
    `SELECT d.id AS doc_id, d.owner_id, d.type, d.name, v.id AS version_id, v.ref, v.issuer, v.issued, v.expiry,
            f.id, f.original_name, f.size_bytes, f.mime,
            a.id AS action_id, a.status AS a_status, a.note AS a_note, a.updated_by AS a_by, a.updated_at AS a_at, a.assigned_to AS a_to
       FROM documents d
       JOIN document_versions v ON v.document_id = d.id AND v.is_current
       LEFT JOIN files f ON f.id = v.file_id
       LEFT JOIN expiry_actions a ON a.document_id = d.id AND a.completed_at IS NULL
      WHERE d.owner_module = $1 ${where}
      ORDER BY d.owner_id, d.type`, params, db);
  const hist = await q<any>(
    `SELECT v.document_id, v.ref, v.issued, v.expiry, v.superseded_at, v.superseded_by, f.id, f.original_name
       FROM document_versions v JOIN documents d ON d.id = v.document_id
       LEFT JOIN files f ON f.id = v.file_id
      WHERE d.owner_module = $1 AND NOT v.is_current ${where}
      ORDER BY v.superseded_at DESC`, params, db);
  const hmap = new Map<string, any[]>();
  hist.forEach((h) => {
    const list = hmap.get(h.document_id) || [];
    list.push({ ref: h.ref, issued: h.issued, expiry: h.expiry, file: h.original_name || '—', fileUrl: h.id ? `/api/files/${h.id}` : null, replacedOn: isoDay(h.superseded_at), completedBy: h.superseded_by });
    hmap.set(h.document_id, list);
  });
  const byOwner = new Map<string, any[]>();
  cur.forEach((r) => {
    const doc = {
      docId: r.doc_id, versionId: r.version_id, type: r.type, name: r.name, ref: r.ref || '', issuer: r.issuer || '', issued: r.issued || '', expiry: r.expiry || '',
      file: fileOut(r),
      renewal: r.action_id ? { status: r.a_status, note: r.a_note || '', by: r.a_by || 'System', date: isoDay(r.a_at), assignedTo: r.a_to } : null,
      history: hmap.get(r.doc_id) || [],
    };
    const list = byOwner.get(r.owner_id) || [];
    list.push(doc);
    byOwner.set(r.owner_id, list);
  });
  return byOwner;
}

export const empOut = (e: any, docs: any[]) => ({
  id: e.emp_no, uid: e.id, name: e.name, photo: e.photo_file_id ? `/api/files/${e.photo_file_id}` : null,
  gender: e.gender, nationality: e.nationality, dob: e.dob, department: e.department, location: e.location,
  designation: e.designation, mobile: e.mobile, email: e.email, status: e.status, joined: e.joined,
  company: e.company, sponsor: e.sponsor, deptHead: e.dept_head, insurancePlan: e.insurance_plan, insuranceProvider: e.insurance_provider,
  emergencyContact: e.emergency_contact, homeAddress: e.home_address, notes: e.notes,
  created: { by: e.created_by || 'System', at: isoDay(e.created_at) }, updated: { by: e.updated_by || 'System', at: isoDay(e.updated_at) },
  docs,
});
export const assetOut = (a: any, docs: any[]) => ({
  id: a.fleet_no, uid: a.id, category: a.category, make: a.make, model: a.model, body: a.body, year: a.year, colour: a.colour,
  emirate: a.emirate, plate: a.plate || '', vin: a.vin, engine: a.engine || '', capacity: a.capacity, company: a.company,
  department: a.department, location: a.location, status: a.status, usage: a.usage, officer: a.officer, acquired: a.acquired,
  odometer: a.odometer, remarks: a.remarks || '', photo: a.photo_file_id ? `/api/files/${a.photo_file_id}` : null,
  created: { by: a.created_by || 'System', at: isoDay(a.created_at) }, updated: { by: a.updated_by || 'System', at: isoDay(a.updated_at) },
  docs,
});

export async function loadEmployees(opts: { uids?: string[] } = {}, db: Db = pool) {
  const rows = await q<any>(`SELECT * FROM employees ${opts.uids ? 'WHERE id = ANY($1)' : ''} ORDER BY emp_no`, opts.uids ? [opts.uids] : [], db);
  const docs = await loadDocs('hr', opts.uids || null, db);
  return rows.map((e) => empOut(e, docs.get(e.id) || []));
}
export async function loadAssets(opts: { uids?: string[] } = {}, db: Db = pool) {
  const rows = await q<any>(`SELECT * FROM assets ${opts.uids ? 'WHERE id = ANY($1)' : ''} ORDER BY fleet_no`, opts.uids ? [opts.uids] : [], db);
  const docs = await loadDocs('fleet', opts.uids || null, db);
  return rows.map((a) => assetOut(a, docs.get(a.id) || []));
}
export async function loadLeaves(opts: { ids?: string[]; empUids?: string[] } = {}, db: Db = pool) {
  const cond: string[] = []; const params: any[] = [];
  if (opts.ids) { params.push(opts.ids); cond.push(`l.id = ANY($${params.length})`); }
  if (opts.empUids) { params.push(opts.empUids); cond.push(`l.employee_id = ANY($${params.length})`); }
  const rows = await q<any>(`SELECT l.*, e.emp_no FROM leave_requests l JOIN employees e ON e.id = l.employee_id ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''} ORDER BY l.start_date DESC`, params, db);
  const ev = rows.length ? await q<any>('SELECT * FROM leave_events WHERE leave_id = ANY($1) ORDER BY at', [rows.map((r) => r.id)], db) : [];
  const trail = new Map<string, any[]>();
  ev.forEach((x) => { const l = trail.get(x.leave_id) || []; l.push({ at: new Date(x.at).toISOString().slice(0, 16).replace('T', ' '), by: x.by_user, what: x.from_status ? `${x.from_status} → ${x.to_status}${x.note ? ` (${x.note})` : ''}` : 'Submitted' }); trail.set(x.leave_id, l); });
  return rows.map((l) => ({
    id: l.id, uid: l.employee_id, empId: l.emp_no, type: l.type, start: l.start_date, end: l.end_date, days: l.days, reason: l.reason,
    contactAbroad: l.contact_abroad, status: l.status, requestedBy: l.requested_by, requestedOn: l.requested_on, hrNote: l.hr_note,
    decidedBy: l.decided_by, rejectReason: l.reject_reason, rejoined: l.rejoined, rejoinNote: l.rejoin_note, trail: trail.get(l.id) || [],
  }));
}

// ---------- per-user filtering (§4.1: deny by default, sensitive employee documents hidden from other roles) ----------
const LIMITED_FIELDS = ['gender', 'dob', 'email', 'emergencyContact', 'homeAddress', 'notes', 'insurancePlan', 'insuranceProvider'];
export function employeeForUser(u: any, e: any) {
  const out = { ...e, docs: visibleDocs(u, e.docs) };
  if ((ROLES as any)[u.role]?.noDocs) LIMITED_FIELDS.forEach((k) => { out[k] = null; });
  return out;
}
export const assetForUser = (u: any, a: any) => ({ ...a, docs: visibleDocs(u, a.docs) });

// ---------- record cache ----------
// The full employee and asset lists (with current documents, history and open actions) are cached in memory and
// reused until the database's change counter moves (migration 003). Checking the counter is one tiny query, so a
// write from any user or any app instance is visible on the next request. Cached objects are never modified:
// per-user views are copies. Outside production they are frozen so an accidental change fails loudly.
const cache: { v: number | null; employees: any[] | null; assets: any[] | null; loading: Record<string, Promise<any[]> | null> } = { v: null, employees: null, assets: null, loading: {} };
const deepFreeze = (o: any) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };
async function cached(kind: 'employees' | 'assets') {
  const row = await one<any>('SELECT v FROM data_version WHERE id = 1');
  const v = row ? Number(row.v) : -1;
  if (v !== cache.v) { cache.v = v; cache.employees = null; cache.assets = null; cache.loading = {}; }
  if (cache[kind]) return cache[kind]!;
  if (!cache.loading[kind]) {
    const at = v;
    cache.loading[kind] = (kind === 'employees' ? loadEmployees() : loadAssets()).then((list) => {
      if (!isProd) deepFreeze(list);
      if (cache.v === at) cache[kind] = list;
      return list;
    }).finally(() => { if (cache.v === at) cache.loading[kind] = null; });
  }
  return cache.loading[kind]!;
}
export const clearRecordCache = () => { cache.v = null; cache.employees = null; cache.assets = null; cache.loading = {}; };

export async function scopedData(u: any) {
  const [emps, assets] = await Promise.all([canModule(u, 'hr') ? cached('employees') : [], canModule(u, 'fleet') ? cached('assets') : []]);
  const employees = scopeEmployees(u, emps).map((e: any) => employeeForUser(u, e));
  const leaves = canModule(u, 'hr') ? await loadLeaves({ empUids: employees.map((e: any) => e.uid) }) : [];
  return { employees, leaves, assets: scopeAssets(u, assets).map((a: any) => assetForUser(u, a)) };
}

// ---------- lookups with scope checks ----------
export async function employeeRow(u: any, empNo: string, db: Db = pool) {
  const e = await one<any>('SELECT * FROM employees WHERE emp_no = $1', [empNo], db);
  if (!e || !canModule(u, 'hr')) throw notFound();
  if ((ROLES as any)[u.role]?.scoped && e.department !== u.scope) throw notFound();
  return e;
}
export async function assetRow(u: any, fleetNo: string, db: Db = pool) {
  const a = await one<any>('SELECT * FROM assets WHERE fleet_no = $1', [fleetNo], db);
  if (!a || !canModule(u, 'fleet')) throw notFound();
  return a;
}
export async function getEmployeeOut(u: any, uid: string, db: Db = pool) {
  const [e] = await loadEmployees({ uids: [uid] }, db);
  return employeeForUser(u, e);
}
export async function getAssetOut(u: any, uid: string, db: Db = pool) {
  const [a] = await loadAssets({ uids: [uid] }, db);
  return assetForUser(u, a);
}
