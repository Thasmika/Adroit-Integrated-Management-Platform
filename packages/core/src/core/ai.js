// Cross-module AI assistance (§12). The assistant only ever receives the records the signed-in user may see,
// answers from those records, and never writes. Replace answerAll() with the real AI service call later;
// keep the same response shape.
import { answer as hrAnswer } from '../hr/engine.js';
import { answer as fleetAnswer } from '../fleet/engine.js';
import { scopeEmployees, scopeAssets, visibleDocs, canModule, canSeeDoc } from './access.js';
import { buildAttention, isAttention, leaveActions } from './attention.js';
import { fmt, docTypes, ROLES } from './shared.js';

const FLEET_WORDS = /vehicle|\bvh[\s-]?\d|fleet|truck|machine|forklift|trailer|registration|mulkiya|motor insurance|safety cert|inspection|permit|plate|equipment|crane|pickup|gateway|loader/;
const HR_WORDS = /\bhr\b|employee|\bemp\b|emp\s?\d|staff|visa|emirates|\beid\b|passport|leave|vacation|rejoin|health insurance|nationality|headcount|annual|sick/;

export function scoped(state, u) {
  const employees = scopeEmployees(u, state.employees).map((e) => ({ ...e, docs: visibleDocs(u, e.docs) }));
  const ids = new Set(employees.map((e) => e.id));
  const orig = (id) => state.assets.find((a) => a.id === id);
  return { employees, leaves: state.leaves.filter((l) => ids.has(l.empId)), assets: scopeAssets(u, state.assets).map((a) => ({ ...a, docs: visibleDocs(u, a.docs) })), see: (t) => canSeeDoc(u, t), orig };
}

export function answerAll(state, u, q) {
  const t = q.toLowerCase();
  const hr = canModule(u, 'hr');
  const fl = canModule(u, 'fleet');
  const data = scoped(state, u);
  const tag = (m, r) => ({ ...r, module: m });

  // open renewal actions for an officer (§10.1)
  const officer = state.config.users.find((x) => t.includes(x.name.toLowerCase()) || t.includes(x.name.split(' ')[0].toLowerCase() + ' '))
    || (/\b(my|me|mine)\b/.test(t) ? u : null);
  if (officer && /action|renewal|assigned|open|pending/.test(t)) {
    const items = buildAttention(state, u, 60).filter((i) => isAttention(i) && i.officer.id === officer.id);
    return {
      module: 'mixed',
      text: `${items.length} open renewal action${items.length !== 1 ? 's are' : ' is'} assigned to ${officer.id === u.id ? 'you' : officer.name}${hr && fl ? ' across both modules' : ''}.`,
      mixed: items.sort((a, b) => (a.kind === 'missing') - (b.kind === 'missing') || (a.d ?? 0) - (b.d ?? 0)).map((i) => ({ module: i.module, id: i.ownerId, name: i.ownerName, link: i.link, cols: [i.doc?.name || i.type, i.doc ? fmt(i.doc.expiry) : i.st.label, i.action] })),
      head: ['Record', 'Document', 'Expiry', 'Action'], link: ['#attention.mine', 'Open in Attention Centre'],
    };
  }

  // documents the role may not see are refused, not answered with an empty list (§4.1)
  const TYPE_WORDS = [['Passport', /passport/], ['Employment Visa', /\bvisas?\b/], ['Emirates ID', /emirates|\beid\b/], ['Health Insurance', /health insurance|insurance card|medical card/], ['Vehicle Registration', /registration|mulkiya/], ['Motor Insurance', /motor insurance|insurance copy|insurance (or|and) registration|policy/], ['Safety Certificate', /safety/], ['Inspection / Test Certificate', /inspection|test cert/], ['Other Permit', /permit/]];
  const asked = TYPE_WORDS.filter(([, re]) => re.test(t)).map(([k]) => k).filter((k) => canModule(u, docTypes().find((d) => d.key === k)?.module));
  const blocked = asked.filter((k) => !canSeeDoc(u, k));
  const docQuestion = /document|expir|renew|missing|scan|copy|certificate|card|\bdue\b/.test(t) || asked.length > 0;
  if (ROLES[u.role].noDocs && docQuestion) return { module: 'none', text: `As ${ROLES[u.role].label} you don't have access to employee documents or their expiry details. HR and PRO handle these. I can help with leave, rejoining and who is in your department.` };
  if (blocked.length && blocked.length === asked.length) return { module: 'none', text: `Your role (${ROLES[u.role].label}) doesn't include ${blocked.join(' / ')} records, so I can't answer that.` };

  const hrHit = HR_WORDS.test(t);
  const flHit = FLEET_WORDS.test(t);

  // HR and/or fleet summary
  if (/summar|attention|overview|brief/.test(t)) {
    const parts = [];
    if (hr && (hrHit || !flHit)) parts.push({ title: 'Employee Management', bullets: hrAnswer(data, 'summarize hr actions requiring attention this week').bullets });
    if (fl && (flHit || !hrHit)) parts.push({ title: 'Vehicle & Equipment', bullets: fleetAnswer(data, 'summarize fleet document actions requiring attention').bullets });
    if (parts.length) return { module: 'mixed', text: `Actions requiring attention this week${parts.length > 1 ? ' across HR and fleet' : ''}:`, sections: parts };
  }

  if (hrHit && !flHit) return hr ? tag('hr', hrAnswer(data, q)) : { module: 'none', text: "Your role doesn't include employee records, so I can't answer questions about employees, HR documents or leave." };
  if (flHit && !hrHit) return fl ? tag('fleet', fleetAnswer(data, q)) : { module: 'none', text: "Your role doesn't include fleet records, so I can't answer questions about vehicles or machines." };
  // ambiguous: try the permitted modules in turn
  const tries = [hr && ['hr', hrAnswer], fl && ['fleet', fleetAnswer]].filter(Boolean);
  for (const [m, fn] of tries) {
    const a = fn(data, q);
    if (!/couldn't match/.test(a.text)) return tag(m, a);
  }
  return { module: 'none', text: `I couldn't match that to ${hr && fl ? 'employee or fleet' : hr ? 'employee' : 'fleet'} records. Try one of the suggestions below.` };
}

export function suggestions(u) {
  const hr = canModule(u, 'hr');
  const fl = canModule(u, 'fleet');
  const s = [];
  if (hr && fl) s.push('Summarize HR and fleet document actions requiring attention this week');
  if (hr && u.role !== 'depthead') s.push('Show visas expiring in the next 60 days', 'Find the insurance card for employee 0115', 'List employees with missing passport copies');
  if (hr) s.push('Who is currently on annual leave?', 'Who has not rejoined after leave?');
  if (fl) s.push('Find the insurance copy for vehicle VH-0108', 'Show all heavy vehicles whose insurance or registration expires within the next 60 days', 'Which safety certificates expire this month?', 'List heavy machines with missing documents');
  if (u.role !== 'depthead' && (hr || fl)) s.push(['pro', 'insurance', 'fleet', 'hr'].includes(u.role) ? 'Show open renewal actions assigned to me' : 'Show open renewal actions assigned to Imran Qureshi');
  if (!hr && !fl) return [];
  return s;
}
