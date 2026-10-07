import React, { useEffect, useState } from 'react';
import { useStore, api } from '../core/store.jsx';
import DubaiSkyline from './DubaiSkyline.jsx';

const DEMO = [
  ['gm@adroit.ae', 'Management'], ['nadeesha.perera@adroit.ae', 'HR Officer'], ['imran.qureshi@adroit.ae', 'PRO / Compliance'],
  ['maria.santos@adroit.ae', 'Insurance Officer'], ['rajesh.menon@adroit.ae', 'Department Head (Trading)'], ['suresh.pillai@adroit.ae', 'Fleet / Transport'],
  ['anjali.rao@adroit.ae', 'Read-Only Auditor'], ['kasun.bandara@adroit.ae', 'System Administrator'],
];

function Side() {
  return (
    <div className="login-side">
      <DubaiSkyline />
      <div className="login-shade" aria-hidden="true" />
      <div className="login-card">
        <span className="eyebrow">Dubai · Integrated Phase 1 principle</span>
        <p className="login-quote">One platform → Employee module + Vehicle / Equipment module → shared documents, expiry engine, alerts, dashboards, search &amp; AI.</p>
      </div>
    </div>
  );
}
const Brand = () => (
  <div className="brand brand-lg">
    <span className="brand-mark" aria-hidden="true">A</span>
    <span className="brand-text"><strong>ADROIT</strong><small>Building Materials Trading Ent. L.L.C</small></span>
  </div>
);

export default function Login() {
  const { state, act } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(state.error || '');
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  useEffect(() => { api('GET', '/api/public-info').then((i) => setDemo(i.demo)).catch(() => {}); }, []);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await act.login(email, password); if (!location.hash) location.hash = 'home'; } catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="login">
      <div className="login-panel">
        <Brand />
        <h1>Integrated Management Platform</h1>
        <p className="muted">Phase 1: Employee, Vehicle &amp; Equipment Management. One sign-in for both modules.</p>
        <form className="login-form" onSubmit={submit}>
          <label className="field"><span className="field-label">E-mail</span>
            <input id="login-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></label>
          <label className="field"><span className="field-label">Password</span>
            <input id="login-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {err && <p className="error" role="alert">{err}</p>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <p className="field-hint">Forgot your password? Ask the System Administrator to reset it.</p>
        </form>
        {demo && (
          <div className="demo-accounts">
            <strong>Demo installation</strong> · fictional data · password <span className="mono">Adroit@2026</span>
            <div>{DEMO.map(([e, r]) => <div key={e}><button type="button" onClick={() => { setEmail(e); setPassword('Adroit@2026'); }}>{e}</button> <span className="muted">· {r}</span></div>)}</div>
          </div>
        )}
      </div>
      <Side />
    </div>
  );
}

export function ChangePassword({ forced }) {
  const { state, act, notify } = useStore();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const min = state.config?.system?.passwordMinLength || 10;
  const submit = async (e) => {
    e.preventDefault();
    if (next !== again) { setErr("The new passwords don't match."); return; }
    setBusy(true); setErr('');
    try { await act.changePassword(cur, next); notify('Password changed. Other sessions were signed out.'); if (!forced) location.hash = 'home'; } catch (x) { setErr(x.message); setBusy(false); }
  };
  const form = (
    <form className="login-form" onSubmit={submit}>
      <label className="field"><span className="field-label">{forced ? 'Temporary password' : 'Current password'}</span><input id="cp-cur" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></label>
      <label className="field"><span className="field-label">New password</span><input id="cp-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required /><span className="field-hint">At least {min} characters, with letters and at least one number.</span></label>
      <label className="field"><span className="field-label">Repeat new password</span><input id="cp-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required /></label>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
      {forced && <button type="button" className="btn btn-ghost btn-block" onClick={act.logout}>Sign out</button>}
    </form>
  );
  if (!forced) return <div className="page narrow"><div className="page-head"><div><span className="eyebrow">My account</span><h1>Change password</h1><p className="muted">Signed in as {state.user.email}.</p></div></div><section className="panel" style={{ maxWidth: 460 }}>{form}</section></div>;
  return (
    <div className="login">
      <div className="login-panel">
        <Brand />
        <h1>Set your password</h1>
        <p className="muted">Welcome, {state.user?.name}. Choose a new password to continue.</p>
        {form}
      </div>
      <Side />
    </div>
  );
}
