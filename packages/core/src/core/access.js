// Role-based access (§4). Deny by default; each check names the module / action / scope.
import { ROLES, docCfg } from './shared.js';

const role = (u) => ROLES[u?.role] || { modules: [] };
export const canModule = (u, m) => role(u).modules.includes(m);
export const canAdmin = (u) => !!role(u).admin;
export const canAudit = (u) => !!role(u).audit;
export const readOnly = (u) => !!role(u).readOnly;

// which documents a user may discover / view
export function canSeeDoc(u, type) {
  const r = role(u);
  const m = docCfg(type).module;
  if (!canModule(u, m) || r.noDocs) return false;
  return !r.docTypes || r.docTypes.includes(type);
}
// which records a user may see
export function scopeEmployees(u, list) {
  if (!canModule(u, 'hr')) return [];
  const r = role(u);
  // Department heads see their own department; PRO / insurance see all employees but only their document types
  return r.scoped ? list.filter((e) => e.department === u.scope) : list;
}
export const scopeAssets = (u, list) => (canModule(u, 'fleet') ? list : []);
export const visibleDocs = (u, docs) => docs.filter((d) => canSeeDoc(u, d.type));

export function can(u, action, ctx = {}) {
  if (!u || readOnly(u) && action !== 'approveLeave') return false;
  if (u.role === 'sysadmin') return true;
  switch (action) {
    case 'editEmployee': return u.role === 'hr';
    case 'editAsset': return u.role === 'fleet';
    case 'uploadDoc': {
      const m = docCfg(ctx.type).module;
      if (!canSeeDoc(u, ctx.type)) return false;
      return (m === 'hr' && ['hr', 'pro', 'insurance'].includes(u.role)) || (m === 'fleet' && ['fleet', 'insurance'].includes(u.role));
    }
    case 'trackAction': return can(u, 'uploadDoc', ctx);
    case 'submitLeave': return ['hr', 'depthead'].includes(u.role);
    case 'reviewLeave': return u.role === 'hr';
    case 'approveLeave': return u.role === 'management';
    case 'rejoin': return ['hr', 'depthead'].includes(u.role);
    default: return false;
  }
}
