// In-memory copy of reference data and configuration, loaded from the database and pushed into the shared
// business rules (@adroit/core). Reloaded after every administrative change.
import { q, Db, pool } from './db.js';
import { setConfig } from '@adroit/core/src/core/shared.js';

export const SYSTEM_DEFAULTS = {
  maxFileMB: 10,
  fileTypes: ['PDF', 'JPG', 'PNG'],
  aiEnabled: true,
  retention: 'Pending management confirmation',
  inApp: true,
  email: false,
  escalation: true,
  digestDay: 'Sunday',
  alertsEnabled: false,       // switch on after officers are confirmed and attention lists verified (§16 step 14)
  passwordMinLength: 10,
};

export type Cfg = {
  companies: any[]; departments: any[]; locations: any[]; categories: any[];
  users: any[]; docTypes: any[]; templates: any[]; system: typeof SYSTEM_DEFAULTS;
};
let CFG: Cfg;

export const docTypeRow = (t: any) => ({
  key: t.key, module: t.module, short: t.short, expires: t.expires, required: t.required, requiredFor: t.required_for || [],
  urgent: t.urgent_days, due: t.due_days, monitor: t.monitor_days, officer: t.officer_user_id, sort: t.sort,
});

export async function loadConfig(db: Db = pool): Promise<Cfg> {
  const [companies, departments, locations, categories, users, docTypes, templates, sys] = await Promise.all([
    q('SELECT id, name, short, kind, active, mol_code AS "molCode" FROM companies ORDER BY kind DESC, name', [], db),
    q('SELECT id, name, active FROM departments ORDER BY id', [], db),
    q('SELECT id, name, active FROM locations ORDER BY id', [], db),
    q('SELECT name, active, sort FROM asset_categories ORDER BY sort, name', [], db),
    q('SELECT id, name, email, role, scope_department AS scope, active, must_change_password, last_login_at FROM users ORDER BY name', [], db),
    q('SELECT * FROM document_types ORDER BY sort, key', [], db),
    q('SELECT * FROM notification_templates ORDER BY id', [], db),
    q('SELECT key, value FROM system_config', [], db),
  ]);
  const system = { ...SYSTEM_DEFAULTS };
  sys.forEach((r: any) => { (system as any)[r.key] = r.value; });
  CFG = { companies, departments, locations, categories, users, docTypes: docTypes.map(docTypeRow), templates, system };
  setConfig(CFG as any);
  return CFG;
}
export const cfg = () => CFG;

// What a signed-in user receives: masters and doc types for everyone; full user list only for administrators
export function publicConfig(user: any) {
  const c = cfg();
  const admin = user?.role === 'sysadmin';
  return {
    companies: c.companies, departments: c.departments, locations: c.locations, categories: c.categories,
    docTypes: c.docTypes,
    users: admin ? c.users : c.users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name, role: u.role, scope: u.scope, active: u.active })),
    templates: admin ? c.templates : [],
    system: c.system,
  };
}
