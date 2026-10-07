// Employee module sample data (fictional).
import { TODAY, iso, addDays, daysUntil, prng, deptLocation, DEPARTMENTS_INIT, COMPANIES_INIT, OPERATING, docStatus, docTypes, requiredFor } from '../core/shared.js';

export const DEPARTMENTS = DEPARTMENTS_INIT.map((d) => d.name);
export const LEAVE_TYPES = ['Annual Leave', 'Emergency Leave', 'Sick Leave'];
// 'On Notice' removed from the choices (Changes Report 01, item 5); older records keep their value until edited
export const HR_STATUSES = ['Active', 'Inactive', 'Resigned', 'Terminated'];
const INSURERS = ['Daman', 'AXA Gulf', 'Oman Insurance', 'Sukoon Insurance'];

const FIRST = {
  Indian: ['Rajesh', 'Anil', 'Suresh', 'Vinod', 'Pradeep', 'Ramesh', 'Sanjay', 'Deepak', 'Manoj', 'Arun', 'Priya', 'Lakshmi'],
  Pakistani: ['Imran', 'Asif', 'Tariq', 'Bilal', 'Usman', 'Kashif', 'Faisal', 'Naveed'],
  'Sri Lankan': ['Chaminda', 'Ruwan', 'Nuwan', 'Kasun', 'Tharindu', 'Dilshan', 'Nadeesha', 'Sanduni'],
  Filipino: ['Mark', 'John Paul', 'Jerome', 'Rowena', 'Maricel', 'Christian', 'Arnel'],
  Bangladeshi: ['Rahim', 'Karim', 'Shafiq', 'Mizanur', 'Habib', 'Jahid'],
  Nepali: ['Bikash', 'Suman', 'Ram Bahadur', 'Prakash', 'Dipendra'],
  Egyptian: ['Ahmed', 'Mohamed', 'Mahmoud', 'Hany', 'Sherif'],
  Jordanian: ['Khaled', 'Omar', 'Rami', 'Laith'],
};
const LAST = {
  Indian: ['Kumar', 'Nair', 'Menon', 'Sharma', 'Pillai', 'Reddy', 'Varghese', 'Iyer'],
  Pakistani: ['Khan', 'Qureshi', 'Malik', 'Butt', 'Chaudhry', 'Raza'],
  'Sri Lankan': ['Perera', 'Fernando', 'Silva', 'Jayasinghe', 'Wickramasinghe', 'Bandara'],
  Filipino: ['Santos', 'Reyes', 'Cruz', 'Garcia', 'Dela Cruz', 'Mendoza'],
  Bangladeshi: ['Hossain', 'Rahman', 'Islam', 'Uddin', 'Ahmed'],
  Nepali: ['Thapa', 'Gurung', 'Shrestha', 'Tamang', 'Rai'],
  Egyptian: ['Hassan', 'Ibrahim', 'Mostafa', 'Farouk'],
  Jordanian: ['Haddad', 'Nasser', 'Khoury', 'Saleh'],
};
const DESIG = {
  'Administrative Department': ['HR Officer', 'Accountant', 'Office Assistant', 'PRO', 'IT Manager', 'Secretary'],
  'Trading Department': ['Sales Executive', 'Sales Manager', 'Purchase Officer', 'Estimator'],
  'Transport Department': ['Heavy Driver', 'Light Driver', 'Transport Supervisor', 'Helper'],
  'Transport & Trading Department': ['Coordinator', 'Driver cum Salesman', 'Helper'],
  'Satwa Branch': ['Branch Manager', 'Salesman', 'Cashier', 'Storekeeper', 'Helper'],
  'Aweer Branch': ['Branch Manager', 'Salesman', 'Storekeeper', 'Labourer'],
  'Alboom Branch': ['Branch In-charge', 'Salesman', 'Labourer'],
  'Ajman Branch': ['Branch Manager', 'Salesman', 'Cashier', 'Labourer'],
  'Aweer Store': ['Store Supervisor', 'Storekeeper', 'Forklift Operator', 'Labourer'],
  'Technical Workshop': ['Workshop Foreman', 'Mechanic', 'Welder', 'Electrician', 'Helper'],
};
const NAT_W = [['Indian', 30], ['Pakistani', 16], ['Sri Lankan', 12], ['Filipino', 12], ['Bangladeshi', 12], ['Nepali', 9], ['Egyptian', 6], ['Jordanian', 3]];
// group health insurance renews on 31 Dec; use next year's if this year's is less than 30 days away
const yearEndDate = () => { const y = new Date(TODAY.getFullYear(), 11, 31); return daysUntil(iso(y)) < 30 ? new Date(TODAY.getFullYear() + 1, 11, 31) : y; };
const yearEnd = () => iso(yearEndDate());
const COUNTRY = { Indian: 'India', Pakistani: 'Pakistan', 'Sri Lankan': 'Sri Lanka', Filipino: 'Philippines', Bangladeshi: 'Bangladesh', Nepali: 'Nepal', Egyptian: 'Egypt', Jordanian: 'Jordan' };
const CYCLE = { Passport: 3650, 'Employment Visa': 730, 'Emirates ID': 730, 'Labour Card': 730, 'Health Insurance': 365 };
// demo employee codes (entered by HR in real use)
const codeFor = (desig) => (/driver|operator/i.test(desig) ? 'DRV' : /mechanic|technician|electrician|welder|fitter/i.test(desig) ? 'TEC' : /helper|labour|loader|cleaner|storekeeper|watchman/i.test(desig) ? 'LAB' : 'STF');

export function makeHr() {
  const { rnd, pick, digits } = prng(20260929);
  const nat = () => { let r = rnd() * 100; for (const [n, w] of NAT_W) { if ((r -= w) < 0) return n; } return 'Indian'; };
  const offset = (kind, i) => {
    const r = rnd();
    if (kind === 'Health Insurance') return i % 83 === 5 ? 18 + (i % 25) : daysUntil(yearEnd());
    const pp = kind === 'Passport';
    if (r < (pp ? 0.004 : 0.012)) return -Math.floor(rnd() * 40) - 1;
    if (r < (pp ? 0.016 : 0.045)) return Math.floor(rnd() * 60) + 1;
    return 61 + Math.floor(rnd() * (pp ? 3000 : 660));
  };
  const employees = [];
  for (let i = 0; i < 248; i++) {
    const n = nat();
    const dept = i === 114 ? 'Administrative Department' : DEPARTMENTS[i % DEPARTMENTS.length];
    const first = pick(FIRST[n]);
    const id = `EMP ${String(i + 1).padStart(4, '0')}`;
    const sponsor = rnd() < 0.72 ? OPERATING : pick(COMPANIES_INIT.slice(1)).name;
    const provider = pick(INSURERS);
    const docs = ['Passport', 'Employment Visa', 'Emirates ID', 'Health Insurance'].map((type) => {
      const off = offset(type, i);
      const expiry = addDays(TODAY, off);
      const issued = addDays(expiry, -CYCLE[type] + 1);
      const ref = type === 'Passport' ? `${pick(['N', 'P', 'M', 'K', 'U'])}${digits(7)}`
        : type === 'Emirates ID' ? `784-${1958 + Math.floor(rnd() * 45)}-${digits(7)}-${digits(1)}`
        : type === 'Employment Visa' ? `201/${2024 + Math.floor(rnd() * 2)}/${digits(7)}` : `GHI-${digits(8)}`;
      const noScan = rnd() < (type === 'Passport' ? 0.03 : 0.012);
      const prevExp = addDays(issued, -1);
      return {
        type, name: type, ref, issuer: type === 'Health Insurance' ? provider : type === 'Passport' ? `Govt. of ${COUNTRY[n]}` : 'ICP / GDRFA Dubai',
        issued: iso(issued), expiry: iso(expiry), renewal: null,
        file: noScan ? null : { name: `${id.replace(' ', '')}_${type.replace(/ /g, '_')}.pdf`, size: `${180 + Math.floor(rnd() * 900)} KB`, sample: true },
        history: type === 'Passport' ? [] : [{ ref: ref.slice(0, -3) + digits(3), issued: iso(addDays(prevExp, -CYCLE[type] + 1)), expiry: iso(prevExp), file: `${id.replace(' ', '')}_${type.replace(/ /g, '_')}_prev.pdf`, replacedOn: iso(addDays(issued, -5)) }],
      };
    });
    if (rnd() < 0.55) docs.push({ type: 'Qualification Certificate', name: 'Qualification Certificate', ref: `QC-${digits(5)}`, issuer: '', issued: '', expiry: '', renewal: null, history: [], file: { name: `${id.replace(' ', '')}_Qualification.pdf`, size: '410 KB', sample: true } });
    const joined = iso(addDays(TODAY, -Math.floor(rnd() * 5400) - 60));
    employees.push({
      id, code: '', molId: '', name: `${first} ${pick(LAST[n])}`, photo: null,
      gender: ['Priya', 'Lakshmi', 'Nadeesha', 'Sanduni', 'Rowena', 'Maricel'].includes(first) ? 'Female' : 'Male',
      nationality: n, dob: iso(addDays(TODAY, -Math.floor((22 + rnd() * 36) * 365.25))),
      department: dept, location: deptLocation(dept, pick), designation: i === 114 ? 'IT Manager' : pick(DESIG[dept]),
      mobile: `+971 5${pick(['0', '2', '5', '6', '8'])} ${digits(3)} ${digits(4)}`, email: '',
      status: rnd() < 0.97 ? 'Active' : 'Inactive', joined, company: OPERATING, sponsor,
      deptHead: '', insurancePlan: 'Group Health Insurance', insuranceProvider: provider,
      emergencyContact: `+${pick(['91', '92', '94', '63', '880', '977', '20', '962'])} ${digits(9)}`, homeAddress: '', notes: '',
      created: { by: 'Data migration', at: iso(addDays(TODAY, -28)) }, updated: { by: 'Data migration', at: iso(addDays(TODAY, -28)) },
      docs,
    });
  }
  const e = employees[114];
  Object.assign(e, { name: 'Chaminda Wickramasinghe', nationality: 'Sri Lankan', dob: '1968-09-23', designation: 'IT Manager', sponsor: COMPANIES_INIT[2].name, location: 'Head Office' });
  e.docs[0].expiry = iso(addDays(TODAY, 164)); e.docs[1].expiry = iso(addDays(TODAY, 9)); e.docs[2].expiry = iso(addDays(TODAY, 9)); e.docs[3].expiry = iso(yearEndDate());
  e.docs[1].renewal = { status: 'In Progress', note: 'Medical test booked 2 Oct', by: 'Imran Qureshi', date: iso(addDays(TODAY, -3)) };
  DEPARTMENTS.forEach((d) => {
    const list = employees.filter((x) => x.department === d);
    const head = list.find((x) => /Manager|Foreman|Supervisor|In-charge/.test(x.designation)) || list[0];
    list.forEach((x) => { x.deptHead = head.name; });
  });
  employees.filter((x) => x.department === 'Trading Department').forEach((x) => { x.deptHead = 'Rajesh Menon'; });
  // a few more renewals already moving
  employees.forEach((x) => x.docs.forEach((d) => { if (!d.renewal && d.expiry && daysUntil(d.expiry) <= 20 && rnd() < 0.45) d.renewal = { status: 'In Progress', note: 'Renewal application started', by: 'Imran Qureshi', date: iso(addDays(TODAY, -4)) }; }));
  const leaves = makeLeaves(employees, rnd);
  // Changes Report 01: employee code, Emp (MOL) ID and labour card (separate random stream so the rest of the demo data is unchanged)
  const lc = prng(20261007);
  employees.forEach((x) => {
    x.code = codeFor(x.designation);
    x.molId = `${1 + Math.floor(lc.rnd() * 9)}${lc.digits(13)}`;
    const visa = x.docs.find((d) => d.type === 'Employment Visa');
    const noScan = lc.rnd() < 0.02;
    x.docs.splice(3, 0, {
      type: 'Labour Card', name: 'Labour Card', ref: lc.digits(8), issuer: 'MOHRE', issued: visa.issued, expiry: visa.expiry, renewal: null,
      file: noScan ? null : { name: `${x.id.replace(' ', '')}_Labour_Card.pdf`, size: `${150 + Math.floor(lc.rnd() * 300)} KB`, sample: true }, history: [],
    });
  });
  // give the sample Department Head (Trading) one request in the HR queue
  const busy = new Set(leaves.filter((l) => !['Completed', 'Rejected'].includes(l.status)).map((l) => l.empId));
  const tr = employees.find((x) => x.department === 'Trading Department' && x.status === 'Active' && !busy.has(x.id));
  const pend = leaves.find((l) => l.status === 'Pending HR Review');
  if (tr && pend) { pend.empId = tr.id; pend.requestedBy = 'Rajesh Menon'; pend.trail = [{ at: pend.requestedOn, by: 'Rajesh Menon', what: 'Submitted' }]; }
  return { employees, leaves };
}

function makeLeaves(emps, rnd) {
  const leaves = [];
  let n = 1;
  const add = (emp, type, startOff, days, status, extra = {}) => {
    const start = addDays(TODAY, startOff);
    const end = addDays(start, days - 1);
    const req = addDays(start, -14) > TODAY ? addDays(TODAY, -(n % 6)) : addDays(start, -14);
    leaves.push({
      id: `LV-${TODAY.getFullYear()}-${String(n++).padStart(4, '0')}`, empId: emp.id, type, start: iso(start), end: iso(end), days,
      reason: type === 'Annual Leave' ? 'Annual vacation to home country' : type === 'Sick Leave' ? 'Medical rest as per doctor certificate' : 'Family emergency',
      requestedBy: emp.deptHead, requestedOn: iso(req), status, rejoined: null, trail: [{ at: iso(req), by: emp.deptHead, what: 'Submitted' }], ...extra,
    });
  };
  const pool = emps.filter((e) => e.status === 'Active');
  for (let i = 0; i < 12; i++) add(pool[i * 17 + 3], i < 9 ? 'Annual Leave' : i < 11 ? 'Sick Leave' : 'Emergency Leave', -Math.floor(rnd() * 20) - 1, i < 9 ? 30 : 5 + (i % 3), 'On Leave');
  add(pool[40], 'Annual Leave', -32, 30, 'Awaiting Rejoining');
  add(pool[61], 'Annual Leave', -31, 30, 'Awaiting Rejoining');
  add(pool[80], 'Annual Leave', 14, 30, 'Pending HR Review');
  add(pool[91], 'Annual Leave', 21, 30, 'Pending HR Review');
  add(pool[110], 'Emergency Leave', 3, 7, 'Pending HR Review');
  add(pool[130], 'Annual Leave', 30, 30, 'Pending Approval', { hrNote: 'Record checked; no overlapping leave in department' });
  add(pool[150], 'Sick Leave', 1, 3, 'Pending Approval', { hrNote: 'Medical certificate attached' });
  add(pool[170], 'Annual Leave', 10, 30, 'Approved');
  add(pool[185], 'Annual Leave', 25, 25, 'Approved');
  add(pool[200], 'Annual Leave', 45, 30, 'Approved');
  for (let i = 0; i < 26; i++) {
    const emp = pool[(i * 9 + 5) % pool.length];
    const off = -60 - Math.floor(rnd() * 500);
    const t = i % 5 === 0 ? 'Sick Leave' : i % 7 === 0 ? 'Emergency Leave' : 'Annual Leave';
    const days = t === 'Annual Leave' ? 30 : 3 + (i % 4);
    add(emp, t, off, days, i % 11 === 4 ? 'Rejected' : 'Completed', i % 11 === 4 ? { rejectReason: 'Peak season — reschedule requested', decidedBy: 'General Manager' } : { rejoined: iso(addDays(TODAY, off + days + (i % 6 === 0 ? 2 : 0))), decidedBy: 'General Manager' });
  }
  const s = emps[114];
  add(s, 'Annual Leave', -300, 30, 'Completed', { rejoined: iso(addDays(TODAY, -270)) });
  add(s, 'Sick Leave', -90, 2, 'Completed', { rejoined: iso(addDays(TODAY, -88)) });
  return leaves;
}

// ---------- helpers ----------
export function hrExpiryRows(employees, withinDays = 60, types) {
  const tt = types || docTypes('hr').filter((t) => t.expires).map((t) => t.key);
  const rows = [];
  employees.forEach((e) => e.docs.forEach((doc) => {
    if (!tt.includes(doc.type) || !doc.expiry) return;
    const d = daysUntil(doc.expiry);
    if (d <= withinDays) rows.push({ module: 'hr', owner: e, emp: e, doc, d, st: docStatus(doc) });
  }));
  return rows.sort((a, b) => a.d - b.d);
}
export function hrMissing(e) {
  const req = requiredFor('hr');
  return req.filter((t) => !e.docs.some((d) => d.type === t)).map((t) => ({ type: t, recorded: false }))
    .concat(e.docs.filter((d) => req.includes(d.type) && !d.file).map((d) => ({ type: d.type, recorded: true, doc: d })));
}
export function leaveTaken(leaves, emp) {
  return leaves.filter((l) => l.empId === emp.id && l.type === 'Annual Leave' && ['Completed', 'On Leave', 'Awaiting Rejoining'].includes(l.status)).reduce((s, l) => s + l.days, 0);
}
export const maskNo = (no, type) => {
  if (!no) return '—';
  return no;
};
// Employee number ↔ page-link parameter. Employee numbers are entered by HR (Changes Report 01), so they can have any form.
// Numbers like 'EMP 0115' keep the short link '#hr-employee.0115'; any other number is percent-encoded after '~'.
export const empParam = (id) => (/^EMP \d+$/.test(id) ? id.slice(4) : '~' + encodeURIComponent(id).replace(/\./g, '%2E'));
export const empIdFromParam = (p) => {
  const s = String(p || '');
  const dec = (x) => { try { return decodeURIComponent(x); } catch { return x; } };
  if (s.startsWith('~')) return dec(s.slice(1));
  return /^\d+$/.test(s) ? `EMP ${s}` : dec(s);
};
