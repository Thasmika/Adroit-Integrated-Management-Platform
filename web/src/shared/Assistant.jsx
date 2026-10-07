import React, { useEffect, useRef, useState } from 'react';
import { useStore, takePending } from '../core/store.jsx';
import { suggestions } from '../core/ai.js';
import { Icon, StatusPill, DocViewer, VehicleArt, Avatar, Empty } from '../core/ui.jsx';
import { fmt, ROLES } from '../core/shared.js';
import { empParam } from '../hr/data.js';
import { assetParam } from '../fleet/data.js';

export default function Assistant() {
  const { state, act } = useStore();
  const [thinking, setThinking] = useState(false);
  const u = state.user;
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState('');
  const [viewing, setViewing] = useState(null);
  const endRef = useRef(null);
  const enabled = state.config.system.aiEnabled;
  const sugg = suggestions(u);

  const ask = async (text) => {
    const t = text.trim();
    if (!t || thinking) return;
    setMsgs((m) => [...m, { role: 'user', text: t }]);
    setQ('');
    setThinking(true);
    let a;
    try { a = await act.ask(t); } catch (x) { a = { module: 'none', text: x.message }; }
    setThinking(false);
    setMsgs((m) => [...m, { role: 'ai', ...a }]);
  };
  useEffect(() => { const p = takePending('ask'); if (p && enabled) ask(p); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs]);

  if (!enabled) {
    return (
      <div className="page chat-page">
        <div className="page-head"><div><span className="eyebrow">AI Assistance</span><h1>AI Assistant</h1></div></div>
        <Empty title="The AI assistant is switched off">The System Administrator has disabled AI in configuration. Everything else keeps working: use <a href="#search">Search</a> to find records and the <a href="#attention">Attention Centre</a> for expiry lists.</Empty>
      </div>
    );
  }

  const Owner = ({ module, rec }) => module === 'hr'
    ? <a className="who-row" href={`#hr-employee.${empParam(rec.id)}`}><Avatar name={rec.name} size={26} photo={rec.photo} /><span className="who"><strong>{rec.name}</strong><small className="mono">{rec.id}</small></span></a>
    : <a className="who-row" href={`#fleet-vehicle.${assetParam(rec.id)}`}><span className="art-chip"><VehicleArt category={rec.category} size={26} /></span><span className="who"><strong className="mono">{rec.id}</strong><small>{rec.make} {rec.model}</small></span></a>;

  return (
    <div className="page chat-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">AI Assistance</span>
          <h1>AI Assistant</h1>
          <p className="muted">Ask in plain English. Answers come only from records your role ({ROLES[u.role].label}) may see, list the records they used, and never change anything.</p>
        </div>
      </div>
      <div className="chat">
        {msgs.length === 0 && (
          <div className="chat-intro">
            <Icon n="ai" size={28} />
            <p>Try one of these:</p>
            <div className="suggest">{sugg.map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}</div>
          </div>
        )}
        {msgs.map((m, i) => m.role === 'user' ? (
          <div className="msg msg-user" key={i}><p>{m.text}</p></div>
        ) : (
          <div className="msg msg-ai" key={i}>
            <span className="msg-icon"><Icon n="ai" size={16} /></span>
            <div className="msg-body">
              <p>{m.text}</p>
              {m.bullets && <ul>{m.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>}
              {m.sections && m.sections.map((sec) => <div key={sec.title} className="ai-section"><h4>{sec.title}</h4><ul>{sec.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul></div>)}
              {m.docs && (
                <div className="doc-cards">
                  {m.docs.map((r) => {
                    const owner = r.emp || r.asset;
                    return (
                      <div className="doc-card" key={r.doc.type}>
                        <div><strong>{r.doc.name || r.doc.type}</strong><small className="mono">{r.doc.ref} · exp. {fmt(r.doc.expiry)}</small></div>
                        <StatusPill doc={r.doc} />
                        {r.doc.file ? <button className="btn btn-sm" onClick={() => setViewing({ owner, module: m.module, doc: r.doc })}><Icon n="eye" size={14} /> View copy</button> : <span className="muted small">No scan on file</span>}
                      </div>
                    );
                  })}
                </div>
              )}
              {m.rows && m.rows.length > 0 && (
                <div className="table-wrap result">
                  <table className="table compact">
                    <thead><tr>{m.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>{m.rows.slice(0, 30).map((r, j) => <tr key={j}><td><Owner module={m.module} rec={r.emp || r.asset} /></td>{r.cols.map((c, k) => <td key={k}>{c}</td>)}</tr>)}</tbody>
                  </table>
                  {m.rows.length > 30 && <p className="muted small pad-s">Showing 30 of {m.rows.length}.</p>}
                </div>
              )}
              {m.mixed && m.mixed.length > 0 && (
                <div className="table-wrap result">
                  <table className="table compact">
                    <thead><tr>{m.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>{m.mixed.slice(0, 30).map((r, j) => <tr key={j}><td><a className="who" href={r.link}><strong>{r.module === 'hr' ? r.name : r.id}</strong><small><span className={'mod-tag mt-' + r.module}>{r.module === 'hr' ? 'HR' : 'Fleet'}</span> {r.module === 'hr' ? r.id : r.name}</small></a></td>{r.cols.map((c, k) => <td key={k}>{c}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
              {m.link && <a className="link" href={m.link[0]}>{m.link[1]} <Icon n="arrow" size={14} /></a>}
            </div>
          </div>
        ))}
        {thinking && <div className="msg msg-ai"><span className="msg-icon"><Icon n="ai" size={16} /></span><div className="msg-body"><p className="muted">Looking through the records…</p></div></div>}
        <div ref={endRef} />
      </div>
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <input id="ai-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about employees, vehicles, documents, expiries or leave" aria-label="Ask the AI assistant" autoComplete="off" />
        <button className="btn btn-primary" type="submit"><Icon n="send" size={16} /> Ask</button>
      </form>
      {msgs.length > 0 && <div className="suggest small-s">{sugg.slice(0, 6).map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}</div>}
      <p className="muted small"><Icon n="lock" size={13} /> Answers are read-only and use only the records your role may see. Every question is written to the audit log. Phase 1 uses rule-based matching; if the assistant is switched off, search, dashboards, alerts and workflows keep working.</p>
      {viewing && <DocViewer owner={viewing.owner} module={viewing.module} doc={viewing.doc} onClose={() => setViewing(null)} />}
    </div>
  );
}
