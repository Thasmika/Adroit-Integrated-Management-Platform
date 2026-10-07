// Controlled data migration (§16): CSV import with a validate-only dry run, row-level accept / reject log,
// duplicate detection, reference checks and reconciliation counts. HR imports employees; Fleet imports assets.
import { FastifyInstance } from 'fastify';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { requireUser, can, assert, bad } from '../auth.js';
import { q, one, tx, pool } from '../db.js';
import { audit } from '../audit.js';
import { cfg } from '../config.js';
import { EmployeeInput, createEmployee } from './hr.js';
import { AssetInput, createAsset } from './fleet.js';
import { saveDocument } from '../services/documents.js';

export const TEMPLATES = {
  employees: ['emp_no', 'name', 'gender', 'nationality', 'dob', 'department', 'location', 'designation', 'mobile', 'email', 'status', 'joined', 'company', 'sponsor', 'dept_head',
    'insurance_plan', 'insurance_provider', 'emergency_contact', 'home_address', 'passport_no', 'passport_issued', 'passport_expiry', 'visa_no', 'visa_issued', 'visa_expiry',
    'eid_no', 'eid_issued', 'eid_expiry', 'insurance_no', 'insurance_expiry'],
  assets: ['fleet_no', 'category', 'make', 'model', 'body', 'year', 'colour', 'emirate', 'plate', 'vin', 'engine', 'capacity', 'company', 'department', 'location', 'status',
    'usage', 'officer', 'acquired', 'odometer', 'remarks', 'registration_no', 'registration_expiry', 'insurance_policy', 'insurer', 'insurance_expiry', 'safety_no', 'safety_expiry',
    'inspection_no', 'inspection_expiry', 'permit_name', 'permit_no', 'permit_expiry'],
};
const EMP_DOCS = [['Passport', 'passport_no', 'passport_issued', 'passport_expiry'], ['Employment Visa', 'visa_no', 'visa_issued', 'visa_expiry'], ['Emirates ID', 'eid_no', 'eid_issued', 'eid_expiry'], ['Health Insurance', 'insurance_no', '', 'insurance_expiry']];
const ASSET_DOCS = [['Vehicle Registration', 'registration_no', '', 'registration_expiry'], ['Motor Insurance', 'insurance_policy', '', 'insurance_expiry', 'insurer'],
  ['Safety Certificate', 'safety_no', '', 'safety_expiry'], ['Inspection / Test Certificate', 'inspection_no', '', 'inspection_expiry'], ['Other Permit', 'permit_no', '', 'permit_expiry', '', 'permit_name']];

// accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
export function normDate(v: string | undefined) {
  if (!v) return '';
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return 'invalid';
}

function refChecks(row: any, kind: 'employees' | 'assets') {
  const c = cfg(); const errs: string[] = [];
  const active = (list: any[], v: string) => list.some((x) => x.name === v && x.active);
  if (row.department && !active(c.departments, row.department)) errs.push(`department "${row.department}" is not in the department list`);
  if (row.location && !active(c.locations, row.location)) errs.push(`location "${row.location}" is not in the location list`);
  if (row.company && !active(c.companies, row.company)) errs.push(`company "${row.company}" is not in the company list`);
  if (kind === 'employees' && row.sponsor && !active(c.companies, row.sponsor)) errs.push(`sponsor "${row.sponsor}" is not in the company list`);
  if (kind === 'assets' && row.category && !active(c.categories, row.category)) errs.push(`category "${row.category}" is not in the category list`);
  return errs;
}

export default async function importRoutes(app: FastifyInstance) {
  app.get('/api/import/template/:kind', { preHandler: requireUser }, async (req, reply) => {
    const kind = (req.params as any).kind as keyof typeof TEMPLATES;
    if (!TEMPLATES[kind]) throw bad('Unknown import type.');
    reply.header('Content-Type', 'text/csv; charset=utf-8').header('Content-Disposition', `attachment; filename="adroit-${kind}-template.csv"`);
    return TEMPLATES[kind].join(',') + '\n';
  });

  app.get('/api/import/batches', { preHandler: requireUser }, async (req) => {
    const kinds = [can(req.user, 'editEmployee') && 'employees', can(req.user, 'editAsset') && 'assets'].filter(Boolean);
    return { items: await q<any>('SELECT id, kind, file_name, uploaded_by, at, mode, total, accepted, rejected FROM import_batches WHERE kind = ANY($1) ORDER BY at DESC LIMIT 30', [kinds]) };
  });

  app.post('/api/import/:kind', { preHandler: requireUser }, async (req) => {
    const kind = (req.params as any).kind as 'employees' | 'assets';
    const mode = z.enum(['validate', 'commit']).parse((req.query as any).mode || 'validate');
    if (kind === 'employees') assert(can(req.user, 'editEmployee')); else if (kind === 'assets') assert(can(req.user, 'editAsset')); else throw bad('Unknown import type.');
    const part = await req.file();
    if (!part) throw bad('Choose a CSV file.');
    const text = (await part.toBuffer()).toString('utf8').replace(/^﻿/, '');
    let rows: any[];
    try { rows = parse(text, { columns: (h: string[]) => h.map((x) => x.trim().toLowerCase()), skip_empty_lines: true, trim: true }); } catch (e) { throw bad(`The CSV could not be read: ${(e as Error).message}`); }
    if (!rows.length) throw bad('The file has no data rows.');
    if (rows.length > 5000) throw bad('Import at most 5,000 rows per file.');
    const missingCols = ['name', 'department', 'designation', 'company', 'sponsor'].filter((c) => kind === 'employees' && !(c in rows[0]))
      .concat(['category', 'make', 'model', 'vin', 'company', 'department'].filter((c) => kind === 'assets' && !(c in rows[0])));
    if (missingCols.length) throw bad(`Missing required columns: ${missingCols.join(', ')}. Download the template for the expected layout.`);

    const log: any[] = [];
    const seen = new Set<string>();
    const existing = kind === 'employees'
      ? await q<any>('SELECT emp_no, lower(name) AS name, dob FROM employees')
      : await q<any>("SELECT fleet_no, lower(vin) AS vin, lower(plate) AS plate FROM assets WHERE status <> 'Disposed'");
    const prepared: any[] = [];
    rows.forEach((r, i) => {
      const line = i + 2;
      const errs: string[] = [];
      const dateCols = Object.keys(r).filter((k) => /(dob|joined|acquired|_issued|_expiry)$/.test(k));
      dateCols.forEach((k) => { const d = normDate(r[k]); if (d === 'invalid') errs.push(`${k} "${r[k]}" is not a date (use YYYY-MM-DD or DD/MM/YYYY)`); else r[k] = d; });
      errs.push(...refChecks(r, kind));
      let input: any = null;
      if (kind === 'employees') {
        const p = EmployeeInput.safeParse({ name: r.name, gender: r.gender, nationality: r.nationality, dob: r.dob || null, department: r.department, location: r.location || null,
          designation: r.designation, mobile: r.mobile, email: r.email || null, status: r.status || 'Active', joined: r.joined || null, company: r.company, sponsor: r.sponsor,
          deptHead: r.dept_head, insurancePlan: r.insurance_plan, insuranceProvider: r.insurance_provider, emergencyContact: r.emergency_contact, homeAddress: r.home_address });
        if (!p.success) errs.push(...p.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`)); else input = p.data;
        const key = `${(r.name || '').toLowerCase()}|${r.dob || ''}`;
        if (r.emp_no && existing.some((x) => x.emp_no === r.emp_no)) errs.push(`employee number ${r.emp_no} already exists`);
        if (r.dob && existing.some((x) => x.name === (r.name || '').toLowerCase() && x.dob === r.dob)) errs.push('an employee with the same name and date of birth already exists');
        if (seen.has(key) || (r.emp_no && seen.has(r.emp_no))) errs.push('duplicate row in this file');
        seen.add(key); if (r.emp_no) seen.add(r.emp_no);
        EMP_DOCS.forEach(([t, no, , ex]) => { if (r[ex] && !r[no]) errs.push(`${t}: number missing for expiry ${r[ex]}`); });
      } else {
        const p = AssetInput.safeParse({ category: r.category, make: r.make, model: r.model, body: r.body, year: r.year || null, colour: r.colour, emirate: r.emirate, plate: r.plate,
          vin: r.vin, engine: r.engine, capacity: r.capacity, company: r.company, department: r.department, location: r.location || null, status: r.status || 'Active',
          usage: r.usage, officer: r.officer, acquired: r.acquired || null, odometer: r.odometer, remarks: r.remarks });
        if (!p.success) errs.push(...p.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`)); else input = p.data;
        if (r.category !== 'Heavy Machine / Equipment' && !r.plate) errs.push('plate is required except for Heavy Machine / Equipment');
        const vin = (r.vin || '').toLowerCase(); const plate = (r.plate || '').toLowerCase();
        if (r.fleet_no && existing.some((x) => x.fleet_no === r.fleet_no)) errs.push(`fleet number ${r.fleet_no} already exists`);
        const dup = existing.find((x) => x.vin === vin || (plate && x.plate === plate));
        if (dup) errs.push(`${dup.fleet_no} already has this chassis / plate`);
        if (seen.has('v:' + vin) || (plate && seen.has('p:' + plate))) errs.push('duplicate chassis or plate in this file');
        seen.add('v:' + vin); if (plate) seen.add('p:' + plate);
        ASSET_DOCS.forEach(([t, no, , ex]) => { if (r[ex] && !r[no]) errs.push(`${t}: number missing for expiry ${r[ex]}`); });
      }
      log.push({ line, key: r.emp_no || r.fleet_no || r.name || r.vin || '', status: errs.length ? 'rejected' : 'accepted', errors: errs });
      if (!errs.length) prepared.push({ r, input, line });
    });

    let created: string[] = [];
    if (mode === 'commit' && prepared.length) {
      created = await tx(async (c) => {
        const out: string[] = [];
        for (const { r, input } of prepared) {
          if (kind === 'employees') {
            const e = await createEmployee(c, req.user, req.actor, { ...input, docs: [] }, { empNo: r.emp_no || undefined });
            for (const [t, no, is, ex] of EMP_DOCS) if (r[no]) await saveDocument(c, req.user, req.actor, 'hr', { uid: e.id, no: e.emp_no, label: e.name }, t, 'upload', { ref: r[no], issued: is ? r[is] : '', expiry: r[ex] || '', issuer: t === 'Health Insurance' ? r.insurance_provider || '' : '' }, null);
            out.push(e.emp_no);
          } else {
            const a = await createAsset(c, req.actor, input, { fleetNo: r.fleet_no || undefined });
            for (const [t, no, , ex, issuer, nameCol] of ASSET_DOCS) if (r[no]) {
              const needsExpiry = cfg().docTypes.find((d) => d.key === t)?.expires;
              if (needsExpiry && !r[ex]) continue;
              await saveDocument(c, req.user, req.actor, 'fleet', { uid: a.id, no: a.fleet_no, label: `${a.make} ${a.model}` }, t, 'upload', { ref: r[no], expiry: r[ex] || '', issuer: issuer ? r[issuer] || '' : '', name: nameCol ? r[nameCol] || '' : '' }, null);
            }
            out.push(a.fleet_no);
          }
        }
        return out;
      });
    }
    const accepted = log.filter((l) => l.status === 'accepted').length;
    const batch = await one<any>('INSERT INTO import_batches (kind, file_name, uploaded_by, mode, total, accepted, rejected, log) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, at',
      [kind, part.filename, req.actor.name, mode, rows.length, accepted, rows.length - accepted, JSON.stringify(log)]);
    await audit(null, req.actor, mode === 'commit' ? 'Import' : 'Validate import', kind === 'employees' ? 'Employee' : 'Asset', `Batch ${batch.id}`,
      `${part.filename}: ${rows.length} rows, ${accepted} ${mode === 'commit' ? 'imported' : 'valid'}, ${rows.length - accepted} rejected`);
    const totalNow = await one<any>(`SELECT count(*)::int AS n FROM ${kind === 'employees' ? 'employees' : 'assets'}`);
    return { batchId: batch.id, mode, total: rows.length, accepted, rejected: rows.length - accepted, created, recordsInSystem: totalNow.n, log };
  });
}
