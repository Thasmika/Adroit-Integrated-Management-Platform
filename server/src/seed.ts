// Initial setup (§16 step 10: reference masters) and optional demo data.
//   seed          → reference masters, document types, templates, configuration, first administrator
//   seed --demo   → the above plus fictional employees, fleet, documents (with sample PDF scans) and leave
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pool, tx, q, one } from './db.js';
import { env } from './env.js';
import { loadConfig, SYSTEM_DEFAULTS } from './config.js';
import { hashPassword } from './auth.js';
import { COMPANIES_INIT, DEPARTMENTS_INIT, LOCATIONS_INIT, USERS_INIT, DOC_TYPES_INIT, DEFAULT_CATEGORIES, TODAY, iso, addDays } from '@adroit/core/src/core/shared.js';

const TEMPLATES = [
  ['T1', 'Document entering warning window', 'Responsible officer', '{docType} for {owner} expires on {expiry}', 'In-app + email'],
  ['T2', 'Document urgent (≤ urgent threshold)', 'Responsible officer', 'URGENT: {docType} for {owner} expires in {days} days', 'In-app + email'],
  ['T3', 'Document expired', 'Responsible officer + Management (escalation)', 'EXPIRED: {docType} for {owner} expired on {expiry}', 'In-app + email'],
  ['T4', 'Leave request submitted', 'HR Officer', 'Leave request {ref} for {owner} needs review', 'In-app'],
  ['T5', 'Leave sent for approval', 'Management', 'Leave {ref} for {owner} awaiting approval', 'In-app'],
  ['T6', 'Weekly attention digest', 'Management', 'Adroit weekly attention summary', 'Email'],
  ['T7', 'Leave decision', 'Requester', 'Leave {ref} for {owner}: {status}', 'In-app'],
];
export const DEMO_PASSWORD = 'Adroit@2026';

async function seedMasters(c: any, demo: boolean) {
  const companies = demo ? COMPANIES_INIT : COMPANIES_INIT.slice(0, 1);
  for (const x of companies) await c.query('INSERT INTO companies (id, name, short, kind, active) VALUES ($1,$2,$3,$4,true) ON CONFLICT DO NOTHING', [x.id, x.name, x.short, x.kind]);
  for (const x of DEPARTMENTS_INIT) await c.query('INSERT INTO departments (id, name) VALUES ($1,$2) ON CONFLICT DO NOTHING', [x.id, x.name]);
  for (const x of LOCATIONS_INIT) await c.query('INSERT INTO locations (id, name) VALUES ($1,$2) ON CONFLICT DO NOTHING', [x.id, x.name]);
  for (const [i, n] of DEFAULT_CATEGORIES.entries()) await c.query('INSERT INTO asset_categories (name, sort) VALUES ($1,$2) ON CONFLICT DO NOTHING', [n, i]);
  for (const t of TEMPLATES) await c.query('INSERT INTO notification_templates (id, event, audience, subject, channel) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', t);
  for (const [k, v] of Object.entries({ ...SYSTEM_DEFAULTS, alertsEnabled: demo, demoMode: demo })) await c.query('INSERT INTO system_config (key, value) VALUES ($1,$2) ON CONFLICT DO NOTHING', [k, JSON.stringify(v)]);
}

async function seedDocTypes(c: any, withOfficers: boolean) {
  for (const [i, t] of DOC_TYPES_INIT.entries()) {
    await c.query(
      `INSERT INTO document_types (key, module, short, expires, required, required_for, urgent_days, due_days, monitor_days, officer_user_id, sort)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,
      [t.key, t.module, t.short, t.expires, !!t.required, (t as any).requiredFor || [], t.urgent, t.due, t.monitor, withOfficers ? t.officer : null, i]);
  }
}

export async function seedProduction(log = console.log) {
  const exists = await one('SELECT 1 FROM companies LIMIT 1');
  if (exists) { log('reference data already present; nothing to do'); return; }
  let password = env.adminPassword;
  let generated = false;
  if (!password) { password = crypto.randomBytes(9).toString('base64url') + '7'; generated = true; }
  await tx(async (c) => {
    await seedMasters(c, false);
    await c.query('INSERT INTO users (id, name, email, password_hash, role, must_change_password) VALUES ($1,$2,$3,$4,$5,true)',
      ['u-admin', env.adminName, env.adminEmail, await hashPassword(password), 'sysadmin']);
    await seedDocTypes(c, false);
    await c.query(`INSERT INTO audit_events (user_name, role, action, entity, record, detail) VALUES ('System','System','Create','System','Initial setup','Reference masters, document types and administrator created')`);
  });
  log(`administrator: ${env.adminEmail}`);
  if (generated) log(`temporary password (change at first sign-in): ${password}`);
}

// ---------- demo data ----------
function makePdf(lines: string[]) {
  const esc = (s: string) => s.replace(/[\\()]/g, (m) => '\\' + m).replace(/[^\x20-\x7e]/g, '-');
  const content = ['BT /F1 18 Tf 60 780 Td', ...lines.map((l, i) => `${i === 0 ? '' : '0 -26 Td '}(${esc(l)}) Tj${i === 0 ? ' /F1 12 Tf' : ''}`), 'ET',
    '0.75 0.2 0.1 RG 2 w 40 700 m 555 700 l S'].join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

async function writeSample(c: any, owner: { module: 'hr' | 'fleet'; id: string }, name: string, lines: string[]) {
  const buf = makePdf(['SAMPLE SCAN - DEMO DATA', ...lines]);
  const id = crypto.randomUUID();
  const d = new Date();
  const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${id}`;
  const full = path.join(env.filesDir, key);
  await fsp.mkdir(path.dirname(full), { recursive: true });
  await fsp.writeFile(full, buf);
  await c.query(`INSERT INTO files (id, storage_key, original_name, mime, size_bytes, sha256, owner_module, owner_id, uploaded_by)
                 VALUES ($1,$2,$3,'application/pdf',$4,$5,$6,$7,NULL)`,
    [id, key, name, buf.length, crypto.createHash('sha256').update(buf).digest('hex'), owner.module, owner.id]);
  return id;
}

async function insertDocs(c: any, module: 'hr' | 'fleet', ownerUid: string, ownerNo: string, ownerName: string, docs: any[], userByName: Map<string, string>) {
  for (const d of docs) {
    const docId = crypto.randomUUID();
    await c.query('INSERT INTO documents (id, owner_module, owner_id, type, name) VALUES ($1,$2,$3,$4,$5)', [docId, module, ownerUid, d.type, d.name || d.type]);
    for (const h of [...(d.history || [])].reverse()) {
      const fid = await writeSample(c, { module, id: ownerUid }, h.file, [`${d.name || d.type} (previous version)`, `${ownerNo}  ${ownerName}`, `Ref: ${h.ref}`, `Issued: ${h.issued}   Expiry: ${h.expiry}`]);
      await c.query(`INSERT INTO document_versions (document_id, ref, issuer, issued, expiry, file_id, is_current, created_by, created_at, superseded_at, superseded_by)
                     VALUES ($1,$2,$3,$4,$5,$6,false,'Data migration',$7,$8,'Data migration')`,
        [docId, h.ref, d.issuer || null, h.issued || null, h.expiry || null, fid, h.issued || iso(TODAY), h.replacedOn]);
    }
    const fid = d.file ? await writeSample(c, { module, id: ownerUid }, d.file.name, [d.name || d.type, `${ownerNo}  ${ownerName}`, `Ref: ${d.ref || '-'}`, `Issued by: ${d.issuer || '-'}`, `Issued: ${d.issued || '-'}   Expiry: ${d.expiry || '-'}`]) : null;
    await c.query(`INSERT INTO document_versions (document_id, ref, issuer, issued, expiry, file_id, is_current, created_by)
                   VALUES ($1,$2,$3,$4,$5,$6,true,'Data migration')`, [docId, d.ref || null, d.issuer || null, d.issued || null, d.expiry || null, fid]);
    if (d.renewal) {
      const a = await one<any>(`INSERT INTO expiry_actions (document_id, status, note, assigned_to, updated_by, updated_at, opened_at)
                                VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING id`,
        [docId, d.renewal.status, d.renewal.note, userByName.get(d.renewal.by) || null, d.renewal.by, d.renewal.date], c);
      await c.query('INSERT INTO action_events (action_id, at, by_user, status, note) VALUES ($1,$2,$3,$4,$5)', [a.id, d.renewal.date, d.renewal.by, d.renewal.status, d.renewal.note]);
    }
  }
}

export async function seedDemo(opts: { reset?: boolean } = {}, log = console.log) {
  if (opts.reset) {
    log('removing existing data');
    await pool.query(`TRUNCATE action_events, expiry_actions, document_versions, documents, leave_events, leave_requests, notifications,
      ai_interactions, job_runs, import_batches, sessions, employees, assets, files, document_types, notification_templates, system_config,
      users, asset_categories, locations, departments, companies RESTART IDENTITY CASCADE`);
    await pool.query('ALTER TABLE audit_events DISABLE TRIGGER audit_no_update');
    await pool.query('TRUNCATE audit_events RESTART IDENTITY');
    await pool.query('ALTER TABLE audit_events ENABLE TRIGGER audit_no_update');
    await pool.query("SELECT setval('leave_seq', 1, false)");
    await fsp.rm(env.filesDir, { recursive: true, force: true });
  } else if (await one('SELECT 1 FROM employees LIMIT 1')) {
    throw new Error('Employees already exist. Use --demo --reset to replace everything with demo data.');
  }
  const pw = await hashPassword(DEMO_PASSWORD);
  await tx(async (c) => {
    await seedMasters(c, true);
    for (const u of USERS_INIT) {
      await c.query('INSERT INTO users (id, name, email, password_hash, role, scope_department) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
        [u.id, u.name, u.email, pw, u.role, (u as any).scope || null]);
    }
    await seedDocTypes(c, true);
  });
  await loadConfig();
  // generators live in the shared package (also used by the clickable prototype)
  const { makeHr } = await import('@adroit/core/src/hr/data.js');
  const { makeFleet } = await import('@adroit/core/src/fleet/data.js');
  const hr = makeHr();
  const fleet = makeFleet();
  const userByName = new Map(USERS_INIT.map((u) => [u.name, u.id]));
  log(`inserting ${hr.employees.length} employees, ${fleet.assets.length} assets, ${hr.leaves.length} leave records`);
  await tx(async (c) => {
    const empUid = new Map<string, string>();
    for (const e of hr.employees) {
      const uid = crypto.randomUUID();
      empUid.set(e.id, uid);
      await c.query(`INSERT INTO employees (id, emp_no, name, gender, nationality, dob, department, location, designation, mobile, email, status, joined,
          company, sponsor, dept_head, insurance_plan, insurance_provider, emergency_contact, home_address, notes, created_by, created_at, updated_by, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'Data migration',$22,'Data migration',$22)`,
        [uid, e.id, e.name, e.gender, e.nationality, e.dob, e.department, e.location, e.designation, e.mobile, e.email || null, e.status, e.joined,
          e.company, e.sponsor, e.deptHead, e.insurancePlan, e.insuranceProvider, e.emergencyContact, e.homeAddress || null, e.notes || null, e.created.at]);
      await insertDocs(c, 'hr', uid, e.id, e.name, e.docs, userByName);
    }
    for (const a of fleet.assets) {
      const uid = crypto.randomUUID();
      await c.query(`INSERT INTO assets (id, fleet_no, category, make, model, body, year, colour, emirate, plate, vin, engine, capacity, company, department,
          location, status, usage, officer, acquired, odometer, remarks, created_by, created_at, updated_by, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,'Data migration',$23,'Data migration',$23)`,
        [uid, a.id, a.category, a.make, a.model, a.body, a.year, a.colour, a.emirate, a.plate || null, a.vin, a.engine || null, a.capacity, a.company,
          a.department, a.location, a.status, a.usage, a.officer, a.acquired, a.odometer, a.remarks || null, a.created.at]);
      await insertDocs(c, 'fleet', uid, a.id, `${a.make} ${a.model}`, a.docs, userByName);
      for (const ev of [...(fleet.events[a.id] || [])].reverse()) {
        await c.query(`INSERT INTO audit_events (at, user_name, role, action, entity, record, detail) VALUES ($1,'Data migration','System','Update','Asset',$2,$3)`, [ev.date + 'T08:00:00', a.id, ev.what]);
      }
    }
    let n = 0;
    for (const l of [...hr.leaves].sort((x: any, y: any) => (x.requestedOn < y.requestedOn ? -1 : 1))) {
      n++;
      const id = `LV-${String(l.start).slice(0, 4)}-${String(n).padStart(4, '0')}`;
      await c.query(`INSERT INTO leave_requests (id, employee_id, type, start_date, end_date, days, reason, status, requested_by, requested_on, hr_note, decided_by, reject_reason, rejoined)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [id, empUid.get(l.empId), l.type, l.start, l.end, l.days, l.reason, l.status, l.requestedBy, l.requestedOn, l.hrNote || null, l.decidedBy || null, l.rejectReason || null, l.rejoined || null]);
      await c.query('INSERT INTO leave_events (leave_id, at, by_user, to_status) VALUES ($1,$2,$3,$4)', [id, l.requestedOn + 'T09:00:00', l.requestedBy, 'Pending HR Review']);
      if (l.status !== 'Pending HR Review') {
        const final = l.status;
        if (['Pending Approval', 'Approved', 'On Leave', 'Awaiting Rejoining', 'Completed'].includes(final)) await c.query('INSERT INTO leave_events (leave_id, at, by_user, from_status, to_status, note) VALUES ($1,$2,$3,$4,$5,$6)', [id, iso(addDays(new Date(l.requestedOn), 1)) + 'T10:00:00', 'Nadeesha Perera', 'Pending HR Review', 'Pending Approval', l.hrNote || 'Record checked']);
        if (['Approved', 'On Leave', 'Awaiting Rejoining', 'Completed'].includes(final)) await c.query('INSERT INTO leave_events (leave_id, at, by_user, from_status, to_status) VALUES ($1,$2,$3,$4,$5)', [id, iso(addDays(new Date(l.requestedOn), 2)) + 'T11:00:00', 'General Manager', 'Pending Approval', 'Approved']);
        if (final === 'Rejected') await c.query('INSERT INTO leave_events (leave_id, at, by_user, from_status, to_status, note) VALUES ($1,$2,$3,$4,$5,$6)', [id, iso(addDays(new Date(l.requestedOn), 2)) + 'T11:00:00', 'General Manager', 'Pending Approval', 'Rejected', l.rejectReason]);
        if (final === 'Completed') await c.query('INSERT INTO leave_events (leave_id, at, by_user, from_status, to_status, note) VALUES ($1,$2,$3,$4,$5,$6)', [id, (l.rejoined || l.end) + 'T09:00:00', 'Nadeesha Perera', 'Awaiting Rejoining', 'Completed', `rejoined ${l.rejoined || l.end}`]);
      }
    }
    await c.query("SELECT setval('leave_seq', $1)", [n]);
    await c.query(`INSERT INTO audit_events (user_name, role, action, entity, record, detail) VALUES ('System','System','Import','Demo data','Seed',$1)`,
      [`${hr.employees.length} employees, ${fleet.assets.length} assets, ${hr.leaves.length} leave records loaded`]);
  });
  log(`demo users (password "${DEMO_PASSWORD}"): ${USERS_INIT.map((u) => u.email).join(', ')}`);
}
