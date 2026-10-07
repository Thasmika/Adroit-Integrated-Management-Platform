import React, { useEffect, useState } from 'react';
import { useStore } from '../core/store.jsx';
import { fmtStamp } from '../core/shared.js';
import { Icon, Empty } from '../core/ui.jsx';

export default function Notifications() {
  const { act, run, setUnread } = useStore();
  const [data, setData] = useState(null);
  const load = () => act.notifications().then((d) => { setData(d); setUnread(d.unread); }).catch(() => setData({ items: [], unread: 0 }));
  useEffect(() => { load(); }, []);
  const open = async (n) => { if (!n.read_at) await act.readNotification(n.id).catch(() => {}); if (n.link) location.hash = n.link.slice(1); else load(); };
  return (
    <div className="page narrow">
      <div className="page-head">
        <div><span className="eyebrow">Alerts</span><h1>Notifications</h1><p className="muted">Expiry alerts routed to you, leave actions and the weekly digest. Alert rules are set in Administration.</p></div>
        {data?.unread > 0 && <div className="head-actions"><button className="btn" onClick={async () => { await run(() => act.readAll()); load(); }}><Icon n="check" size={16} /> Mark all as read</button></div>}
      </div>
      <section className="panel flush">
        {!data ? <p className="pad muted">Loading…</p> : data.items.length === 0 ? <Empty title="No notifications yet">Alerts appear here when a document you're responsible for enters its warning window.</Empty> : (
          <ul className="notif-list">
            {data.items.map((n) => (
              <li key={n.id} className={n.read_at ? '' : 'unread'}>
                <Icon n="bell" />
                <span className="who"><strong>{n.title}</strong>{n.body && <small>{n.body}</small>}<small className="muted">{fmtStamp(n.created_at)}{n.email_status === 'sent' ? ' · e-mailed' : n.email_status === 'failed' ? ' · e-mail failed' : ''}</small></span>
                <button className="btn btn-sm" onClick={() => open(n)}>{n.link ? 'Open' : 'Mark read'}</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
