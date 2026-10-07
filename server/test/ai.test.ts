// AI provider adapter tests (§12, §17 "AI"). A local mock stands in for the provider, so no key or network is needed.
//   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/adroit_test npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import pg from 'pg';

const base = process.env.TEST_DATABASE_URL || 'postgres://postgres@127.0.0.1:5432/adroit_test';
const url = base.replace(/\/([^/?]+)(\?.*)?$/, '/adroit_test_ai$2');
process.env.DATABASE_URL = url;
process.env.FILES_DIR = '/tmp/adroit-test-files-ai';
process.env.JOBS_ENABLED = 'false';
process.env.COOKIE_SECURE = 'false';
process.env.LOGIN_RATE_LIMIT = '500';
process.env.AI_PROVIDER = 'anthropic';
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.AI_TIMEOUT_MS = '800';

// mock provider: answers with whatever the test queues up, and records what it was sent
let nextReply: (body: any) => { status?: number; delay?: number; json?: any } = () => ({ status: 500 });
const seen: any[] = [];
const mock = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const body = JSON.parse(raw || '{}');
    seen.push({ headers: req.headers, body, raw });
    const r = nextReply(body);
    setTimeout(() => {
      if (res.destroyed) return;
      res.writeHead(r.status || 200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(r.json || {}));
    }, r.delay || 0);
  });
});
const toolUse = (name: string, input: any) => () => ({ json: { content: [{ type: 'tool_use', id: 't1', name, input }] } });

let app: any;
const H = { 'x-adroit-client': 'web', 'content-type': 'application/json' };
const cookies: Record<string, string> = {};
async function login(email: string, who: string) {
  const r = await app.inject({ method: 'POST', url: '/api/auth/login', headers: H, payload: { email, password: 'Adroit@2026' } });
  assert.equal(r.statusCode, 200);
  cookies[who] = `adroit_sid=${r.cookies.find((c: any) => c.name === 'adroit_sid').value}`;
}
const ask = async (who: string, question: string) => {
  const r = await app.inject({ method: 'POST', url: '/api/ai/ask', headers: { ...H, cookie: cookies[who] }, payload: { question } });
  return { status: r.statusCode, body: r.json() };
};

before(async () => {
  await new Promise<void>((r) => mock.listen(0, '127.0.0.1', () => r()));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(mock.address() as any).port}`;
  const admin = new pg.Client({ connectionString: url.replace(/\/adroit_test_ai/, '/postgres') });
  await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS adroit_test_ai WITH (FORCE)');
  await admin.query('CREATE DATABASE adroit_test_ai');
  await admin.end();
  const db = await import('../src/db.js');
  await db.migrate(() => {});
  await (await import('../src/seed.js')).seedDemo({ reset: true }, () => {});
  app = await (await import('../src/app.js')).buildApp({ logger: false });
  await login('gm@adroit.ae', 'gm');
  await login('suresh.pillai@adroit.ae', 'fleet');
  await login('maria.santos@adroit.ae', 'ins');
});
after(async () => {
  await app?.close();
  (await import('../src/db.js')).pool.end();
  mock.close();
});

test('provider picks an approved tool; the server answers from records', async () => {
  nextReply = toolUse('expiring_documents', { doc_types: ['Employment Visa', 'Emirates ID'], within_days: 60 });
  const r = await ask('gm', 'which staff need visa or id renewals in the next two months?');
  assert.equal(r.status, 200);
  assert.equal(r.body.engine, 'ai');
  assert.equal(r.body.module, 'hr');
  assert.ok(r.body.rows.length > 0, 'grounded rows returned');
  assert.ok(r.body.rows.every((x: any) => ['Employment Visa', 'Emirates ID'].includes(x.cols[0])));
});

test('the provider receives the question and tool list only, never records', async () => {
  const last = seen[seen.length - 1];
  assert.equal(last.headers['x-api-key'], 'test-key');
  assert.equal(last.body.tool_choice.type, 'any');
  assert.ok(last.body.tools.length >= 8);
  assert.equal(last.body.messages.length, 1);
  // tool descriptions carry fixed example IDs as usage hints; the rest of the request must hold no record data
  const sent = JSON.stringify({ system: last.body.system, messages: last.body.messages });
  assert.ok(!/Wickramasinghe|Perera|EMP 0|VH-0|784-|Dubai [A-Z] \d/.test(sent), 'no employee or fleet data in the request');
  assert.ok(!/Wickramasinghe|784-\d{4}|Dubai [A-Z] \d{4,5}/.test(last.raw), 'no names, Emirates IDs or plates anywhere');
});

test('provider error falls back to the rules engine', async () => {
  nextReply = () => ({ status: 529 });
  const r = await ask('gm', 'Show visas expiring in the next 60 days');
  assert.equal(r.status, 200);
  assert.equal(r.body.engine, 'rules');
  assert.ok(r.body.rows.length > 0);
});

test('slow provider times out and falls back', async () => {
  nextReply = () => ({ delay: 2000, json: { content: [] } });
  const t0 = Date.now();
  const r = await ask('gm', 'Who is currently on annual leave?');
  assert.equal(r.body.engine, 'rules');
  assert.ok(Date.now() - t0 < 1800, 'answered before the provider replied');
});

test('an unknown tool or bad parameters are ignored', async () => {
  nextReply = toolUse('delete_employee', { id: 'EMP 0115' });
  let r = await ask('gm', 'Find the insurance card for employee 0115');
  assert.equal(r.body.engine, 'rules');
  assert.equal(r.body.docs.length, 1);
  nextReply = toolUse('expiring_documents', { doc_types: ['DROP TABLE'], within_days: 'lots' });
  r = await ask('gm', 'Show visas expiring in the next 60 days');
  assert.equal(r.status, 200);
});

test('permissions still apply after routing', async () => {
  nextReply = toolUse('expiring_documents', { doc_types: ['Employment Visa'], within_days: 60 });
  let r = await ask('fleet', 'visas expiring soon?');
  assert.equal(r.body.module, 'none');
  assert.ok(!r.body.rows?.length);
  nextReply = toolUse('record_documents', { record: '0115', doc_types: ['Health Insurance'] });
  r = await ask('ins', 'insurance card for employee 0115');
  assert.equal(r.body.engine, 'ai');
  assert.deepEqual(r.body.docs.map((d: any) => d.doc.type), ['Health Insurance']);
});

test('fleet, leave and officer tools route to grounded answers', async () => {
  for (const [tool, input, check] of [
    ['record_documents', { record: 'VH-0108', doc_types: ['Motor Insurance'] }, (b: any) => b.docs?.[0]?.doc.type === 'Motor Insurance'],
    ['missing_documents', { module: 'fleet', vehicle_category: 'Heavy Machine / Equipment' }, (b: any) => b.module === 'fleet' && b.rows.length >= 1],
    ['leave_status', { view: 'not_rejoined' }, (b: any) => b.module === 'hr' && b.rows.length >= 1],
    ['open_renewal_actions', { officer: 'Imran Qureshi' }, (b: any) => b.mixed.length > 0],
    ['attention_summary', { scope: 'both' }, (b: any) => b.sections.length === 2],
    ['list_fleet', { machine_or_body_type: 'forklift', location: 'Aweer' }, (b: any) => b.module === 'fleet'],
  ] as const) {
    nextReply = toolUse(tool, input);
    const r = await ask('gm', `question for ${tool}`);
    assert.equal(r.body.engine, 'ai', tool);
    assert.ok((check as any)(r.body), `${tool}: ${r.body.text}`);
  }
});

test('each AI question is logged with the path that answered it', async () => {
  const db = await import('../src/db.js');
  const rows = await db.q<any>('SELECT engine, routed_as FROM ai_interactions ORDER BY id');
  assert.ok(rows.some((r) => r.engine === 'ai' && r.routed_as));
  assert.ok(rows.some((r) => r.engine === 'rules' && !r.routed_as));
});
