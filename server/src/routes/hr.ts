// Employee module (§6) and Leave & Rejoining workflow (§7).
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser, can, assert, forbidden, bad, requireModule, HttpError } from '../auth.js';
import { one, q, tx, pool } from '../db.js';
import { audit, diffText } from '../audit.js';
import { employeeRow, getEmployeeOut, loadLeaves, scopedData } from '../model.js';
import { saveDocument } from '../services/documents.js';
import { storeFile, removeStored } from '../storage.js';
import { notify } from '../jobs.js';
import { cfg, loadConfig, publicConfig } from '../config.js';
import { ROLES, iso, fmt } from '@adroit/core/src/core/shared.js';

const opt = z.string().trim().max(300).optional().nullable().transform((v) => (v === '' ? null : v));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal('').transform(() => null));
// Employee number and code are entered by the user (Changes Report 01, item 1). The number is fixed once the record is created.
const empNoField = z.string().trim().min(1, 'Enter the employee number.').max(30, 'Employee number is too long.');
export const EmployeeInput = z.object({
  empNo: empNoField.optional(), empCode: opt, molId: opt,
  name: z.string().trim().min(2).max(150),
  gender: opt, nationality: opt, dob: date, department: z.string().min(1), location: opt, designation: z.string().trim().min(1).max(120),
  mobile: opt, email: z.string().trim().email().max(200).optional().nullable().or(z.literal('').transform(() => null)),
  status: z.enum(['Active', 'On Notice', 'Inactive', 'Resigned', 'Terminated']).default('Active'), joined: date,
  company: z.string().min(1), sponsor: z.string().min(1), deptHead: opt, insurancePlan: opt, insuranceProvider: opt,
  emergencyContact: opt, homeAddress: opt, notes: opt,
  docs: z.array(z.object({ type: z.string(), ref: z.string().optional().nullable(), issuer: z.string().optional().nullable(), issued: z.string().optional().nullable(), expiry: z.string().optional().nullable() })).optional(),
});
const COLS: Record<string, string> = { empCode: 'emp_code', molId: 'mol_id', name: 'name', gender: 'gender', nationality: 'nationality', dob: 'dob', department: 'department', location: 'location', designation: 'designation',
  mobile: 'mobile', email: 'email', status: 'status', joined: 'joined', company: 'company', sponsor: 'sponsor', deptHead: 'dept_head', insurancePlan: 'insurance_plan',
  insuranceProvider: 'insurance_provider', emergencyContact: 'emergency_contact', homeAddress: 'home_address', notes: 'notes' };
const LABELS = { empCode: 'employee code', molId: 'Emp (MOL) ID', name: 'name', status: 'status', department: 'department', location: 'location', company: 'operational company', sponsor: 'visa sponsor', designation: 'designation', joined: 'joining date' };

// uniqueness checks with readable messages (the database also enforces them)
export async function checkEmployeeKeys(c: any, b: { empNo?: string | null; molId?: string | null }, exceptUid?: string) {
  if (b.empNo && await one('SELECT 1 FROM employees WHERE lower(emp_no) = lower($1) AND id IS DISTINCT FROM $2', [b.empNo, exceptUid || null], c))
    throw new HttpError(409, `Employee number ${b.empNo} already exists.`, 'duplicate');
  if (b.molId) {
    const m = await one<any>('SELECT emp_no, name FROM employees WHERE lower(mol_id) = lower($1) AND id IS DISTINCT FROM $2', [b.molId, exceptUid || null], c);
    if (m) throw new HttpError(409, `Emp (MOL) ID ${b.molId} is already recorded for ${m.emp_no} ${m.name}.`, 'duplicate');
  }
}

export async function createEmployee(c: any, user: any, actor: any, b: z.infer<typeof EmployeeInput>, opts: { empNo?: string } = {}) {
  const empNo = (opts.empNo || b.empNo || '').trim();
  if (!empNo) throw bad('Enter the employee number.');
  await checkEmployeeKeys(c, { empNo, molId: b.molId });
  const head = b.deptHead || (await one<any>('SELECT dept_head FROM employees WHERE department = $1 AND dept_head IS NOT NULL LIMIT 1', [b.department], c))?.dept_head || null;
  const keys = Object.keys(COLS).filter((k) => k !== 'deptHead');
  const e = await one<any>(
    `INSERT INTO employees (emp_no, ${keys.map((k) => COLS[k]).join(', ')}, dept_head, created_by, updated_by)
     VALUES ($1, ${keys.map((_, i) => `$${i + 2}`).join(', ')}, $${keys.length + 2}, $${keys.length + 3}, $${keys.length + 3}) RETURNING *`,
    [empNo, ...keys.map((k) => (b as any)[k] ?? null), head, actor.name], c);
  await audit(c, actor, 'Create', 'Employee', empNo, `${b.name} · ${b.designation} · ${b.department}`, undefined, { name: b.name, department: b.department, sponsor: b.sponsor });
  for (const d of b.docs || []) {
    if (!d.ref && !d.expiry) continue;
    await saveDocument(c, user, actor, 'hr', { uid: e.id, no: empNo, label: b.name }, d.type, 'upload', { ref: d.ref || '', issuer: d.issuer || (d.type === 'Health Insurance' ? b.insuranceProvider : '') || '', issued: d.issued || '', expiry: d.expiry || '' }, null);
  }
  return e;
}

export default async function hrRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (req) => { if (req.url.startsWith('/api/employees') || req.url.startsWith('/api/leave')) { await requireUser(req); requireModule(req.user, 'hr'); } });

  app.get('/api/employees', async (req) => {
    const { employees } = await scopedData(req.user);
    return { items: employees };
  });
  app.get('/api/employees/:no', async (req) => {
    const e = await employeeRow(req.user, decodeURIComponent((req.params as any).no));
    return getEmployeeOut(req.user, e.id);
  });

  app.post('/api/employees', async (req) => {
    assert(can(req.user, 'editEmployee'));
    const b = EmployeeInput.parse(req.body);
    if (!b.empNo) throw bad('Enter the employee number.');
    if (b.dob && await one('SELECT 1 FROM employees WHERE lower(name) = lower($1) AND dob = $2', [b.name, b.dob])) throw new HttpError(409, 'An employee with the same name and date of birth already exists.', 'duplicate');
    const e = await tx((c) => createEmployee(c, req.user, req.actor, b));
    return getEmployeeOut(req.user, e.id);
  });

  app.put('/api/employees/:no', async (req) => {
    assert(can(req.user, 'editEmployee'));
    const b = EmployeeInput.parse(req.body);
    const cur = await employeeRow(req.user, decodeURIComponent((req.params as any).no));
    await tx(async (c) => {
      await checkEmployeeKeys(c, { molId: b.molId }, cur.id);
      const keys = Object.keys(COLS);
      await c.query(`UPDATE employees SET ${keys.map((k, i) => `${COLS[k]} = $${i + 2}`).join(', ')}, updated_by = $${keys.length + 2}, updated_at = now() WHERE id = $1`,
        [cur.id, ...keys.map((k) => (b as any)[k] ?? null), req.actor.name]);
      const before = Object.fromEntries(Object.entries(COLS).map(([k, col]) => [k, cur[col]]));
      await audit(c, req.actor, 'Update', 'Employee', cur.emp_no, diffText(before, b, LABELS) || 'Profile details updated', before, b);
      // document numbers / dates edited on the form update the current version (renewals go through Renew)
      const docs = await q<any>(`SELECT d.type, v.ref, v.issued, v.expiry FROM documents d JOIN document_versions v ON v.document_id = d.id AND v.is_current WHERE d.owner_module = 'hr' AND d.owner_id = $1`, [cur.id], c);
      for (const d of b.docs || []) {
        const ex = docs.find((x) => x.type === d.type);
        if (!ex && !d.ref && !d.expiry) continue;
        if (ex && (d.ref || '') === (ex.ref || '') && (d.issued || '') === (ex.issued || '') && (d.expiry || '') === (ex.expiry || '')) continue;
        await saveDocument(c, req.user, req.actor, 'hr', { uid: cur.id, no: cur.emp_no, label: b.name }, d.type, 'upload', { ref: d.ref || '', issued: d.issued || '', expiry: d.expiry || '' }, null);
      }
    });
    return getEmployeeOut(req.user, cur.id);
  });

  app.post('/api/employees/:no/photo', async (req) => {
    assert(can(req.user, 'editEmployee'));
    const cur = await employeeRow(req.user, decodeURIComponent((req.params as any).no));
    const part = await req.file();
    if (!part) throw bad('Choose a photo.');
    const buf = await part.toBuffer();
    let full: string | undefined;
    try {
      await tx(async (c) => {
        const f = await storeFile(c, buf, part.filename, { module: 'hr', id: cur.id }, req.user.id, 'photo');
        full = f.full;
        await c.query('UPDATE employees SET photo_file_id = $2, updated_by = $3, updated_at = now() WHERE id = $1', [cur.id, f.id, req.actor.name]);
        await audit(c, req.actor, 'Upload', 'Employee', cur.emp_no, 'Profile photo updated');
      });
    } catch (e) { await removeStored(full); throw e; }
    return getEmployeeOut(req.user, cur.id);
  });

  // ---------- MOL register (Changes Report 01, item 2) ----------
  // Emp (MOL) ID per employee; edited by HR from the register or the employee form
  app.put('/api/employees/:no/mol', async (req) => {
    assert(can(req.user, 'editEmployee'));
    const b = z.object({ molId: opt }).parse(req.body);
    const cur = await employeeRow(req.user, decodeURIComponent((req.params as any).no));
    if ((cur.mol_id || null) === (b.molId || null)) return getEmployeeOut(req.user, cur.id);
    await tx(async (c) => {
      await checkEmployeeKeys(c, { molId: b.molId }, cur.id);
      await c.query('UPDATE employees SET mol_id = $2, updated_by = $3, updated_at = now() WHERE id = $1', [cur.id, b.molId || null, req.actor.name]);
      await audit(c, req.actor, 'Update', 'Employee', cur.emp_no, `Emp (MOL) ID ${cur.mol_id || '—'} → ${b.molId || '—'}`, { molId: cur.mol_id }, { molId: b.molId });
    });
    return getEmployeeOut(req.user, cur.id);
  });

  // Company MOL code: one unique code per company (HR or System Administrator)
  app.put('/api/companies/:id/mol', { preHandler: requireUser }, async (req) => {
    assert(can(req.user, 'editEmployee'));
    const b = z.object({ molCode: z.string().trim().max(40).optional().nullable().transform((v) => (v ? v : null)) }).parse(req.body);
    const id = decodeURIComponent((req.params as any).id);
    const cur = await one<any>('SELECT * FROM companies WHERE id = $1', [id]);
    if (!cur) throw new HttpError(404, 'Company not found.');
    if (b.molCode) {
      const other = await one<any>('SELECT name FROM companies WHERE lower(mol_code) = lower($1) AND id <> $2', [b.molCode, id]);
      if (other) throw new HttpError(409, `MOL code ${b.molCode} is already used by ${other.name}. Each company has its own MOL code.`, 'duplicate');
    }
    if ((cur.mol_code || null) !== b.molCode) {
      await pool.query('UPDATE companies SET mol_code = $2 WHERE id = $1', [id, b.molCode]);
      await audit(null, req.actor, 'Configure', 'Company', cur.name, `MOL code ${cur.mol_code || '—'} → ${b.molCode || '—'}`, { molCode: cur.mol_code }, { molCode: b.molCode });
      await loadConfig();
    }
    return publicConfig(req.user);
  });

  // ---------- Leave & Rejoining (§7) ----------
  app.get('/api/leave', async (req) => {
    const { leaves } = await scopedData(req.user);
    return { items: leaves };
  });

  const LeaveInput = z.object({
    empId: z.string(), type: z.enum(['Annual Leave', 'Emergency Leave', 'Sick Leave']),
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().trim().min(2, 'Enter the reason or remarks.').max(500), contactAbroad: z.string().max(100).optional().nullable(),
  });

  app.post('/api/leave', async (req) => {
    assert(can(req.user, 'submitLeave'));
    const b = LeaveInput.parse(req.body);
    if (b.end < b.start) throw bad('The last day must be on or after the first day.');
    const e = await employeeRow(req.user, b.empId);
    if (!['Active', 'On Notice'].includes(e.status)) throw bad(`${e.name} is ${e.status}; leave can't be requested.`);
    const days = Math.round((Date.parse(b.end) - Date.parse(b.start)) / 864e5) + 1;
    const id = await tx(async (c) => {
      const overlap = await one<any>(`SELECT id FROM leave_requests WHERE employee_id = $1 AND status NOT IN ('Rejected','Completed','Cancelled') AND NOT (end_date < $2 OR start_date > $3)`, [e.id, b.start, b.end], c);
      if (overlap) throw bad(`This employee already has leave ${overlap.id} in these dates.`);
      const n = await one<any>("SELECT nextval('leave_seq') AS n", [], c);
      const lid = `LV-${new Date().getFullYear()}-${String(n.n).padStart(4, '0')}`;
      await c.query(`INSERT INTO leave_requests (id, employee_id, type, start_date, end_date, days, reason, contact_abroad, status, requested_by)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Pending HR Review',$9)`, [lid, e.id, b.type, b.start, b.end, days, b.reason, b.contactAbroad || null, req.actor.name]);
      await c.query("INSERT INTO leave_events (leave_id, by_user, to_status) VALUES ($1,$2,'Pending HR Review')", [lid, req.actor.name]);
      await audit(c, req.actor, 'Create', 'Leave', lid, `${b.type} ${fmt(b.start)} → ${fmt(b.end)} (${days} days) for ${e.emp_no} ${e.name}`);
      return lid;
    });
    for (const hr of await q<any>("SELECT id FROM users WHERE active AND role = 'hr'")) await notify(hr.id, 'T4', { ref: id, owner: `${e.emp_no} ${e.name}` }, '#hr-leave.queue', `leave:${id}:submitted`);
    return (await loadLeaves({ ids: [id] }))[0];
  });

  const ACTIONS: Record<string, { perm: string; from: string[]; to: (l: any) => string; label: string }> = {
    review: { perm: 'reviewLeave', from: ['Pending HR Review'], to: () => 'Pending Approval', label: 'Review' },
    approve: { perm: 'approveLeave', from: ['Pending Approval'], to: (l) => (l.start_date <= iso(new Date()) ? 'On Leave' : 'Approved'), label: 'Approve' },
    reject: { perm: 'reject', from: ['Pending HR Review', 'Pending Approval'], to: () => 'Rejected', label: 'Reject' },
    rejoin: { perm: 'rejoin', from: ['On Leave', 'Awaiting Rejoining'], to: () => 'Completed', label: 'Rejoin' },
  };

  app.post('/api/leave/:id/:action', async (req) => {
    const { id, action } = req.params as any;
    const a = ACTIONS[action];
    if (!a) throw bad('Unknown action.');
    const b = z.object({ note: z.string().max(500).optional().default(''), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(req.body || {});
    const result = await tx(async (c) => {
      const l = await one<any>('SELECT l.*, e.emp_no, e.name, e.department FROM leave_requests l JOIN employees e ON e.id = l.employee_id WHERE l.id = $1 FOR UPDATE OF l', [id], c);
      if (!l) throw new HttpError(404, 'Leave request not found.');
      await employeeRow(req.user, l.emp_no, c);   // scope check
      if (!a.from.includes(l.status)) throw bad(`This request is ${l.status}; it can't be changed that way.`);
      const u = req.user;
      if (action === 'reject') assert(l.status === 'Pending HR Review' ? can(u, 'reviewLeave') : can(u, 'approveLeave'), forbidden(`Only ${l.status === 'Pending HR Review' ? 'HR' : 'Management'} can reject at this stage.`));
      else assert(can(u, a.perm), forbidden());
      if (action === 'reject' && !b.note.trim()) throw bad('Enter the reason for rejection.');
      const to = a.to(l);
      const set: Record<string, any> = { status: to };
      if (action === 'review') set.hr_note = b.note || 'Record checked';
      if (action === 'approve' || action === 'reject') { set.decided_by = req.actor.name; set.decided_at = new Date(); }
      if (action === 'reject') set.reject_reason = b.note;
      if (action === 'rejoin') {
        const d = b.date || iso(new Date());
        if (d < l.start_date) throw bad('The rejoining date is before the leave started.');
        if (d > iso(new Date())) throw bad('The rejoining date is in the future.');
        set.rejoined = d; set.rejoin_note = b.note || null;
      }
      const keys = Object.keys(set);
      await c.query(`UPDATE leave_requests SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() WHERE id = $1`, [id, ...keys.map((k) => set[k])]);
      await c.query('INSERT INTO leave_events (leave_id, by_user, from_status, to_status, note) VALUES ($1,$2,$3,$4,$5)', [id, req.actor.name, l.status, to, action === 'rejoin' ? `rejoined ${fmt(set.rejoined)}${b.note ? ` · ${b.note}` : ''}` : b.note || null]);
      await audit(c, req.actor, a.label, 'Leave', id, `${l.status} → ${to}${b.note ? ` · ${b.note}` : ''} (${l.emp_no} ${l.name})`, { status: l.status }, { status: to });
      return { l, to };
    });
    const vars = { ref: id, owner: `${result.l.emp_no} ${result.l.name}`, status: result.to };
    if (result.to === 'Pending Approval') for (const m of await q<any>("SELECT id FROM users WHERE active AND role = 'management'")) await notify(m.id, 'T5', vars, '#hr-leave.queue', `leave:${id}:approval`);
    if (['Approved', 'On Leave', 'Rejected'].includes(result.to)) {
      const requester = await one<any>('SELECT id FROM users WHERE active AND name = $1', [result.l.requested_by]);
      if (requester) await notify(requester.id, 'T7', vars, '#hr-leave.history', `leave:${id}:decision`);
    }
    return (await loadLeaves({ ids: [id] }))[0];
  });
}
