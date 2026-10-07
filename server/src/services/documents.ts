// Shared document service for both modules (§9): record/update, upload scan, renew (supersede with history),
// renewal action tracking (§10). All writes are transactional and audited.
import type pg from 'pg';
import { one, q } from '../db.js';
import { audit, Actor } from '../audit.js';
import { bad, can, forbidden, assert } from '../auth.js';
import { storeFile, removeStored } from '../storage.js';
import { docCfg, fmt, iso, ACTION_STATES } from '@adroit/core/src/core/shared.js';
import { cfg } from '../config.js';

export type DocFields = { name?: string; ref?: string; issuer?: string; issued?: string; expiry?: string };
export type Upload = { buffer: Buffer; filename: string } | null;
const dateOk = (s?: string) => !s || /^\d{4}-\d{2}-\d{2}$/.test(s);
const entity = (m: string) => (m === 'hr' ? 'Employee document' : 'Asset document');

function checkType(module: 'hr' | 'fleet', type: string) {
  const t = cfg().docTypes.find((x) => x.key === type);
  if (!t || t.module !== module) throw bad(`Unknown document type "${type}" for this module.`);
  return t;
}

export async function saveDocument(c: pg.PoolClient, user: any, actor: Actor, module: 'hr' | 'fleet', owner: { uid: string; no: string; label: string },
  type: string, mode: 'upload' | 'renew', f: DocFields, file: Upload) {
  const t = checkType(module, type);
  assert(can(user, 'uploadDoc', { type }), forbidden(`Your role can't change ${type} records.`));
  if (!dateOk(f.issued) || !dateOk(f.expiry)) throw bad('Dates must be in YYYY-MM-DD format.');
  if (f.issued && f.expiry && f.expiry < f.issued) throw bad('The expiry date is before the issue date.');
  if (!t.expires) f.expiry = '';
  const today = iso(new Date());
  let written: string | undefined;
  try {
    let doc = await one<any>('SELECT * FROM documents WHERE owner_module = $1 AND owner_id = $2 AND type = $3 FOR UPDATE', [module, owner.uid, type], c);
    const cur = doc ? await one<any>('SELECT v.*, f.original_name FROM document_versions v LEFT JOIN files f ON f.id = v.file_id WHERE v.document_id = $1 AND v.is_current', [doc.id], c) : null;
    const stored = file ? await storeFile(c, file.buffer, file.filename, { module, id: owner.uid }, user.id) : null;
    written = stored?.full;
    const name = (type === 'Other Permit' ? f.name?.trim() : '') || doc?.name || type;
    if (type === 'Other Permit' && !name.trim()) throw bad('Enter the permit name.');

    if (mode === 'renew') {
      if (!doc || !cur) throw bad('There is no current document to renew. Record it first.');
      if (t.expires && (!f.expiry || f.expiry <= today)) throw bad('Enter the new expiry date. It must be after today.');
      await c.query('UPDATE document_versions SET is_current = false, superseded_at = now(), superseded_by = $2 WHERE id = $1', [cur.id, actor.name]);
      await c.query(`INSERT INTO document_versions (document_id, ref, issuer, issued, expiry, file_id, is_current, created_by) VALUES ($1,$2,$3,$4,$5,$6,true,$7)`,
        [doc.id, f.ref || null, f.issuer ?? cur.issuer, f.issued || null, f.expiry || null, stored?.id || null, actor.name]);
      if (name !== doc.name) await c.query('UPDATE documents SET name = $2 WHERE id = $1', [doc.id, name]);
      // renewal closes the open action as Completed (§10 Completion)
      const act = await one<any>(`UPDATE expiry_actions SET status = 'Completed', completed_at = now(), completed_by = $2, updated_at = now(), updated_by = $2
                                  WHERE document_id = $1 AND completed_at IS NULL RETURNING id`, [doc.id, actor.name], c);
      if (act) await c.query("INSERT INTO action_events (action_id, by_user, status, note) VALUES ($1,$2,'Completed','Renewed document recorded')", [act.id, actor.name]);
      await audit(c, actor, 'Renew', entity(module), owner.no,
        `${name} renewed: ${cur.ref || '—'} (exp. ${fmt(cur.expiry)}) → ${f.ref || '—'} (exp. ${fmt(f.expiry)})${stored ? `; scan ${stored.name}` : '; no scan attached'}; previous version kept in history`,
        { ref: cur.ref, expiry: cur.expiry, file: cur.original_name }, { ref: f.ref, expiry: f.expiry, file: stored?.name });
    } else if (doc && cur) {
      const next = { ref: f.ref ?? cur.ref, issuer: f.issuer ?? cur.issuer, issued: f.issued === undefined ? cur.issued : f.issued || null, expiry: f.expiry === undefined ? cur.expiry : f.expiry || null };
      const changed = ['ref', 'issuer', 'issued', 'expiry'].filter((k) => String((next as any)[k] ?? '') !== String(cur[k] ?? ''));
      if (!stored && !changed.length && name === doc.name) throw bad('Choose a scanned file, or change the document details.');
      await c.query('UPDATE document_versions SET ref = $2, issuer = $3, issued = $4, expiry = $5, file_id = COALESCE($6, file_id) WHERE id = $1',
        [cur.id, next.ref, next.issuer, next.issued, next.expiry, stored?.id || null]);
      if (name !== doc.name) await c.query('UPDATE documents SET name = $2 WHERE id = $1', [doc.id, name]);
      await audit(c, actor, stored ? 'Upload' : 'Update', entity(module), owner.no,
        [stored && `${name} scan ${cur.file_id ? `replaced (${cur.original_name} → ${stored.name})` : `uploaded (${stored.name})`}`, ...changed.map((k) => `${k} ${cur[k] ?? '—'} → ${(next as any)[k] ?? '—'}`)].filter(Boolean).join('; '),
        Object.fromEntries(changed.map((k) => [k, cur[k]])), Object.fromEntries(changed.map((k) => [k, (next as any)[k]])));
    } else {
      if (!f.ref?.trim()) throw bad('Enter the document / reference number.');
      if (t.expires && !f.expiry) throw bad('Enter the expiry date.');
      doc = await one<any>('INSERT INTO documents (owner_module, owner_id, type, name) VALUES ($1,$2,$3,$4) RETURNING *', [module, owner.uid, type, name], c);
      await c.query(`INSERT INTO document_versions (document_id, ref, issuer, issued, expiry, file_id, is_current, created_by) VALUES ($1,$2,$3,$4,$5,$6,true,$7)`,
        [doc.id, f.ref, f.issuer || null, f.issued || null, f.expiry || null, stored?.id || null, actor.name]);
      await audit(c, actor, 'Create', entity(module), owner.no, `${name} recorded: ${f.ref}${f.expiry ? `, expires ${fmt(f.expiry)}` : ''}${stored ? `; scan ${stored.name}` : ''}`, undefined, { ref: f.ref, expiry: f.expiry });
    }
    return doc.id;
  } catch (e) {
    await removeStored(written);
    throw e;
  }
}

export async function updateAction(c: pg.PoolClient, user: any, actor: Actor, module: 'hr' | 'fleet', owner: { uid: string; no: string }, type: string, status: string, note: string) {
  checkType(module, type);
  assert(can(user, 'trackAction', { type }), forbidden(`Your role can't update ${type} renewals.`));
  if (!ACTION_STATES.includes(status) || status === 'Open') throw bad(`Status must be one of: ${ACTION_STATES.filter((s: string) => s !== 'Open').join(', ')}.`);
  const doc = await one<any>('SELECT id, name FROM documents WHERE owner_module = $1 AND owner_id = $2 AND type = $3', [module, owner.uid, type], c);
  if (!doc) throw bad('Record the document first.');
  let act = await one<any>('SELECT * FROM expiry_actions WHERE document_id = $1 AND completed_at IS NULL FOR UPDATE', [doc.id], c);
  const before = act?.status || 'Open';
  if (!act) act = await one<any>(`INSERT INTO expiry_actions (document_id, status, assigned_to, note, updated_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [doc.id, status, docCfg(type).officer || null, note || null, actor.name], c);
  else await c.query('UPDATE expiry_actions SET status = $2, note = $3, updated_at = now(), updated_by = $4 WHERE id = $1', [act.id, status, note || act.note, actor.name]);
  await c.query('INSERT INTO action_events (action_id, by_user, status, note) VALUES ($1,$2,$3,$4)', [act.id, actor.name, status, note || null]);
  await audit(c, actor, 'Update', entity(module), owner.no, `${doc.name} renewal action ${before} → ${status}${note ? ` – ${note}` : ''}`, { status: before }, { status });
}

export async function actionHistory(docId: string) {
  return q<any>(`SELECT ae.at, ae.by_user, ae.status, ae.note FROM action_events ae JOIN expiry_actions a ON a.id = ae.action_id WHERE a.document_id = $1 ORDER BY ae.at DESC`, [docId]);
}
