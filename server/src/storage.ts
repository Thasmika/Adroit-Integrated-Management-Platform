// Private document storage (§9): files live outside the web root under system-generated keys; the original
// file name is metadata only. Every read goes through the API, which checks permission first.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from './env.js';
import { cfg } from './config.js';
import { Db } from './db.js';
import { bad } from './auth.js';

const SIGNATURES: { type: string; mime: string; test: (b: Buffer) => boolean }[] = [
  { type: 'PDF', mime: 'application/pdf', test: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  { type: 'JPG', mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: 'PNG', mime: 'image/png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: 'TIFF', mime: 'image/tiff', test: (b) => (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a) || (b[0] === 0x4d && b[1] === 0x4d && b[3] === 0x2a) },
  { type: 'HEIC', mime: 'image/heic', test: (b) => b.subarray(4, 12).toString('latin1').startsWith('ftyphei') || b.subarray(4, 12).toString('latin1').startsWith('ftypmif1') },
];

// Content is checked by its bytes, not by the file name the browser sent
export function detectType(buf: Buffer) {
  return SIGNATURES.find((s) => s.test(buf)) || null;
}

export function validateFile(buf: Buffer, originalName: string, opts: { imageOnly?: boolean } = {}) {
  const sys = cfg().system;
  if (!buf.length) throw bad('The file is empty.');
  if (buf.length > sys.maxFileMB * 1048576) throw bad(`The file is ${(buf.length / 1048576).toFixed(1)} MB. The limit is ${sys.maxFileMB} MB.`);
  const t = detectType(buf);
  if (!t) throw bad(`"${originalName}" is not a supported file. Allowed: ${sys.fileTypes.join(', ')}.`);
  if (opts.imageOnly && !t.mime.startsWith('image/')) throw bad('Choose a JPG or PNG image for the photo.');
  if (!opts.imageOnly && !sys.fileTypes.includes(t.type)) throw bad(`${t.type} files aren't allowed. Allowed: ${sys.fileTypes.join(', ')}.`);
  if (opts.imageOnly && !['JPG', 'PNG'].includes(t.type)) throw bad('Choose a JPG or PNG image for the photo.');
  return t;
}

// Writes the file first, then the metadata row inside the caller's transaction. If the transaction later
// rolls back, the caller removes the written file (see cleanupOnError) so no orphan files remain.
export async function storeFile(db: Db, buf: Buffer, originalName: string, owner: { module: 'hr' | 'fleet'; id: string }, userId: string, purpose: 'document' | 'photo' = 'document') {
  const t = validateFile(buf, originalName, { imageOnly: purpose === 'photo' });
  const id = crypto.randomUUID();
  const d = new Date();
  const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${id}`;
  const full = path.join(env.filesDir, key);
  await fsp.mkdir(path.dirname(full), { recursive: true });
  await fsp.writeFile(full, buf, { mode: 0o640 });
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  const safeName = path.basename(originalName || 'document').replace(/[^\w.\- ()]/g, '_').slice(0, 150);
  await db.query(
    `INSERT INTO files (id, storage_key, original_name, mime, size_bytes, sha256, owner_module, owner_id, purpose, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, key, safeName, t.mime, buf.length, sha256, owner.module, owner.id, purpose, userId],
  );
  return { id, key, name: safeName, mime: t.mime, size: buf.length, full };
}

export async function removeStored(full?: string) {
  if (full) await fsp.unlink(full).catch(() => {});
}

export function openFile(storageKey: string) {
  const full = path.join(env.filesDir, storageKey);
  if (!full.startsWith(env.filesDir)) throw bad('Invalid file key');
  return fs.createReadStream(full);
}

export async function storageHealth() {
  try {
    await fsp.mkdir(env.filesDir, { recursive: true });
    const probe = path.join(env.filesDir, '.health');
    await fsp.writeFile(probe, String(Date.now()));
    await fsp.unlink(probe);
    const st = await fsp.statfs(env.filesDir).catch(() => null as any);
    return { ok: true, dir: env.filesDir, freeGB: st ? +(st.bavail * st.bsize / 1e9).toFixed(1) : null };
  } catch (e) {
    return { ok: false, dir: env.filesDir, error: (e as Error).message };
  }
}

export const sizeLabel = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
