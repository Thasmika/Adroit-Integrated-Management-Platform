// Vehicle & Equipment module (§8).
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser, can, assert, bad, requireModule, HttpError } from '../auth.js';
import { one, q, tx } from '../db.js';
import { audit, diffText } from '../audit.js';
import { assetRow, getAssetOut, scopedData } from '../model.js';
import { storeFile, removeStored } from '../storage.js';

const opt = z.union([z.string(), z.number()]).optional().nullable().transform((v) => (v === '' || v == null ? null : String(v).trim()));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal('').transform(() => null));
export const AssetInput = z.object({
  category: z.string().min(1), make: z.string().trim().min(1).max(80), model: z.string().trim().min(1).max(80), body: opt,
  year: z.coerce.number().int().min(1970).max(2100).optional().nullable(), colour: opt, emirate: opt, plate: opt,
  vin: z.string().trim().min(3).max(60), engine: opt, capacity: opt, company: z.string().min(1), department: z.string().min(1), location: opt,
  status: z.enum(['Active', 'Under Repair', 'Standby', 'Off-road', 'Inactive', 'Disposed']).default('Active'),
  usage: opt, officer: opt, acquired: date, odometer: opt, remarks: opt,
});
const COLS = ['category', 'make', 'model', 'body', 'year', 'colour', 'emirate', 'plate', 'vin', 'engine', 'capacity', 'company', 'department', 'location', 'status', 'usage', 'officer', 'acquired', 'odometer', 'remarks'];
const LABELS = { status: 'status', location: 'location', department: 'department', company: 'registered company', category: 'category', plate: 'plate', officer: 'responsible officer' };

async function duplicateCheck(c: any, b: any, exceptId?: string) {
  // Uniqueness of plate / VIN is a §19 confirmation item; the system blocks exact duplicates among active assets meanwhile
  const d = await one<any>(`SELECT fleet_no FROM assets WHERE id <> COALESCE($3::uuid, '00000000-0000-0000-0000-000000000000') AND status <> 'Disposed'
                            AND (lower(vin) = lower($1) OR ($2::text IS NOT NULL AND lower(plate) = lower($2)))`, [b.vin, b.plate, exceptId || null], c);
  if (d) throw new HttpError(409, `${d.fleet_no} already has this chassis / serial or plate number.`, 'duplicate');
}

export async function createAsset(c: any, actor: any, b: z.infer<typeof AssetInput>, opts: { fleetNo?: string } = {}) {
  if (b.category !== 'Heavy Machine / Equipment' && !b.plate) throw bad('Enter the registration (plate) number, or choose Heavy Machine / Equipment for an unregistered machine.');
  await duplicateCheck(c, b);
  const fleetNo = opts.fleetNo || `VH-${String((await one<any>("SELECT COALESCE(max(substring(fleet_no from '\\d+$')::int), 0) + 1 AS n FROM assets", [], c)).n).padStart(4, '0')}`;
  const a = await one<any>(`INSERT INTO assets (fleet_no, ${COLS.join(', ')}, created_by, updated_by) VALUES ($1, ${COLS.map((_, i) => `$${i + 2}`).join(', ')}, $${COLS.length + 2}, $${COLS.length + 2}) RETURNING *`,
    [fleetNo, ...COLS.map((k) => (b as any)[k] ?? null), actor.name], c);
  await audit(c, actor, 'Create', 'Asset', fleetNo, `Added to fleet: ${b.make} ${b.model} (${b.category}) · ${b.company}`, undefined, { category: b.category, plate: b.plate, vin: b.vin });
  return a;
}

export default async function fleetRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (req) => { if (req.url.startsWith('/api/assets')) { await requireUser(req); requireModule(req.user, 'fleet'); } });

  app.get('/api/assets', async (req) => ({ items: (await scopedData(req.user)).assets }));
  app.get('/api/assets/:no', async (req) => getAssetOut(req.user, (await assetRow(req.user, decodeURIComponent((req.params as any).no))).id));

  app.get('/api/assets/:no/history', async (req) => {
    const a = await assetRow(req.user, decodeURIComponent((req.params as any).no));
    const rows = await q<any>("SELECT at, user_name, action, entity, detail FROM audit_events WHERE record = $1 AND entity IN ('Asset','Asset document') AND action <> 'View' ORDER BY at DESC LIMIT 300", [a.fleet_no]);
    return { items: rows.map((r) => ({ date: new Date(r.at).toISOString().slice(0, 10), what: `${r.detail} · ${r.user_name}` })) };
  });

  app.post('/api/assets', async (req) => {
    assert(can(req.user, 'editAsset'));
    const b = AssetInput.parse(req.body);
    const a = await tx((c) => createAsset(c, req.actor, b));
    return getAssetOut(req.user, a.id);
  });

  app.put('/api/assets/:no', async (req) => {
    assert(can(req.user, 'editAsset'));
    const b = AssetInput.parse(req.body);
    const cur = await assetRow(req.user, decodeURIComponent((req.params as any).no));
    if (b.category !== 'Heavy Machine / Equipment' && !b.plate) throw bad('Enter the registration (plate) number.');
    await tx(async (c) => {
      await duplicateCheck(c, b, cur.id);
      await c.query(`UPDATE assets SET ${COLS.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_by = $${COLS.length + 2}, updated_at = now() WHERE id = $1`,
        [cur.id, ...COLS.map((k) => (b as any)[k] ?? null), req.actor.name]);
      const detail = diffText(cur, { ...b, year: b.year }, LABELS);
      await audit(c, req.actor, 'Update', 'Asset', cur.fleet_no, detail ? `Updated ${detail}` : 'Profile details updated', Object.fromEntries(COLS.map((k) => [k, cur[k]])), b);
    });
    return getAssetOut(req.user, cur.id);
  });

  app.post('/api/assets/:no/photo', async (req) => {
    assert(can(req.user, 'editAsset'));
    const cur = await assetRow(req.user, decodeURIComponent((req.params as any).no));
    const part = await req.file();
    if (!part) throw bad('Choose a photo.');
    const buf = await part.toBuffer();
    let full: string | undefined;
    try {
      await tx(async (c) => {
        const f = await storeFile(c, buf, part.filename, { module: 'fleet', id: cur.id }, req.user.id, 'photo');
        full = f.full;
        await c.query('UPDATE assets SET photo_file_id = $2, updated_by = $3, updated_at = now() WHERE id = $1', [cur.id, f.id, req.actor.name]);
        await audit(c, req.actor, 'Upload', 'Asset', cur.fleet_no, 'Asset photo updated');
      });
    } catch (e) { await removeStored(full); throw e; }
    return getAssetOut(req.user, cur.id);
  });
}
