import { fmt, daysUntil, officerFor, OPERATING, docStatus } from '../core/shared.js';
import { DEPARTMENTS, hrExpiryRows as expiryRows, hrMissing } from './data.js';
const DOC_TYPES = ['Passport', 'Employment Visa', 'Emirates ID', 'Health Insurance'];
const SPONSORS = [OPERATING];

// Rule-based stand-in for the HR AI assistant. It answers only from HR records
// and always shows the rows it used, so every answer can be checked.
const TYPE_WORDS = [
  ['Employment Visa', /\bvisas?\b|residen/],
  ['Emirates ID', /emirates\s*id|\beid\b|\bid cards?\b/],
  ['Passport', /passports?/],
  ['Health Insurance', /insurance|medical card|health card/],
];

function typesIn(t) { return TYPE_WORDS.filter(([, re]) => re.test(t)).map(([k]) => k); }
function windowIn(t) {
  let m = t.match(/(\d+)\s*(day|week|month)/);
  if (m) return +m[1] * (m[2] === 'week' ? 7 : m[2] === 'month' ? 30 : 1);
  if (/this week|7 days/.test(t)) return 7;
  if (/this month/.test(t)) return 30;
  if (/next month/.test(t)) return 60;
  if (/quarter/.test(t)) return 90;
  return 60;
}
function findEmp(state, t) {
  const m = t.match(/(?:emp(?:loyee)?\s*(?:no\.?|number|#)?\s*)(\d{1,4})\b/);
  if (m) return state.employees.find((e) => e.id === `EMP ${m[1].padStart(4, '0')}`);
  const byName = state.employees.filter((e) => t.includes(e.name.toLowerCase()));
  if (byName.length) return byName[0];
  return null;
}
const DEPT_ALIASES = [
  ['transport & trading', 'Transport & Trading Department'], ['transport and trading', 'Transport & Trading Department'],
  ['aweer store', 'Aweer Store'], ['aweer branch', 'Aweer Branch'], ['technical workshop', 'Technical Workshop'],
  ['administrat', 'Administrative Department'], ['admin', 'Administrative Department'], ['trading', 'Trading Department'],
  ['transport', 'Transport Department'], ['satwa', 'Satwa Branch'], ['alboom', 'Alboom Branch'], ['al boom', 'Alboom Branch'],
  ['ajman', 'Ajman Branch'], ['workshop', 'Technical Workshop'], ['aweer', 'Aweer Branch'],
];
const deptIn = (t) => DEPT_ALIASES.find(([a]) => t.includes(a))?.[1];

const empRow = (e, extra) => ({ emp: e, cols: extra });

export function answer(state, raw) {
  const t = raw.toLowerCase().trim();
  const emps = state.employees;
  const emp = (id) => emps.find((e) => e.id === id);
  const types = typesIn(t);

  // 1. document of a specific employee
  const who = findEmp(state, t);
  if (who && (types.length || /document|card|copy|scan/.test(t))) {
    const docs = who.docs.filter((d) => !types.length || types.includes(d.type));
    return {
      text: `${who.name} (${who.id}), ${who.designation}, ${who.department}. ${docs.length === 1 ? `Here is the ${docs[0].type.toLowerCase()} record.` : `${docs.length} documents on file.`}`,
      docs: docs.map((d) => ({ emp: who, doc: d })),
    };
  }
  if (who) {
    const onL = state.leaves.find((l) => l.empId === who.id && ['On Leave', 'Awaiting Rejoining'].includes(l.status));
    const attention = who.docs.filter((d) => d.expiry && daysUntil(d.expiry) <= 60);
    return {
      text: `${who.name} (${who.id}) is ${who.designation} in ${who.department}, ${who.nationality}, joined ${fmt(who.joined)}. Visa issued by ${who.sponsor}. ${onL ? `Currently ${onL.status.toLowerCase()} (${onL.type}, until ${fmt(onL.end)}).` : 'Currently on duty.'} ${attention.length ? `Needs attention: ${attention.map((d) => `${d.type} expires ${fmt(d.expiry)}`).join('; ')}.` : 'No documents expire in the next 60 days.'}`,
      rows: [empRow(who, [who.designation, who.department])], head: ['Employee', 'Designation', 'Department'],
    };
  }

  // 2. missing documents
  if (/missing|without|no (scan|copy)|not uploaded/.test(t)) {
    const list = [];
    emps.forEach((e) => hrMissing(e).forEach((m) => { if (state.see && !state.see(m.type)) return; if ((types.length ? types : DOC_TYPES).includes(m.type)) list.push(empRow(e, [m.type, m.recorded ? 'No scanned copy' : 'Not recorded'])); }));
    return { text: list.length ? `${list.length} ${types.length ? types.join(' / ').toLowerCase() : 'required document'} record${list.length > 1 ? 's are' : ' is'} missing a scanned copy or not recorded.` : 'Every matching record is complete.', rows: list, head: ['Employee', 'Document', 'Problem'], link: ['#hr-documents.missing', 'Open missing copies'] };
  }

  // 3. leave questions
  if (/leave|vacation|away|holiday|rejoin|return/.test(t) && !/expir/.test(t)) {
    if (/rejoin|return|back/.test(t)) {
      const aw = state.leaves.filter((l) => l.status === 'Awaiting Rejoining');
      const soon = state.leaves.filter((l) => l.status === 'On Leave' && daysUntil(l.end) <= 14);
      return {
        text: `${aw.length} employee${aw.length !== 1 ? 's have' : ' has'} finished leave without a rejoining record. ${soon.length} more ${soon.length !== 1 ? 'are' : 'is'} due back within 14 days.`,
        rows: [...aw.map((l) => empRow(emp(l.empId), ['Rejoining not recorded', fmt(l.end)])), ...soon.map((l) => empRow(emp(l.empId), ['Due back', fmt(l.end)]))],
        head: ['Employee', 'Status', 'Leave ends'], link: ['#hr-leave.away', 'Open rejoining list'],
      };
    }
    if (/pending|request|approv/.test(t)) {
      const p = state.leaves.filter((l) => l.status.startsWith('Pending'));
      return { text: `${p.length} leave request${p.length !== 1 ? 's are' : ' is'} waiting.`, rows: p.map((l) => empRow(emp(l.empId), [l.type, l.status])), head: ['Employee', 'Type', 'Stage'], link: ['#hr-leave.queue', 'Review requests'] };
    }
    const lt = /annual/.test(t) ? 'Annual Leave' : /sick/.test(t) ? 'Sick Leave' : /emergency/.test(t) ? 'Emergency Leave' : null;
    const dept = deptIn(t);
    const on = state.leaves.filter((l) => l.status === 'On Leave' && (!lt || l.type === lt) && (!dept || emp(l.empId).department === dept));
    return {
      text: `${on.length} employee${on.length !== 1 ? 's are' : ' is'} currently on ${lt ? lt.toLowerCase() : 'leave'}${dept ? ` in ${dept}` : ''}.`,
      rows: on.map((l) => empRow(emp(l.empId), [l.type, fmt(l.end)])), head: ['Employee', 'Leave type', 'Until'], link: ['#hr-leave.away', 'Open leave list'],
    };
  }

  // 4. weekly summary
  if (/summar|attention|this week|today|overview|brief/.test(t)) {
    const exp = expiryRows(emps, 0);
    const wk = expiryRows(emps, 7).filter((r) => r.d >= 0);
    const m30 = expiryRows(emps, 30).filter((r) => r.d > 7);
    const p = state.leaves.filter((l) => l.status.startsWith('Pending'));
    const aw = state.leaves.filter((l) => l.status === 'Awaiting Rejoining');
    const starting = state.leaves.filter((l) => l.status === 'Approved' && daysUntil(l.start) <= 7);
    return {
      text: 'HR actions requiring attention this week:',
      bullets: [
        `${exp.length} document${exp.length !== 1 ? 's' : ''} already expired: ${exp.map((r) => `${r.emp.name} (${r.doc.type})`).slice(0, 4).join(', ') || 'none'}${exp.length > 4 ? '…' : ''}.`,
        `${wk.length} document${wk.length !== 1 ? 's' : ''} expire within 7 days and ${m30.length} more within 30 days. PRO: ${[...wk, ...m30].filter((r) => officerFor(r.doc.type).role === 'pro').length}, HR: ${[...wk, ...m30].filter((r) => officerFor(r.doc.type).role === 'hr').length}, Insurance: ${[...wk, ...m30].filter((r) => officerFor(r.doc.type).role === 'insurance').length}.`,
        `${p.length} leave request${p.length !== 1 ? 's' : ''} waiting for HR review or approval.`,
        `${aw.length} employee${aw.length !== 1 ? 's' : ''} past leave end date without a rejoining record.`,
        `${starting.length} approved leave${starting.length !== 1 ? 's' : ''} starting in the next 7 days.`,
      ],
    };
  }

  // 6. headcount
  if (/how many|count|headcount|number of|staff in|employees in/.test(t) && !/expir|renew|due/.test(t)) {
    const dept = deptIn(t);
    const nat = [...new Set(emps.map((e) => e.nationality))].find((n) => t.includes(n.toLowerCase().split(' ')[0]));
    const list = emps.filter((e) => (!dept || e.department === dept) && (!nat || e.nationality === nat) && (!/group/.test(t) || e.sponsor !== SPONSORS[0]));
    if (!dept && !nat && !/group/.test(t)) {
      return { text: `${emps.length} employees in total. By department:`, bullets: DEPARTMENTS.map((d) => `${d}: ${emps.filter((e) => e.department === d).length}`) };
    }
    return { text: `${list.length} ${nat ? nat + ' ' : ''}employee${list.length !== 1 ? 's' : ''}${dept ? ` in ${dept}` : ''}${/group/.test(t) ? ' on group-company visas' : ''}.`, rows: list.map((e) => empRow(e, [e.designation, e.department.replace(' Department', '')])), head: ['Employee', 'Designation', 'Department'] };
  }

  // 5. expiry questions (default when a document type is named)
  if (/expir|renew|due|valid|lapse/.test(t) || types.length) {
    const days = /expired|lapsed/.test(t) && !/expir(e|ing)/.test(t) ? 0 : windowIn(t);
    const tt = types.length ? types : /all|document/.test(t) ? DOC_TYPES : ['Employment Visa', 'Emirates ID', 'Passport'];
    const dept = deptIn(t);
    const group = /group|sister/.test(t);
    let rows = expiryRows(emps, days, tt).filter((r) => (!dept || r.emp.department === dept) && (!group || r.emp.sponsor !== SPONSORS[0]));
    const people = new Set(rows.map((r) => r.emp.id)).size;
    return {
      text: `${rows.length} ${tt.map((x) => x.replace('Employment ', '').toLowerCase()).join(' / ')} record${rows.length !== 1 ? 's' : ''} ${days === 0 ? 'already expired' : `expired or expiring within ${days} days`}${dept ? ` in ${dept}` : ''}${group ? ' for group-company visas' : ''}, covering ${people} employee${people !== 1 ? 's' : ''}.`,
      rows: rows.map((r) => empRow(r.emp, [r.doc.type, fmt(r.doc.expiry), r.d < 0 ? `expired ${-r.d}d ago` : `${r.d} days`, r.doc.renewal ? r.doc.renewal.status : 'Open'])),
      head: ['Employee', 'Document', 'Expiry', 'Remaining', 'Action'], link: ['#hr-documents.expiry', 'Open Expiry Centre'],
    };
  }

  return {
    text: "I couldn't match that to HR records. I can answer questions about document expiries, scanned copies, leave and rejoining, headcount, and individual employees. Try one of the suggestions below.",
  };
}

export const SUGGESTIONS = [
  'Show visas expiring in the next 60 days',
  'Find the insurance card for employee 0115',
  'Who is currently on annual leave?',
  'List employees with missing passport copies',
  'Summarize HR actions requiring attention this week',
  'Emirates IDs expiring in 30 days in Aweer Branch',
  'Who has not rejoined after leave?',
  'How many employees are on group company visas?',
];
