import React, { useMemo } from 'react';
import { useStore } from '../core/store.jsx';
import { TODAY, iso, COMPANIES_INIT } from '../core/shared.js';
import { scopeEmployees, canSeeDoc } from '../core/access.js';
import { DEPARTMENTS, hrExpiryRows as expiryRows, hrMissing } from './data.js';
const DOC_TYPES = ['Passport', 'Employment Visa', 'Emirates ID', 'Health Insurance'];
const SPONSORS = COMPANIES_INIT.map((c) => c.name);

const COLORS = { 'Employment Visa': 'var(--c-visa)', 'Emirates ID': 'var(--c-eid)', Passport: 'var(--c-pp)', 'Health Insurance': 'var(--c-ins)' };

export default function Reports() {
  const { state } = useStore();
  const emps = scopeEmployees(state.user, state.employees);

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const d = new Date(TODAY.getFullYear(), TODAY.getMonth() + i, 1);
    const key = iso(d).slice(0, 7);
    const by = {};
    DOC_TYPES.forEach((t) => { by[t] = 0; });
    emps.forEach((e) => e.docs.forEach((doc) => { if (DOC_TYPES.includes(doc.type) && doc.expiry?.slice(0, 7) === key) by[doc.type]++; }));
    return { label: d.toLocaleDateString('en-GB', { month: 'short' }), year: d.getFullYear(), by, total: Object.values(by).reduce((a, b) => a + b, 0) };
  }), [emps]);
  const maxM = Math.max(...months.map((m) => m.total));

  const nat = Object.entries(emps.reduce((a, e) => ({ ...a, [e.nationality]: (a[e.nationality] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const sp = SPONSORS.map((s) => [s, emps.filter((e) => e.sponsor === s).length]);
  const due60 = expiryRows(emps, 60);
  const dept = DEPARTMENTS.map((d) => {
    const list = emps.filter((e) => e.department === d);
    const ids = new Set(list.map((e) => e.id));
    return {
      d, n: list.length,
      away: state.leaves.filter((l) => l.status === 'On Leave' && ids.has(l.empId)).length,
      due: due60.filter((r) => ids.has(r.emp.id) && r.d >= 0).length,
      exp: due60.filter((r) => ids.has(r.emp.id) && r.d < 0).length,
      miss: list.reduce((s, e) => s + hrMissing(e).length, 0),
    };
  });
  const tot = dept.reduce((a, r) => ({ n: a.n + r.n, away: a.away + r.away, due: a.due + r.due, exp: a.exp + r.exp, miss: a.miss + r.miss }), { n: 0, away: 0, due: 0, exp: 0, miss: 0 });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Management reports</span>
          <h1>HR Reports</h1>
          <p className="muted">Workload ahead for renewals, workforce mix and department status.</p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head"><h2>Renewal workload · next 12 months</h2>
          <span className="legend small">{DOC_TYPES.map((t) => <span key={t}><i className="lg" style={{ background: COLORS[t] }} /> {t}</span>)}</span>
        </div>
        <div className="colchart" role="img" aria-label="Documents expiring per month over the next 12 months">
          {months.map((m, i) => (
            <div className="col" key={i} title={DOC_TYPES.map((t) => `${t}: ${m.by[t]}`).join('\n')}>
              <span className="col-val">{m.total}</span>
              <div className="col-stack" style={{ height: `${(m.total / maxM) * 100}%` }}>
                {DOC_TYPES.map((t) => m.by[t] > 0 && <span key={t} style={{ flex: m.by[t], background: COLORS[t] }} />)}
              </div>
              <span className="col-label">{m.label}{(i === 0 || m.label === 'Jan') && <b>{m.year}</b>}</span>
            </div>
          ))}
        </div>
        <p className="muted small">December peaks because group health insurance renews annually for all members on 31 December.</p>
      </section>

      <section className="panel flush">
        <div className="panel-head pad"><h2>Department status</h2></div>
        <div className="table-wrap">
          <table className="table num">
            <thead><tr><th>Department / branch</th><th>Headcount</th><th>On leave</th><th>Renewals due ≤ 60d</th><th>Expired</th><th>Missing scans</th></tr></thead>
            <tbody>
              {dept.map((r) => (
                <tr key={r.d}><td>{r.d}</td><td>{r.n}</td><td>{r.away || '·'}</td><td>{r.due || '·'}</td><td className={r.exp ? 'warn-text' : ''}>{r.exp || '·'}</td><td>{r.miss || '·'}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><td>Total</td><td>{tot.n}</td><td>{tot.away}</td><td>{tot.due}</td><td>{tot.exp}</td><td>{tot.miss}</td></tr></tfoot>
          </table>
        </div>
      </section>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><h2>Workforce by nationality</h2></div>
          <div className="bars">
            {nat.map(([n, c]) => (
              <div className="bar-row" key={n}><span className="bar-label">{n}</span><span className="bar-track"><span className="bar-fill bar-neutral" style={{ width: `${(c / nat[0][1]) * 100}%` }} /></span><span className="bar-val">{c}</span></div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Visa sponsorship</h2></div>
          <div className="bars">
            {sp.map(([s, c]) => (
              <div className="bar-row wide-label" key={s}><span className="bar-label">{s.replace(' L.L.C', '')}</span><span className="bar-track"><span className="bar-fill" style={{ width: `${(c / emps.length) * 100}%` }} /></span><span className="bar-val">{c}</span></div>
            ))}
          </div>
          <p className="muted small">All staff work for Adroit Building Materials; visas may be issued through a group company.</p>
        </section>
      </div>
    </div>
  );
}
