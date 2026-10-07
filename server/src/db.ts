import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './env.js';

// DATE columns come back as 'YYYY-MM-DD' strings, not JS Dates in the server time zone
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(20, (v) => Number(v));

export const pool = new pg.Pool({ connectionString: env.databaseUrl, max: 15 });
export type Db = pg.Pool | pg.PoolClient;

export async function q<T = any>(sql: string, params: any[] = [], db: Db = pool): Promise<T[]> {
  const r = await db.query(sql, params);
  return r.rows as T[];
}
export async function one<T = any>(sql: string, params: any[] = [], db: Db = pool): Promise<T | null> {
  const r = await db.query(sql, params);
  return (r.rows[0] as T) ?? null;
}

// Every multi-step business write runs in one transaction so records, files and audit stay consistent (§9 integrity)
export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

function migrationsDir() {
  const candidates = [
    process.env.MIGRATIONS_DIR,
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations'),
    path.resolve(process.cwd(), 'migrations'),
    path.resolve(process.cwd(), 'server/migrations'),
  ].filter(Boolean) as string[];
  const dir = candidates.find((d) => fs.existsSync(d));
  if (!dir) throw new Error('migrations directory not found');
  return dir;
}

// Ordered, idempotent SQL migrations guarded by an advisory lock (safe with several app instances)
export async function migrate(log: (m: string) => void = console.log) {
  const c = await pool.connect();
  try {
    await c.query('SELECT pg_advisory_lock(424242)');
    await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const done = new Set((await c.query('SELECT version FROM schema_migrations')).rows.map((r) => r.version));
    const dir = migrationsDir();
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files) {
      if (done.has(f)) continue;
      log(`applying migration ${f}`);
      await c.query('BEGIN');
      try {
        await c.query(fs.readFileSync(path.join(dir, f), 'utf8'));
        await c.query('INSERT INTO schema_migrations (version) VALUES ($1)', [f]);
        await c.query('COMMIT');
      } catch (e) {
        await c.query('ROLLBACK');
        throw new Error(`migration ${f} failed: ${(e as Error).message}`);
      }
    }
    return files.length;
  } finally {
    await c.query('SELECT pg_advisory_unlock(424242)').catch(() => {});
    c.release();
  }
}
