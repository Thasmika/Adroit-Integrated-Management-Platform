// Document service endpoints shared by both modules (§9, §10, §14 Employee / Asset Documents, Expiry / Actions).
//   POST /api/documents/:module/:owner/:type   multipart: mode=upload|renew, ref, issuer, issued, expiry, name, file
//   PUT  /api/actions/:module/:owner/:type     { status, note }
//   GET  /api/documents/:module/:owner/:type/actions   action history
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser, bad, requireModule, notFound } from '../auth.js';
import { tx, one } from '../db.js';
import { employeeRow, assetRow, getEmployeeOut, getAssetOut } from '../model.js';
import { saveDocument, updateAction, actionHistory } from '../services/documents.js';
import { canSeeDoc } from '@adroit/core/src/core/access.js';

async function owner(user: any, module: string, no: string, c?: any) {
  if (module === 'hr') { const e = await employeeRow(user, no, c); return { uid: e.id, no: e.emp_no, label: e.name }; }
  if (module === 'fleet') { const a = await assetRow(user, no, c); return { uid: a.id, no: a.fleet_no, label: `${a.make} ${a.model}` }; }
  throw bad('Unknown module.');
}
const out = (user: any, module: string, uid: string) => (module === 'hr' ? getEmployeeOut(user, uid) : getAssetOut(user, uid));

export default async function docRoutes(app: FastifyInstance) {
  app.post('/api/documents/:module/:owner/:type', { preHandler: requireUser }, async (req) => {
    const p = req.params as any;
    const module = p.module as 'hr' | 'fleet';
    requireModule(req.user, module);
    const type = decodeURIComponent(p.type);
    const o = await owner(req.user, module, decodeURIComponent(p.owner));
    const fields: Record<string, string> = {};
    let file: { buffer: Buffer; filename: string } | null = null;
    if (req.isMultipart()) {
      for await (const part of req.parts()) {
        if (part.type === 'file') { if (part.filename) file = { buffer: await part.toBuffer(), filename: part.filename }; else await part.toBuffer(); }
        else fields[part.fieldname] = String(part.value ?? '');
      }
    } else Object.assign(fields, req.body || {});
    const f = z.object({ mode: z.enum(['upload', 'renew']).default('upload'), name: z.string().max(120).optional(), ref: z.string().max(80).optional(),
      issuer: z.string().max(120).optional(), issued: z.string().max(10).optional(), expiry: z.string().max(10).optional() }).parse(fields);
    await tx((c) => saveDocument(c, req.user, req.actor, module, o, type, f.mode, f, file));
    return out(req.user, module, o.uid);
  });

  app.put('/api/actions/:module/:owner/:type', { preHandler: requireUser }, async (req) => {
    const p = req.params as any;
    const module = p.module as 'hr' | 'fleet';
    requireModule(req.user, module);
    const b = z.object({ status: z.string(), note: z.string().max(500).optional().default('') }).parse(req.body);
    const o = await owner(req.user, module, decodeURIComponent(p.owner));
    await tx((c) => updateAction(c, req.user, req.actor, module, o, decodeURIComponent(p.type), b.status, b.note));
    return out(req.user, module, o.uid);
  });

  app.get('/api/documents/:module/:owner/:type/actions', { preHandler: requireUser }, async (req) => {
    const p = req.params as any;
    requireModule(req.user, p.module);
    const type = decodeURIComponent(p.type);
    if (!canSeeDoc(req.user, type)) throw notFound();
    const o = await owner(req.user, p.module, decodeURIComponent(p.owner));
    const d = await one<any>('SELECT id FROM documents WHERE owner_module = $1 AND owner_id = $2 AND type = $3', [p.module, o.uid, type]);
    return { items: d ? await actionHistory(d.id) : [] };
  });
}
