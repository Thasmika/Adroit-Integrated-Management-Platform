// Bootstrap, dashboard, attention, unified search, AI assistance, notifications, file access, health (§11, §12, §14).
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser, notFound, assert } from '../auth.js';
import { publicConfig, cfg } from '../config.js';
import { scopedData } from '../model.js';
import { one, q, pool } from '../db.js';
import { audit } from '../audit.js';
import { openFile } from '../storage.js';
import { env } from '../env.js';
import { canModule, canSeeDoc } from '@adroit/core/src/core/access.js';
import { ROLES } from '@adroit/core/src/core/shared.js';
import { buildAttention, isAttention, leaveActions } from '@adroit/core/src/core/attention.js';
import { answerAll } from '@adroit/core/src/core/ai.js';
import { planWithProvider, planToQuestion, aiConfigured } from '../ai.js';

const attentionOut = (i: any) => ({
  module: i.module, kind: i.kind, ownerId: i.ownerId, ownerName: i.ownerName, type: i.type, name: i.doc?.name || i.type,
  ref: i.doc?.ref || null, expiry: i.doc?.expiry || null, status: i.st.key, statusLabel: i.st.label, days: i.d,
  action: i.action, officer: i.officer?.name, officerId: i.officer?.id, company: i.company, department: i.department, location: i.location, link: i.link,
});

export default async function coreRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => {
    await pool.query('SELECT 1');
    return { ok: true, time: new Date().toISOString() };
  });

  // before sign-in: whether this is a demo installation (shows the demo accounts on the sign-in page)
  app.get('/api/public-info', async () => ({ demo: (cfg().system as any).demoMode === true, organisation: 'Adroit Building Materials Trading Ent. L.L.C' }));

  // Everything the signed-in user may see, in one call (Phase 1 volumes: hundreds of employees and assets)
  app.get('/api/bootstrap', { preHandler: requireUser }, async (req) => {
    const data = await scopedData(req.user);
    return { user: req.user, config: publicConfig(req.user), ...data };
  });

  app.get('/api/dashboard', { preHandler: requireUser }, async (req) => {
    const u = req.user;
    const data = await scopedData(u);
    const state = { ...data, config: cfg() };
    const items = buildAttention(state, u, 60);
    const att = items.filter(isAttention);
    const byModule = (m: string) => ({
      expiring: att.filter((i: any) => i.module === m && i.kind === 'doc').length,
      missing: att.filter((i: any) => i.module === m && i.kind === 'missing').length,
      byType: Object.fromEntries([...new Set(att.filter((i: any) => i.module === m).map((i: any) => i.type))].map((t) => [t, att.filter((i: any) => i.module === m && i.type === t).length])),
    });
    return {
      employees: data.employees.filter((e: any) => e.status === 'Active').length,
      assets: data.assets.filter((a: any) => a.status === 'Active').length,
      onLeave: data.leaves.filter((l: any) => l.status === 'On Leave').length,
      pendingLeave: leaveActions(state, u).length,
      openActions: att.filter((i: any) => i.kind === 'doc' && ['expired', 'critical'].includes(i.st.key) && i.action === 'Open').length,
      hr: canModule(u, 'hr') ? byModule('hr') : null,
      fleet: canModule(u, 'fleet') ? byModule('fleet') : null,
    };
  });

  app.get('/api/attention', { preHandler: requireUser }, async (req) => {
    const f = z.object({ module: z.string().optional(), officer: z.string().optional(), status: z.string().optional(), type: z.string().optional(),
      company: z.string().optional(), department: z.string().optional(), location: z.string().optional(), within: z.coerce.number().optional() }).parse(req.query);
    const data = await scopedData(req.user);
    const items = buildAttention({ ...data, config: cfg() }, req.user, f.within ?? 60).filter((i: any) =>
      (!f.module || i.module === f.module) && (!f.officer || i.officer?.id === f.officer) && (!f.status || i.st.key === f.status) && (!f.type || i.type === f.type) &&
      (!f.company || i.company === f.company) && (!f.department || i.department === f.department) && (!f.location || i.location === f.location) &&
      (f.within != null || isAttention(i)));
    return { items: items.map(attentionOut) };
  });

  // Unified scoped search (§11.4)
  app.get('/api/search', { preHandler: requireUser }, async (req) => {
    const { q: term } = z.object({ q: z.string().min(2).max(100) }).parse(req.query);
    const t = term.toLowerCase();
    const u = req.user;
    const limited = (ROLES as any)[u.role]?.noDocs;
    const data = await scopedData(u);
    const employees = data.employees.filter((e: any) => [e.id, e.id.replace(' ', ''), e.name, e.designation, ...(limited ? [] : [e.nationality, e.mobile])].join(' ').toLowerCase().includes(t)).slice(0, 50)
      .map((e: any) => ({ id: e.id, name: e.name, designation: e.designation, department: e.department }));
    const assets = data.assets.filter((a: any) => [a.id, a.plate, a.vin, a.make, a.model, a.body].join(' ').toLowerCase().includes(t)).slice(0, 50)
      .map((a: any) => ({ id: a.id, make: a.make, model: a.model, plate: a.plate, location: a.location }));
    const documents: any[] = [];
    [['hr', data.employees], ['fleet', data.assets]].forEach(([m, list]: any) => list.forEach((o: any) => o.docs.forEach((d: any) => {
      if ((d.ref || '').toLowerCase().includes(t)) documents.push({ module: m, owner: o.id, type: d.type, name: d.name, ref: d.ref, expiry: d.expiry });
    })));
    return { employees, assets, documents: documents.slice(0, 50) };
  });

  // AI assistance (§12): read-only, permission-filtered, grounded in records, logged. Rule-based in Phase 1;
  app.post('/api/ai/ask', { preHandler: requireUser, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { question } = z.object({ question: z.string().min(2).max(500) }).parse(req.body);
    if (!cfg().system.aiEnabled) return reply.status(503).send({ error: 'The AI assistant is switched off. Search, dashboards and alerts keep working.', code: 'ai_disabled' });
    const data = await scopedData(req.user);
    const state = { ...data, config: cfg() };
    // 1) the provider (if configured) picks one approved read-only operation; 2) the server runs it with the
    // user's permissions; 3) any provider problem falls back to the rules engine on the original question.
    let a: any = null;
    let engine = 'rules';
    let routed: string | null = null;
    if (aiConfigured()) {
      const plan = await planWithProvider(question, { role: ROLES[req.user.role]?.label || req.user.role, modules: ['hr', 'fleet'].filter((m) => canModule(req.user, m)) });
      routed = plan ? planToQuestion(plan) : null;
      if (routed) {
        const r = answerAll(state, req.user, routed);
        if (!/couldn't match/.test(r.text)) { a = r; engine = 'ai'; }
      }
    }
    if (!a) a = answerAll(state, req.user, question);
    a.engine = engine;
    const refs = (a.rows || []).map((r: any) => (r.emp || r.asset)?.id).concat((a.mixed || []).map((r: any) => r.id)).concat((a.docs || []).map((d: any) => `${(d.emp || d.asset)?.id}:${d.doc.type}`)).filter(Boolean);
    await pool.query('INSERT INTO ai_interactions (user_id, question, module, result_count, result_refs, engine, routed_as) VALUES ($1,$2,$3,$4,$5,$6,$7)', [req.user.id, question, a.module, refs.length, JSON.stringify(refs.slice(0, 200)), engine, engine === 'ai' ? routed : null]);
    await audit(null, req.actor, 'AI query', 'AI interaction', a.module === 'mixed' ? 'HR + Fleet' : a.module === 'hr' ? 'HR' : a.module === 'fleet' ? 'Fleet' : '—', `“${question}”${routed && engine === 'ai' ? ` → routed as “${routed}”` : ''} → ${refs.length} records returned (read-only, ${engine === 'ai' ? env.aiModel : 'rules engine'})`);
    // strip heavy nested objects: rows carry the owner summary the UI needs
    const slim = (o: any) => o && { id: o.id, name: o.name, photo: o.photo, category: o.category, make: o.make, model: o.model };
    return {
      ...a,
      rows: a.rows?.map((r: any) => ({ cols: r.cols, emp: r.emp && slim(r.emp), asset: r.asset && slim(r.asset) })),
      docs: a.docs?.map((r: any) => ({ doc: r.doc, emp: r.emp && { ...slim(r.emp), nationality: r.emp.nationality, sponsor: r.emp.sponsor }, asset: r.asset && { ...slim(r.asset), plate: r.asset.plate, vin: r.asset.vin, company: r.asset.company } })),
    };
  });

  // ---------- notifications ----------
  app.get('/api/notifications', { preHandler: requireUser }, async (req) => {
    const rows = await q<any>('SELECT id, title, body, link, created_at, read_at, email_status FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200', [req.user.id]);
    const unread = await one<any>('SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL', [req.user.id]);
    return { unread: unread.n, items: rows };
  });
  app.post('/api/notifications/:id/read', { preHandler: requireUser }, async (req) => {
    await pool.query('UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL', [(req.params as any).id, req.user.id]);
    return { ok: true };
  });
  app.post('/api/notifications/read-all', { preHandler: requireUser }, async (req) => {
    await pool.query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [req.user.id]);
    return { ok: true };
  });

  // ---------- private file access (§9): authorization checked before every view / download ----------
  app.get('/api/files/:id', { preHandler: requireUser }, async (req, reply) => {
    const id = (req.params as any).id;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound();
    const f = await one<any>('SELECT * FROM files WHERE id = $1', [id]);
    if (!f) throw notFound();
    const u = req.user;
    assert(canModule(u, f.owner_module), notFound());
    const owner = f.owner_module === 'hr'
      ? await one<any>('SELECT emp_no AS no, department FROM employees WHERE id = $1', [f.owner_id])
      : await one<any>('SELECT fleet_no AS no FROM assets WHERE id = $1', [f.owner_id]);
    if (!owner) throw notFound();
    if ((ROLES as any)[u.role]?.scoped && owner.department !== u.scope) throw notFound();
    let docName = 'photo';
    if (f.purpose === 'document') {
      const d = await one<any>('SELECT d.type, d.name FROM document_versions v JOIN documents d ON d.id = v.document_id WHERE v.file_id = $1 LIMIT 1', [id]);
      if (!d || !canSeeDoc(u, d.type)) throw notFound();
      docName = d.name;
      await audit(null, req.actor, (req.query as any).download ? 'Download' : 'View', f.owner_module === 'hr' ? 'Employee document' : 'Asset document', owner.no, `${docName} (${f.original_name})`);
    }
    reply.header('Content-Type', f.mime);
    reply.header('Content-Disposition', `${(req.query as any).download ? 'attachment' : 'inline'}; filename="${f.original_name.replace(/"/g, '')}"`);
    reply.header('Cache-Control', 'private, no-store');
    return reply.send(openFile(f.storage_key));
  });
}
