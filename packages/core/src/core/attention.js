// Combined attention items across both modules (§5.1, §10, §11.3), already filtered to what the user may see.
import { docStatus, daysUntil, officerFor, actionStatus, requiredFor } from './shared.js';
import { canSeeDoc, scopeEmployees, scopeAssets, canModule } from './access.js';
import { hrMissing, empParam } from '../hr/data.js';
import { missingDocs, assetParam } from '../fleet/data.js';

export function buildAttention(state, u, horizon = 180) {
  const items = [];
  const emps = scopeEmployees(u, state.employees);
  const assets = scopeAssets(u, state.assets).filter((a) => !['Disposed', 'Inactive'].includes(a.status));
  const push = (o) => items.push(o);
  emps.forEach((e) => {
    e.docs.forEach((doc) => {
      if (!canSeeDoc(u, doc.type) || !doc.expiry) return;
      const d = daysUntil(doc.expiry);
      if (d > horizon) return;
      const st = docStatus(doc);
      push({ module: 'hr', kind: 'doc', owner: e, ownerId: e.id, ownerName: e.name, doc, type: doc.type, st, d, officer: officerFor(doc.type), action: actionStatus(doc), company: e.sponsor, department: e.department, location: e.location, link: `#hr-employee.${empParam(e.id)}` });
    });
    hrMissing(e).forEach((m) => { if (canSeeDoc(u, m.type)) push({ module: 'hr', kind: 'missing', owner: e, ownerId: e.id, ownerName: e.name, type: m.type, st: { key: 'missing', label: m.recorded ? 'No scan' : 'Not recorded' }, d: null, officer: officerFor(m.type), action: 'Open', company: e.sponsor, department: e.department, location: e.location, link: `#hr-employee.${empParam(e.id)}` }); });
  });
  assets.forEach((a) => {
    a.docs.forEach((doc) => {
      if (!canSeeDoc(u, doc.type) || !doc.expiry) return;
      const d = daysUntil(doc.expiry);
      if (d > horizon) return;
      push({ module: 'fleet', kind: 'doc', owner: a, ownerId: a.id, ownerName: `${a.make} ${a.model}`, doc, type: doc.type, st: docStatus(doc), d, officer: officerFor(doc.type), action: actionStatus(doc), company: a.company, department: a.department, location: a.location, link: `#fleet-vehicle.${assetParam(a.id)}` });
    });
    missingDocs(a).forEach((m) => { if (canSeeDoc(u, m.type)) push({ module: 'fleet', kind: 'missing', owner: a, ownerId: a.id, ownerName: `${a.make} ${a.model}`, type: m.type, st: { key: 'missing', label: m.recorded ? 'No scan' : 'Not recorded' }, d: null, officer: officerFor(m.type), action: 'Open', company: a.company, department: a.department, location: a.location, link: `#fleet-vehicle.${assetParam(a.id)}` }); });
  });
  return items;
}

export function leaveActions(state, u) {
  if (!canModule(u, 'hr')) return [];
  const ids = new Set(scopeEmployees(u, state.employees).map((e) => e.id));
  return state.leaves.filter((l) => ids.has(l.empId) && (l.status.startsWith('Pending') || l.status === 'Awaiting Rejoining'));
}

export const isAttention = (it) => it.kind === 'missing' || ['expired', 'critical', 'due'].includes(it.st.key);
