// Append-only audit trail (§4.1): every create / update / approval / status change / upload / view / configuration change.
import { Db, pool } from './db.js';
import { ROLES, isoToDmy } from '@adroit/core/src/core/shared.js';

export type Actor = { id: string; name: string; role: string; scope?: string | null; ip?: string };

export async function audit(db: Db | null, actor: Actor | null, action: string, entity: string, record: string | null, detail: string, before?: any, after?: any) {
  await (db || pool).query(
    `INSERT INTO audit_events (user_id, user_name, role, action, entity, record, detail, before, after, ip)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [actor?.id || null, actor?.name || 'System', actor ? (ROLES as any)[actor.role]?.label || actor.role : 'System', action, entity, record, detail,
      before === undefined ? null : JSON.stringify(before), after === undefined ? null : JSON.stringify(after), actor?.ip || null],
  );
}

// dates are written dd/mm/yyyy like everywhere else
const show = (v: any) => (v == null || v === '' ? '—' : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? isoToDmy(v) : v);
// "field a → b; field c → d" for the fields that changed
export function diffText(before: any, after: any, labels: Record<string, string>) {
  return Object.keys(labels)
    .filter((k) => before && after && after[k] !== undefined && String(before[k] ?? '') !== String(after[k] ?? ''))
    .map((k) => `${labels[k]} ${show(before[k])} → ${show(after[k])}`)
    .join('; ');
}
