// Administration (§5), users & roles (§4), audit (§4.1), operations health (§15).
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import fs from 'node:fs';
import { aiConfigured } from '../ai.js';
import path from 'node:path';
import crypto from 'node:crypto';
import { requireUser, requireAdmin, requireAuditor, bad, hashPassword, passwordProblem, revokeUserSessions, HttpError } from '../auth.js';
import { q, one, pool, tx } from '../db.js';
import { audit } from '../audit.js';
import { cfg, loadConfig, publicConfig, SYSTEM_DEFAULTS } from '../config.js';
import { storageHealth } from '../storage.js';
import { runExpiryJob, runDigestJob, runMailJob, verifySmtp, emailConfigured } from '../jobs.js';
import { env } from '../env.js';
import { ROLES } from '@adroit/core/src/core/shared.js';
import importRoutes from './import.js';

const LISTS: Record<string, { table: string; key: string; entity: string }> = {
  companies: { table: 'companies', key: 'id', entity: 'Company' },
  departments: { table: 'departments', key: 'id', entity: 'Department' },
  locations: { table: 'locations', key: 'id', entity: 'Location' },
  categories: { table: 'asset_categories', key: 'name', entity: 'Asset category' },
};

export default async function adminRoutes(app: FastifyInstance) {
  await app.register(importRoutes);
  const admin = { preHandler: async (req: any) => { await requireUser(req); requireAdmin(req.user); } };

  app.get('/api/admin/config', admin, async (req) => publicConfig(req.user));

  // ---------- document types, thresholds, responsible officers ----------
  app.put('/api/admin/doc-types/:key', admin, async (req) => {
    const key = decodeURIComponent((req.params as any).key);
    const cur = cfg().docTypes.find((t) => t.key === key);
    if (!cur) throw new HttpError(404, 'Unknown document type.');
    const b = z.object({ expires: z.boolean().optional(), required: z.boolean().optional(), requiredFor: z.array(z.string()).optional(),
      urgent: z.number().int().min(0).max(730).optional(), due: z.number().int().min(0).max(730).optional(), monitor: z.number().int().min(0).max(730).optional(),
      officer: z.string().nullable().optional() }).parse(req.body);
    const next = { ...cur, ...b };
    if (!(next.urgent <= next.due && (next.monitor === 0 || next.due <= next.monitor))) throw bad('Thresholds must increase: urgent ≤ warning ≤ monitor.');
    if (b.officer) {
      const o = cfg().users.find((u) => u.id === b.officer);
      if (!o || !o.active || !['hr', 'pro', 'insurance', 'fleet'].includes(o.role)) throw bad('The responsible officer must be an active HR, PRO, Insurance or Fleet user.');
    }
    if (b.requiredFor?.some((c) => !cfg().categories.some((x) => x.name === c))) throw bad('Unknown asset category.');
    await pool.query(`UPDATE document_types SET expires = $2, required = $3, required_for = $4, urgent_days = $5, due_days = $6, monitor_days = $7, officer_user_id = $8 WHERE key = $1`,
      [key, next.expires, next.required, next.requiredFor, next.urgent, next.due, next.monitor, next.officer || null]);
    const changes = Object.keys(b).map((k) => `${k} ${JSON.stringify((cur as any)[k])} → ${JSON.stringify((b as any)[k])}`).join('; ');
    await audit(null, req.actor, 'Configure', 'Document type', key, changes, cur, next);
    await loadConfig();
    return publicConfig(req.user);
  });

  // ---------- reference masters ----------
  app.post('/api/admin/lists/:list', admin, async (req) => {
    const L = LISTS[(req.params as any).list];
    if (!L) throw bad('Unknown list.');
    const b = z.object({ id: z.string().optional(), name: z.string().trim().min(2).max(120), short: z.string().max(80).optional(), kind: z.string().optional(), active: z.boolean().default(true) }).parse(req.body);
    const list = cfg()[(req.params as any).list as 'companies'];
    if (L.table === 'asset_categories') {
      await pool.query('INSERT INTO asset_categories (name, active, sort) VALUES ($1,$2,$3)', [b.name, b.active, list.length]);
    } else {
      const prefix = L.table === 'companies' ? 'C' : L.table === 'departments' ? 'D' : 'L';
      const id = b.id || `${prefix}${String(list.length + 1).padStart(2, '0')}-${crypto.randomBytes(2).toString('hex')}`;
      if (L.table === 'companies') await pool.query('INSERT INTO companies (id, name, short, kind, active) VALUES ($1,$2,$3,$4,$5)', [id, b.name, b.short || b.name.replace(/ L\.?L\.?C\.?$/i, ''), b.kind || 'Group company', b.active]);
      else await pool.query(`INSERT INTO ${L.table} (id, name, active) VALUES ($1,$2,$3)`, [id, b.name, b.active]);
    }
    await audit(null, req.actor, 'Configure', L.entity, b.name, 'Added');
    await loadConfig();
    return publicConfig(req.user);
  });
  app.put('/api/admin/lists/:list/:key', admin, async (req) => {
    const L = LISTS[(req.params as any).list];
    if (!L) throw bad('Unknown list.');
    const key = decodeURIComponent((req.params as any).key);
    const b = z.object({ name: z.string().trim().min(2).max(120).optional(), short: z.string().max(80).optional(), active: z.boolean().optional() }).parse(req.body);
    const cur = await one<any>(`SELECT * FROM ${L.table} WHERE ${L.key} = $1`, [key]);
    if (!cur) throw new HttpError(404, 'Not found.');
    const next = { ...cur, ...b };
    if (L.table === 'companies') await pool.query('UPDATE companies SET name = $2, short = $3, active = $4 WHERE id = $1', [key, next.name, next.short, next.active]);
    else await pool.query(`UPDATE ${L.table} SET name = $2, active = $3 WHERE ${L.key} = $1`, [key, next.name, next.active]);
    await audit(null, req.actor, 'Configure', L.entity, next.name, [b.name && b.name !== cur.name && `renamed ${cur.name} → ${b.name}`, b.active !== undefined && b.active !== cur.active && (b.active ? 'activated' : 'deactivated')].filter(Boolean).join('; ') || 'Updated');
    await loadConfig();
    return publicConfig(req.user);
  });

  // ---------- users ----------
  const UserInput = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(200), role: z.enum(Object.keys(ROLES) as [string, ...string[]]),
    scope: z.string().nullable().optional(), active: z.boolean().default(true) });
  app.post('/api/admin/users', admin, async (req) => {
    const b = UserInput.parse(req.body);
    if (b.role === 'depthead' && !b.scope) throw bad('Choose the department for a Department Head.');
    const temp = crypto.randomBytes(7).toString('base64url') + '9';
    const id = 'u-' + crypto.randomBytes(5).toString('hex');
    await pool.query('INSERT INTO users (id, name, email, password_hash, role, scope_department, active, must_change_password) VALUES ($1,$2,$3,$4,$5,$6,$7,true)',
      [id, b.name, b.email, await hashPassword(temp), b.role, b.role === 'depthead' ? b.scope : null, b.active]);
    await audit(null, req.actor, 'Create', 'User', b.email, `${b.name} added as ${(ROLES as any)[b.role].label}${b.role === 'depthead' ? ` (${b.scope})` : ''}`);
    await loadConfig();
    return { config: publicConfig(req.user), temporaryPassword: temp, userId: id };
  });
  app.put('/api/admin/users/:id', admin, async (req) => {
    const id = (req.params as any).id;
    const b = UserInput.partial().parse(req.body);
    const cur = await one<any>('SELECT * FROM users WHERE id = $1', [id]);
    if (!cur) throw new HttpError(404, 'User not found.');
    if (id === req.user.id && (b.role && b.role !== cur.role || b.active === false)) throw bad("You can't change your own role or deactivate yourself.");
    const next = { name: b.name ?? cur.name, email: b.email ?? cur.email, role: b.role ?? cur.role, scope: b.scope !== undefined ? b.scope : cur.scope_department, active: b.active ?? cur.active };
    if (next.role === 'depthead' && !next.scope) throw bad('Choose the department for a Department Head.');
    if (cur.role === 'sysadmin' && (next.role !== 'sysadmin' || !next.active)) {
      const others = await one<any>("SELECT count(*)::int AS n FROM users WHERE role = 'sysadmin' AND active AND id <> $1", [id]);
      if (!others.n) throw bad('At least one active System Administrator is required.');
    }
    await pool.query('UPDATE users SET name = $2, email = $3, role = $4, scope_department = $5, active = $6, updated_at = now() WHERE id = $1',
      [id, next.name, next.email, next.role, next.role === 'depthead' ? next.scope : null, next.active]);
    if (!next.active || next.role !== cur.role) await revokeUserSessions(id);
    const changes = [next.role !== cur.role && `role ${(ROLES as any)[cur.role].label} → ${(ROLES as any)[next.role].label}`, next.active !== cur.active && (next.active ? 'activated' : 'deactivated'),
      next.scope !== cur.scope_department && next.role === 'depthead' && `scope → ${next.scope}`, next.email !== cur.email && `email → ${next.email}`, next.name !== cur.name && `name → ${next.name}`].filter(Boolean).join('; ');
    await audit(null, req.actor, 'Update', 'User', next.email, changes || 'Updated', { role: cur.role, active: cur.active }, { role: next.role, active: next.active });
    await loadConfig();
    return publicConfig(req.user);
  });
  app.post('/api/admin/users/:id/reset-password', admin, async (req) => {
    const id = (req.params as any).id;
    const cur = await one<any>('SELECT * FROM users WHERE id = $1', [id]);
    if (!cur) throw new HttpError(404, 'User not found.');
    const temp = crypto.randomBytes(7).toString('base64url') + '9';
    await pool.query('UPDATE users SET password_hash = $2, must_change_password = true, failed_logins = 0, locked_until = NULL, updated_at = now() WHERE id = $1', [id, await hashPassword(temp)]);
    await revokeUserSessions(id);
    await audit(null, req.actor, 'Update', 'User', cur.email, 'Password reset by administrator; sessions signed out');
    return { temporaryPassword: temp };
  });

  // ---------- templates & system configuration ----------
  app.put('/api/admin/templates/:id', admin, async (req) => {
    const b = z.object({ subject: z.string().min(3).max(200).optional(), channel: z.enum(['In-app', 'Email', 'In-app + email']).optional() }).parse(req.body);
    const cur = await one<any>('SELECT * FROM notification_templates WHERE id = $1', [(req.params as any).id]);
    if (!cur) throw new HttpError(404, 'Template not found.');
    await pool.query('UPDATE notification_templates SET subject = $2, channel = $3 WHERE id = $1', [cur.id, b.subject ?? cur.subject, b.channel ?? cur.channel]);
    await audit(null, req.actor, 'Configure', 'Notification template', cur.event, [b.subject && `subject → ${b.subject}`, b.channel && `channel ${cur.channel} → ${b.channel}`].filter(Boolean).join('; '));
    await loadConfig();
    return publicConfig(req.user);
  });
  app.put('/api/admin/system', admin, async (req) => {
    const b = z.object({ maxFileMB: z.number().int().min(1).max(50).optional(), fileTypes: z.array(z.enum(['PDF', 'JPG', 'PNG', 'TIFF', 'HEIC'])).min(1).optional(),
      aiEnabled: z.boolean().optional(), retention: z.string().max(200).optional(), inApp: z.boolean().optional(), email: z.boolean().optional(),
      escalation: z.boolean().optional(), digestDay: z.enum(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']).optional(),
      alertsEnabled: z.boolean().optional(), passwordMinLength: z.number().int().min(8).max(64).optional() }).parse(req.body);
    const before = cfg().system;
    for (const [k, v] of Object.entries(b)) {
      await pool.query('INSERT INTO system_config (key, value, updated_by, updated_at) VALUES ($1,$2,$3,now()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = now()', [k, JSON.stringify(v), req.actor.name]);
    }
    await audit(null, req.actor, 'Configure', 'System', 'Configuration', Object.entries(b).map(([k, v]) => `${k} ${JSON.stringify((before as any)[k])} → ${JSON.stringify(v)}`).join('; '));
    await loadConfig();
    return publicConfig(req.user);
  });

  // ---------- operations health (§15 observability) ----------
  app.get('/api/admin/health', admin, async () => {
    const db = await one<any>(`SELECT version() AS version, pg_size_pretty(pg_database_size(current_database())) AS size, (SELECT max(version) FROM schema_migrations) AS migration`);
    const counts = await one<any>(`SELECT (SELECT count(*) FROM users WHERE active) AS users, (SELECT count(*) FROM employees) AS employees, (SELECT count(*) FROM assets) AS assets,
      (SELECT count(*) FROM files) AS files, (SELECT COALESCE(sum(size_bytes),0) FROM files) AS file_bytes, (SELECT count(*) FROM notifications WHERE email_status = 'pending') AS email_pending,
      (SELECT count(*) FROM notifications WHERE email_status = 'failed') AS email_failed, (SELECT count(*) FROM audit_events) AS audit_events`);
    const jobs = await q<any>(`SELECT DISTINCT ON (job) job, started_at, finished_at, status, detail, error FROM job_runs ORDER BY job, started_at DESC`);
    const recentFailures = await q<any>(`SELECT job, started_at, error FROM job_runs WHERE status = 'failed' ORDER BY started_at DESC LIMIT 5`);
    let backups: any[] = [];
    const bdir = process.env.BACKUP_DIR;
    if (bdir && fs.existsSync(bdir)) backups = fs.readdirSync(bdir).filter((f) => /\.(sql\.gz|dump)$/.test(f)).map((f) => { const s = fs.statSync(path.join(bdir, f)); return { file: f, size: s.size, at: s.mtime }; }).sort((a, b) => +b.at - +a.at).slice(0, 10);
    return {
      app: { version: '1.0.0', node: process.version, env: env.nodeEnv, uptimeMinutes: Math.round(process.uptime() / 60), timezone: env.tz, jobsEnabled: env.jobsEnabled },
      database: db, counts, storage: await storageHealth(), email: { configured: emailConfigured(), enabledInSettings: cfg().system.email },
      jobs, recentFailures, backups: { dir: bdir || null, latest: backups },
      ai: { enabledInSettings: cfg().system.aiEnabled, provider: aiConfigured() ? env.aiProvider : 'rules engine only', model: aiConfigured() ? env.aiModel : null, last24h: await one<any>(`SELECT count(*)::int AS questions, count(*) FILTER (WHERE engine = 'ai')::int AS by_provider FROM ai_interactions WHERE at > now() - interval '1 day'`) },
      alertsEnabled: cfg().system.alertsEnabled, officersAssigned: cfg().docTypes.every((t) => !t.expires || t.officer),
    };
  });
  app.post('/api/admin/email/verify', admin, async () => verifySmtp());
  app.post('/api/admin/jobs/:job/run', admin, async (req) => {
    const job = (req.params as any).job;
    const fn = ({ expiry: runExpiryJob, digest: () => runDigestJob(true), mail: runMailJob } as any)[job];
    if (!fn) throw bad('Unknown job.');
    const result = await fn();
    await audit(null, req.actor, 'Run job', 'System', job, JSON.stringify(result).slice(0, 300));
    return { result };
  });

  // ---------- audit log (§4.1) ----------
  app.get('/api/audit', { preHandler: async (req: any) => { await requireUser(req); requireAuditor(req.user); } }, async (req) => {
    const f = z.object({ q: z.string().max(100).optional(), user: z.string().max(120).optional(), action: z.string().max(40).optional(), entity: z.string().max(60).optional(),
      from: z.string().optional(), to: z.string().optional(), limit: z.coerce.number().int().min(1).max(500).default(200), offset: z.coerce.number().int().min(0).default(0) }).parse(req.query);
    const cond: string[] = []; const p: any[] = [];
    const add = (sql: string, v: any) => { p.push(v); cond.push(sql.replace('?', `$${p.length}`)); };
    if (f.q) add("(record ILIKE ? OR detail ILIKE $X)".replace('$X', `$${p.length + 1}`), `%${f.q}%`);
    if (f.user) add('user_name = ?', f.user);
    if (f.action) add('action = ?', f.action);
    if (f.entity) add('entity = ?', f.entity);
    if (f.from) add('at >= ?::date', f.from);
    if (f.to) add("at < ?::date + 1", f.to);
    const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
    const total = await one<any>(`SELECT count(*)::int AS n FROM audit_events ${where}`, p);
    const rows = await q<any>(`SELECT id, at, user_name AS user, role, action, entity, record, detail FROM audit_events ${where} ORDER BY at DESC, id DESC LIMIT ${f.limit} OFFSET ${f.offset}`, p);
    const facets = await one<any>(`SELECT array_agg(DISTINCT action) AS actions, array_agg(DISTINCT entity) AS entities, array_agg(DISTINCT user_name) AS users FROM audit_events`);
    return { total: total.n, items: rows, facets };
  });
}
