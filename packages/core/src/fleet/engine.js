import { fmt, daysUntil, officerFor } from '../core/shared.js';
import { DOC_TYPES, CATEGORIES, COMPANIES, LOCATIONS, DEPARTMENTS, fleetExpiryRows as expiryRows, missingDocs, assetCompliance } from './data.js';

// Rule-based stand-in for the Fleet AI assistant. It answers only from fleet records
// and always lists the records it used, so each answer can be checked.
const TYPE_WORDS = [
  ['Vehicle Registration', /registration|mulkiya|licen[cs]e/],
  ['Motor Insurance', /insurance|policy|policies/],
  ['Safety Certificate', /safety/],
  ['Inspection / Test Certificate', /inspection|test cert|load test|third.?party/],
  ['Other Permit', /permit/],
];
const CAT_WORDS = [
  ['Heavy Machine / Equipment', /machine|equipment|forklift|loader|crane|telehandler|bobcat/],
  ['Heavy Vehicle', /heavy vehicle|truck|lorr|tipper|tractor|trailer head/],
  ['Light Vehicle', /light vehicle|pickup|pick-up|\bcars?\b|\bvans?\b|sedan|\bbus(es)?\b/],
  ['Trailer', /trailer/],
  ['Other Company Vehicle', /other company/],
];
const BODY_WORDS = ['forklift', 'wheel loader', 'telehandler', 'skid-steer', 'mobile crane', 'hiab', 'tipper', 'tractor head', 'flatbed', 'lowbed', 'pickup', 'van', 'sedan', 'staff bus', 'suv'];

const typesIn = (t) => TYPE_WORDS.filter(([, re]) => re.test(t)).map(([k]) => k);
const catIn = (t) => (CAT_WORDS.find(([, re]) => re.test(t)) || [])[0];
const bodyIn = (t) => BODY_WORDS.find((b) => t.includes(b));
function windowIn(t) {
  const m = t.match(/(\d+)\s*(day|week|month)/);
  if (m) return +m[1] * (m[2] === 'week' ? 7 : m[2] === 'month' ? 30 : 1);
  if (/this week/.test(t)) return 7;
  if (/this month|next month|30 days/.test(t)) return 30;
  if (/quarter/.test(t)) return 90;
  return 60;
}
function findAsset(state, t) {
  const m = t.match(/vh[\s-]?(\d{1,4})|(?:vehicle|asset|fleet no\.?|machine)\s*#?\s*(\d{1,4})\b/);
  if (m) return state.assets.find((a) => a.id === `VH-${(m[1] || m[2]).padStart(4, '0')}`);
  const plate = state.assets.find((a) => a.plate && t.includes(a.plate.toLowerCase()));
  return plate || null;
}
const companyIn = (t) => COMPANIES.find((c) => (c.includes('Gateway') && /gateway/.test(t)) || (/general trading/.test(t) && c.includes('General Trading')) || (/technical services/.test(t) && c.includes('Technical Services')));
const locIn = (t) => LOCATIONS.find((l) => t.includes(l.toLowerCase()));
const row = (a, cols) => ({ asset: a, cols });
const PLURAL = { 'Heavy Vehicle': 'heavy vehicles', 'Light Vehicle': 'light vehicles', Trailer: 'trailers', 'Heavy Machine / Equipment': 'heavy machines / equipment', 'Other Company Vehicle': 'other company vehicles' };
const desc = (a) => `${a.make} ${a.model}`;

export function answer(state, raw) {
  const t = raw.toLowerCase().trim();
  const A = state.assets;
  const types = typesIn(t);
  const cat = catIn(t);
  const body = bodyIn(t);
  const inScope = (a) => (!cat || a.category === cat) && (!body || a.body.toLowerCase().includes(body));

  // 1. a specific asset
  const one = findAsset(state, t);
  if (one) {
    const docs = one.docs.filter((d) => !types.length || types.includes(d.type));
    if (types.length || /copy|document|scan|certificate/.test(t)) {
      return { text: `${one.id} · ${desc(one)} (${one.plate || one.body}), registered to ${one.company}. ${docs.length === 1 ? `Here is the ${docs[0].name.toLowerCase()}.` : `${docs.length} documents on file.`}`, docs: docs.map((d) => ({ asset: one, doc: d })) };
    }
    const c = assetCompliance(state.orig ? state.orig(one.id) : one);
    const soon = one.docs.filter((d) => daysUntil(d.expiry) <= 60);
    return {
      text: `${one.id} is a ${one.year} ${desc(one)} (${one.body}), ${one.plate || 'not road-registered'}, registered to ${one.company}. ${one.department}, currently at ${one.location}, status ${one.status}. Document compliance: ${c.label}.${soon.length ? ` Attention: ${soon.map((d) => `${d.name} ${daysUntil(d.expiry) < 0 ? 'expired' : 'expires'} ${fmt(d.expiry)}`).join('; ')}.` : ''}`,
      docs: one.docs.map((d) => ({ asset: one, doc: d })),
    };
  }

  // 2. missing documents
  if (/missing|without|no (scan|copy)|not recorded|incomplete/.test(t)) {
    const list = [];
    A.filter(inScope).forEach((a) => missingDocs(a).forEach((m) => { if (state.see && !state.see(m.type)) return; if (!types.length || types.includes(m.type)) list.push(row(a, [m.type, m.recorded ? 'No scanned copy' : 'Not recorded'])); }));
    return { text: list.length ? `${list.length} missing document${list.length > 1 ? 's' : ''}${cat ? ` for ${PLURAL[cat]}` : ''} across ${new Set(list.map((r) => r.asset.id)).size} asset${list.length > 1 ? 's' : ''}.` : `No missing documents${cat ? ` for ${PLURAL[cat]}` : ''}.`, rows: list, head: ['Asset', 'Document', 'Problem'], link: ['#fleet-documents.missing', 'Open missing documents'] };
  }

  // 3. summary
  if (/summar|attention|overview|brief|action/.test(t) && !types.length) {
    const exp = expiryRows(A, 0);
    const urgent = expiryRows(A, 30).filter((r) => r.d >= 0);
    const due = expiryRows(A, 60).filter((r) => r.d > 30);
    const miss = A.filter((a) => missingDocs(a).some((m) => !state.see || state.see(m.type)));
    const prog = [];
    A.forEach((a) => a.docs.forEach((d) => d.renewal && prog.push(d)));
    const noAction = [...exp, ...urgent].filter((r) => !r.doc.renewal);
    const by = (id) => [...exp, ...urgent, ...due].filter((r) => officerFor(r.doc.type).role === id).length;
    return {
      text: 'Fleet document actions requiring attention:',
      bullets: [
        `${exp.length} document${exp.length !== 1 ? 's' : ''} already expired: ${exp.map((r) => `${r.asset.id} ${r.doc.name}`).join(', ') || 'none'}.`,
        `${urgent.length} expire within 30 days and ${due.length} more within 60 days.`,
        `${noAction.length} expired or urgent document${noAction.length !== 1 ? 's have' : ' has'} no renewal action recorded yet.`,
        `${prog.length} renewal${prog.length !== 1 ? 's are' : ' is'} in progress.`,
        `${miss.length} asset${miss.length !== 1 ? 's have' : ' has'} missing documents or scans.`,
        `By officer role (next 60 days): Fleet / Transport ${by('fleet')}, Insurance ${by('insurance')}.`,
      ],
      rows: noAction.map((r) => row(r.asset, [r.doc.name, fmt(r.doc.expiry), 'No action recorded'])), head: ['Asset', 'Document', 'Expiry', 'Tracking'],
    };
  }

  // 4. expiry
  if (/expir|renew|due|valid|lapse/.test(t) || types.length) {
    const days = /expired|lapsed/.test(t) && !/expir(e|ing|es)\b/.test(t) ? 0 : windowIn(t);
    const tt = types.length ? types : DOC_TYPES;
    const co = companyIn(t);
    const rows = expiryRows(A, days, tt).filter((r) => inScope(r.asset) && (!co || r.asset.company === co));
    const assets = new Set(rows.map((r) => r.asset.id)).size;
    return {
      text: `${rows.length} ${tt.length === DOC_TYPES.length ? 'document' : tt.map((x) => x.toLowerCase()).join(' / ')} record${rows.length !== 1 ? 's' : ''} ${days === 0 ? 'already expired' : `expired or expiring within ${days} days`}${cat ? ` for ${PLURAL[cat]}` : ''}${body ? ` (${body})` : ''}${co ? ` under ${co}` : ''}, covering ${assets} asset${assets !== 1 ? 's' : ''}.`,
      rows: rows.map((r) => row(r.asset, [r.doc.name, fmt(r.doc.expiry), r.d < 0 ? `expired ${-r.d}d ago` : `${r.d} days`, r.doc.renewal ? r.doc.renewal.status : 'Open'])),
      head: ['Asset', 'Document', 'Expiry', 'Remaining', 'Tracking'], link: ['#fleet-documents.expiry', 'Open Expiry Centre'],
    };
  }

  // 5. registered company / location / status / category lists
  const co = companyIn(t);
  const loc = locIn(t);
  const dept = co ? null : DEPARTMENTS.find((d) => t.includes(d.toLowerCase().replace(' department', '')));
  const status = /under repair|repair/.test(t) ? 'Under Repair' : /standby|idle/.test(t) ? 'Standby' : /off.?road/.test(t) ? 'Off-road' : null;
  if (co || loc || dept || status || cat || body || /how many|list|show|all|count/.test(t)) {
    const list = A.filter((a) => inScope(a) && (!co || a.company === co) && (!loc || a.location === loc) && (!dept || a.department === dept) && (!status || a.status === status));
    if (!co && !loc && !dept && !status && !cat && !body) {
      return { text: `${A.length} assets in the fleet:`, bullets: CATEGORIES.map((c) => `${c}: ${A.filter((a) => a.category === c).length}`) };
    }
    return {
      text: `${list.length} ${body ? body + (list.length !== 1 ? 's' : '') : cat ? (list.length !== 1 ? PLURAL[cat] : cat.toLowerCase()) : 'asset' + (list.length !== 1 ? 's' : '')}${co ? ` registered under ${co}` : ''}${loc ? ` at ${loc}` : ''}${dept ? ` in ${dept}` : ''}${status ? ` with status ${status}` : ''}.`,
      rows: list.map((a) => row(a, [a.category.replace(' / Equipment', ''), a.plate || '—', `${a.location}`, assetCompliance(state.orig ? state.orig(a.id) : a).label])), head: ['Asset', 'Category', 'Plate', 'Location', 'Documents'],
    };
  }

  return { text: "I couldn't match that to fleet records. I can answer questions about document expiries, missing documents, individual vehicles, registered companies, locations and categories. Try one of the suggestions below." };
}

export const SUGGESTIONS = [
  'Show all heavy vehicles whose insurance or registration expires within the next 60 days',
  'Find the insurance copy for vehicle VH-0108',
  'Which safety certificates expire this month?',
  'Show all vehicles registered under Gateway Gulf Transport',
  'List heavy machines with missing documents',
  'Summarize fleet document actions requiring attention',
  'How many forklifts are at Aweer?',
  'Which vehicles are under repair?',
];
