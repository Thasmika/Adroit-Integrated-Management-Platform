// API integration tests (§17 acceptance criteria). Needs a PostgreSQL server; uses its own database.
//   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/adroit_test npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const url = process.env.TEST_DATABASE_URL || 'postgres://postgres@127.0.0.1:5432/adroit_test';
process.env.DATABASE_URL = url;
process.env.FILES_DIR = process.env.TEST_FILES_DIR || '/tmp/adroit-test-files';
process.env.JOBS_ENABLED = 'false';
process.env.COOKIE_SECURE = 'false';
process.env.LOGIN_RATE_LIMIT = '500';

let app: any, pool: any, runExpiryJob: any;
const PW = 'Adroit@2026';
const H = { 'x-adroit-client': 'web' };
const cookies: Record<string, string> = {};

async function req(method: string, path: string, who?: string, body?: any, extra: any = {}) {
  const headers: any = { ...(method === 'GET' ? {} : H), ...(who ? { cookie: cookies[who] } : {}), ...extra.headers };
  const opts: any = { method, url: path, headers };
  if (body !== undefined) { opts.payload = body; if (!(extra.raw)) headers['content-type'] = 'application/json'; }
  const r = await app.inject(opts);
  let json: any = null;
  try { json = r.json(); } catch { /* not json */ }
  return { status: r.statusCode, body: json, raw: r };
}
async function loginAs(email: string, who: string) {
  const r = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { ...H, 'content-type': 'application/json' }, payload: { email, password: PW } });
  assert.equal(r.statusCode, 200, `login ${email}: ${r.body}`);
  const c = r.cookies.find((x: any) => x.name === 'adroit_sid');
  cookies[who] = `adroit_sid=${c.value}`;
}
function multipart(fields: Record<string, string>, file?: { name: string; content: Buffer; type?: string }) {
  const boundary = '----adroitTest' + Math.random().toString(16).slice(2);
  const parts: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  if (file) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`), file.content, Buffer.from('\r\n'));
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(parts), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

before(async () => {
  const admin = new pg.Client({ connectionString: url.replace(/\/[^/]+$/, '/postgres') });
  await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS adroit_test WITH (FORCE)');
  await admin.query('CREATE DATABASE adroit_test');
  await admin.end();
  const db = await import('../src/db.js');
  pool = db.pool;
  await db.migrate(() => {});
  const seed = await import('../src/seed.js');
  await seed.seedDemo({ reset: true }, () => {});
  ({ runExpiryJob } = await import('../src/jobs.js'));
  const { buildApp } = await import('../src/app.js');
  app = await buildApp({ logger: false });
  for (const [e, w] of [['gm@adroit.ae', 'gm'], ['nadeesha.perera@adroit.ae', 'hr'], ['imran.qureshi@adroit.ae', 'pro'], ['maria.santos@adroit.ae', 'ins'],
    ['rajesh.menon@adroit.ae', 'dh'], ['suresh.pillai@adroit.ae', 'fleet'], ['anjali.rao@adroit.ae', 'aud'], ['kasun.bandara@adroit.ae', 'admin']]) await loginAs(e, w);
});
after(async () => { await app?.close(); await pool?.end(); });

// ---------- expiry engine (§6.3, §10) ----------
test('expiry engine: status boundaries follow the configured thresholds', async () => {
  const { docStatus, iso, addDays } = await import('@adroit/core/src/core/shared.js');
  const at = (d: number) => docStatus({ type: 'Passport', expiry: iso(addDays(new Date(), d)), file: { id: 'x' } }).key;
  assert.equal(at(-1), 'expired');
  assert.equal(at(0), 'critical');
  assert.equal(at(30), 'critical');
  assert.equal(at(31), 'due');
  assert.equal(at(60), 'due');
  assert.equal(at(61), 'monitor');
  assert.equal(at(90), 'monitor');
  assert.equal(at(91), 'valid');
  assert.equal(docStatus({ type: 'Qualification Certificate', expiry: '', file: { id: 'x' } }).key, 'onfile');
});

test('expiry job is idempotent: a second run opens no duplicate actions or alerts', async () => {
  await runExpiryJob();
  const r = await runExpiryJob();
  assert.equal(r.actionsOpened, 0);
  assert.equal(r.alertsCreated, 0);
});

// ---------- authentication & session security (§4.1, §15) ----------
test('login rejects a wrong password and locks after five failures', async () => {
  for (let i = 0; i < 5; i++) {
    const r = await req('POST', '/api/auth/login', undefined, { email: 'anjali.rao@adroit.ae', password: 'wrong' });
    assert.equal(r.status, 401);
  }
  const locked = await req('POST', '/api/auth/login', undefined, { email: 'anjali.rao@adroit.ae', password: PW });
  assert.equal(locked.status, 423);
  await pool.query("UPDATE users SET locked_until = NULL WHERE email = 'anjali.rao@adroit.ae'");
});

test('state-changing requests without the client header are refused (CSRF defence)', async () => {
  const r = await app.inject({ method: 'POST', url: '/api/leave', headers: { cookie: cookies.hr, 'content-type': 'application/json' }, payload: {} });
  assert.equal(r.statusCode, 403);
});

test('unauthenticated API calls are refused', async () => {
  assert.equal((await req('GET', '/api/bootstrap')).status, 401);
});

// ---------- role-based access (§4) ----------
test('RBAC: module and record scope are enforced by the server', async () => {
  assert.equal((await req('GET', '/api/employees', 'fleet')).status, 403, 'fleet user cannot list employees');
  assert.equal((await req('GET', '/api/assets', 'hr')).status, 403, 'HR user cannot list assets');
  assert.equal((await req('GET', '/api/employees', 'admin')).status, 403, 'administrator has no HR content');
  const dh = await req('GET', '/api/bootstrap', 'dh');
  assert.ok(dh.body.employees.length > 0);
  assert.ok(dh.body.employees.every((e: any) => e.department === 'Trading Department'));
  assert.ok(dh.body.employees.every((e: any) => e.docs.length === 0 && e.dob === null), 'department head sees no documents or personal details');
  const other = (await req('GET', '/api/employees', 'hr')).body.items.find((e: any) => e.department !== 'Trading Department');
  assert.equal((await req('GET', `/api/employees/${encodeURIComponent(other.id)}`, 'dh')).status, 404, 'other departments are invisible');
  const ins = await req('GET', '/api/bootstrap', 'ins');
  const types = new Set([...ins.body.employees, ...ins.body.assets].flatMap((o: any) => o.docs.map((d: any) => d.type)));
  assert.deepEqual([...types].sort(), ['Health Insurance', 'Motor Insurance']);
  assert.equal((await req('POST', '/api/employees', 'aud', { name: 'X' })).status, 403, 'auditor is read-only');
});

test('RBAC: PRO cannot change health insurance; insurance officer cannot change visas', async () => {
  const m = multipart({ mode: 'upload', ref: 'X1', expiry: '2030-01-01' });
  const a = await app.inject({ method: 'POST', url: '/api/documents/hr/EMP%200001/Health%20Insurance', headers: { ...H, cookie: cookies.pro, ...m.headers }, payload: m.payload });
  assert.equal(a.statusCode, 403);
  const b = await app.inject({ method: 'POST', url: '/api/documents/hr/EMP%200001/Employment%20Visa', headers: { ...H, cookie: cookies.ins, ...m.headers }, payload: m.payload });
  assert.equal(b.statusCode, 403);
});

// ---------- documents, renewal, history, files (§8.3, §9, §10) ----------
test('renewal supersedes the current version, keeps history and completes the action', async () => {
  const before = (await req('GET', '/api/employees/EMP%200115', 'hr')).body.docs.find((d: any) => d.type === 'Employment Visa');
  assert.ok(before.renewal, 'demo visa has an open action');
  const m = multipart({ mode: 'renew', ref: '201/2026/5555555', issued: '2026-01-01', expiry: '2030-10-10' }, { name: 'visa.pdf', content: PDF });
  const r = await app.inject({ method: 'POST', url: '/api/documents/hr/EMP%200115/Employment%20Visa', headers: { ...H, cookie: cookies.pro, ...m.headers }, payload: m.payload });
  assert.equal(r.statusCode, 200, r.body);
  const after = r.json().docs.find((d: any) => d.type === 'Employment Visa');
  assert.equal(after.ref, '201/2026/5555555');
  assert.equal(after.renewal, null, 'action completed');
  assert.equal(after.history.length, before.history.length + 1);
  assert.equal(after.history[0].ref, before.ref);
  const act = await pool.query(`SELECT a.status, a.completed_by FROM expiry_actions a JOIN documents d ON d.id = a.document_id JOIN employees e ON e.id = d.owner_id
                                WHERE e.emp_no = 'EMP 0115' AND d.type = 'Employment Visa' ORDER BY a.opened_at DESC LIMIT 1`);
  assert.equal(act.rows[0].status, 'Completed');
});

test('renewal requires a future expiry date', async () => {
  const m = multipart({ mode: 'renew', ref: 'P1', expiry: '2020-01-01' });
  const r = await app.inject({ method: 'POST', url: '/api/documents/hr/EMP%200002/Passport', headers: { ...H, cookie: cookies.hr, ...m.headers }, payload: m.payload });
  assert.equal(r.statusCode, 400);
});

test('file content is checked: a text file named .pdf is refused', async () => {
  const m = multipart({ mode: 'upload' }, { name: 'fake.pdf', content: Buffer.from('hello, not a pdf') });
  const r = await app.inject({ method: 'POST', url: '/api/documents/hr/EMP%200003/Passport', headers: { ...H, cookie: cookies.hr, ...m.headers }, payload: m.payload });
  assert.equal(r.statusCode, 400);
  assert.match(r.json().error, /not a supported file/);
});

test('files are private: permission checked, views audited', async () => {
  const emp = (await req('GET', '/api/employees/EMP%200115', 'hr')).body;
  const url = emp.docs.find((d: any) => d.type === 'Passport').file.url;
  const ok = await req('GET', url, 'hr');
  assert.equal(ok.status, 200);
  assert.equal(ok.raw.headers['content-type'], 'application/pdf');
  assert.equal((await req('GET', url, 'fleet')).status, 404, 'fleet user cannot open HR files');
  assert.equal((await req('GET', url, 'ins')).status, 404, 'insurance officer cannot open passports');
  assert.equal((await req('GET', url)).status, 401);
  const a = await pool.query("SELECT 1 FROM audit_events WHERE action = 'View' AND record = 'EMP 0115' AND user_name = 'Nadeesha Perera'");
  assert.ok(a.rowCount > 0);
});

// ---------- leave workflow (§7) ----------
test('leave: request → HR review → management approval → rejoining, with role checks', async () => {
  const busy = new Set((await req('GET', '/api/leave', 'hr')).body.items.filter((l: any) => !['Completed', 'Rejected'].includes(l.status)).map((l: any) => l.empId));
  const emp = (await req('GET', '/api/employees', 'dh')).body.items.find((e: any) => e.status === 'Active' && !busy.has(e.id));
  const start = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 50 * 864e5).toISOString().slice(0, 10);
  const s = await req('POST', '/api/leave', 'dh', { empId: emp.id, type: 'Annual Leave', start, end, reason: 'Vacation' });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.equal(s.body.status, 'Pending HR Review');
  assert.equal(s.body.days, 11);
  assert.equal((await req('POST', '/api/leave', 'dh', { empId: emp.id, type: 'Sick Leave', start, end, reason: 'x overlap' })).status, 400, 'overlap refused');
  assert.equal((await req('POST', `/api/leave/${s.body.id}/approve`, 'gm', {})).status, 400, 'cannot skip HR review');
  assert.equal((await req('POST', `/api/leave/${s.body.id}/review`, 'dh', {})).status, 403, 'department head cannot review');
  assert.equal((await req('POST', `/api/leave/${s.body.id}/review`, 'hr', { note: 'ok' })).body.status, 'Pending Approval');
  assert.equal((await req('POST', `/api/leave/${s.body.id}/approve`, 'hr', {})).status, 403, 'HR cannot approve');
  assert.equal((await req('POST', `/api/leave/${s.body.id}/approve`, 'gm', {})).body.status, 'Approved');
  assert.equal((await req('POST', `/api/leave/${s.body.id}/rejoin`, 'hr', {})).status, 400, 'cannot rejoin before leave');
  const trail = (await req('GET', '/api/leave', 'hr')).body.items.find((l: any) => l.id === s.body.id).trail;
  assert.equal(trail.length, 3);
  const n = await pool.query("SELECT count(*)::int AS n FROM notifications WHERE dedupe_key = $1", [`leave:${s.body.id}:approval`]);
  assert.ok(n.rows[0].n > 0, 'management notified for approval');
});

test('leave: reject needs a reason; rejoining completes an awaiting leave', async () => {
  const pending = (await req('GET', '/api/leave', 'hr')).body.items.find((l: any) => l.status === 'Pending HR Review');
  assert.equal((await req('POST', `/api/leave/${pending.id}/reject`, 'hr', { note: '' })).status, 400);
  assert.equal((await req('POST', `/api/leave/${pending.id}/reject`, 'hr', { note: 'Peak season' })).body.status, 'Rejected');
  const aw = (await req('GET', '/api/leave', 'hr')).body.items.find((l: any) => l.status === 'Awaiting Rejoining');
  const r = await req('POST', `/api/leave/${aw.id}/rejoin`, 'hr', { date: new Date().toISOString().slice(0, 10) });
  assert.equal(r.body.status, 'Completed');
});

// ---------- assets (§8) ----------
test('assets: create, duplicate chassis refused, lifecycle status', async () => {
  const b = { category: 'Light Vehicle', make: 'Toyota', model: 'Hilux', vin: 'TESTVIN000001', plate: 'Dubai T 11111', company: 'Adroit Building Materials Trading Ent. L.L.C', department: 'Transport Department', location: 'Aweer' };
  const a = await req('POST', '/api/assets', 'fleet', b);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.match(a.body.id, /^VH-\d{4}$/);
  assert.equal((await req('POST', '/api/assets', 'fleet', { ...b, plate: 'Dubai T 22222' })).status, 409);
  const d = await req('PUT', `/api/assets/${a.body.id}`, 'fleet', { ...b, status: 'Disposed' });
  assert.equal(d.body.status, 'Disposed');
  assert.equal((await req('POST', '/api/assets', 'fleet', { ...b, vin: 'X2', plate: '', category: 'Light Vehicle' })).status, 400, 'plate required for road vehicles');
});

// ---------- AI (§12) ----------
test('AI: grounded, permission-filtered, logged, and can be switched off', async () => {
  const gm = await req('POST', '/api/ai/ask', 'gm', { question: 'Summarize HR and fleet document actions requiring attention this week' });
  assert.equal(gm.body.sections.length, 2);
  const ins = await req('POST', '/api/ai/ask', 'ins', { question: 'Show visas expiring in the next 60 days' });
  assert.equal(ins.body.module, 'none');
  const fl = await req('POST', '/api/ai/ask', 'fleet', { question: 'Find the insurance copy for vehicle VH-0108' });
  assert.equal(fl.body.docs.length, 1);
  const logged = await pool.query('SELECT count(*)::int AS n FROM ai_interactions');
  assert.ok(logged.rows[0].n >= 3);
  await req('PUT', '/api/admin/system', 'admin', { aiEnabled: false });
  assert.equal((await req('POST', '/api/ai/ask', 'gm', { question: 'Who is on leave?' })).status, 503);
  assert.equal((await req('GET', '/api/bootstrap', 'gm')).status, 200, 'core functions keep working');
  await req('PUT', '/api/admin/system', 'admin', { aiEnabled: true });
});

// ---------- administration & configuration (§5, §19) ----------
test('admin: thresholds validated; changes audited; users get temporary passwords', async () => {
  assert.equal((await req('PUT', '/api/admin/doc-types/Passport', 'admin', { urgent: 90, due: 60 })).status, 400);
  assert.equal((await req('PUT', '/api/admin/doc-types/Passport', 'admin', { monitor: 120 })).status, 200);
  assert.equal((await req('PUT', '/api/admin/doc-types/Passport', 'hr', { monitor: 120 })).status, 403);
  const u = await req('POST', '/api/admin/users', 'admin', { name: 'Test User', email: 'test.user@adroit.ae', role: 'fleet' });
  assert.ok(u.body.temporaryPassword.length >= 8);
  const lg = await req('POST', '/api/auth/login', undefined, { email: 'test.user@adroit.ae', password: u.body.temporaryPassword });
  assert.equal(lg.body.user.mustChangePassword, true);
  const a = await pool.query("SELECT 1 FROM audit_events WHERE action = 'Configure' AND record = 'Passport'");
  assert.ok(a.rowCount > 0);
});

test('audit trail is append-only in the database', async () => {
  await assert.rejects(pool.query("UPDATE audit_events SET detail = 'tampered' WHERE id = 1"), /append-only/);
  await assert.rejects(pool.query('DELETE FROM audit_events WHERE id = 1'), /append-only/);
  assert.equal((await req('GET', '/api/audit', 'hr')).status, 403);
  assert.ok((await req('GET', '/api/audit?q=EMP%200115', 'aud')).body.total > 0);
});

// ---------- migration import (§16) ----------
test('import: validate reports accepted and rejected rows; commit imports only valid rows', async () => {
  const csv = [
    'name,department,designation,company,sponsor,dob,joined,passport_no,passport_expiry',
    'Import One,Trading Department,Salesman,Adroit Building Materials Trading Ent. L.L.C,Adroit Building Materials Trading Ent. L.L.C,15/03/1990,2020-01-01,N1111111,2030-01-01',
    'Import Two,Nowhere Department,Salesman,Adroit Building Materials Trading Ent. L.L.C,Adroit Building Materials Trading Ent. L.L.C,1991-01-01,2020-01-01,,',
  ].join('\n');
  const send = async (mode: string) => {
    const m = multipart({}, { name: 'emps.csv', content: Buffer.from(csv), type: 'text/csv' });
    return app.inject({ method: 'POST', url: `/api/import/employees?mode=${mode}`, headers: { ...H, cookie: cookies.hr, ...m.headers }, payload: m.payload });
  };
  const v = (await send('validate')).json();
  assert.equal(v.accepted, 1); assert.equal(v.rejected, 1);
  assert.match(v.log[1].errors.join(' '), /department/);
  const c = (await send('commit')).json();
  assert.equal(c.created.length, 1);
  const again = (await send('validate')).json();
  assert.equal(again.accepted, 0, 'duplicate detected on re-import');
  const fleetTry = multipart({}, { name: 'e.csv', content: Buffer.from(csv) });
  assert.equal((await app.inject({ method: 'POST', url: '/api/import/employees?mode=validate', headers: { ...H, cookie: cookies.fleet, ...fleetTry.headers }, payload: fleetTry.payload })).statusCode, 403);
});

test('record cache: changes from this or another app instance are visible on the next request', async () => {
  const before = await req('GET', '/api/employees/EMP%200115', 'hr');
  assert.equal(before.status, 200);
  const original = before.body.name;
  // a write made directly in the database (as another instance would) moves the change counter
  await pool.query("UPDATE employees SET name = 'Cache Check Name' WHERE emp_no = 'EMP 0115'");
  const list = await req('GET', '/api/employees', 'hr');
  assert.ok(list.body.items.some((e: any) => e.name === 'Cache Check Name'));
  await pool.query('UPDATE employees SET name = $1 WHERE emp_no = $2', [original, 'EMP 0115']);
  const back = await req('GET', '/api/employees', 'hr');
  assert.ok(back.body.items.some((e: any) => e.name === original));
});
