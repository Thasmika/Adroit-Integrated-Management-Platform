// Background jobs (§10, §15): daily expiry evaluation, action assignment, alerts, escalation, leave date
// transitions, weekly digest and e-mail delivery. Every run is recorded in job_runs.
import nodemailer from 'nodemailer';
import cron from 'node-cron';
import { pool, q, one, tx } from './db.js';
import { env } from './env.js';
import { cfg, loadConfig } from './config.js';
import { audit } from './audit.js';
import { docStatus, docCfg, officerFor, daysUntil, fmt, iso, refreshToday } from '@adroit/core/src/core/shared.js';

type Log = { info: (m: any, ...a: any[]) => void; error: (m: any, ...a: any[]) => void };

async function record(job: string, fn: () => Promise<any>) {
  const run = await one<any>('INSERT INTO job_runs (job) VALUES ($1) RETURNING id', [job]);
  try {
    const detail = await fn();
    await pool.query("UPDATE job_runs SET finished_at = now(), status = 'ok', detail = $2 WHERE id = $1", [run.id, JSON.stringify(detail ?? {})]);
    return detail;
  } catch (e) {
    await pool.query("UPDATE job_runs SET finished_at = now(), status = 'failed', error = $2 WHERE id = $1", [run.id, (e as Error).stack?.slice(0, 2000)]);
    throw e;
  }
}

const fill = (tpl: string, v: Record<string, any>) => tpl.replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? `{${k}}`));
const template = (id: string) => cfg().templates.find((t: any) => t.id === id);

export async function notify(userId: string, templateId: string, vars: Record<string, any>, link: string, dedupeKey: string | null, body?: string) {
  const t = template(templateId);
  const sys = cfg().system;
  if (!t || !sys.inApp && !sys.email) return false;
  const wantsEmail = sys.email && t.channel.includes('mail');
  const r = await pool.query(
    `INSERT INTO notifications (user_id, template_id, title, body, link, dedupe_key, email_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
    [userId, templateId, fill(t.subject, vars), body || null, link, dedupeKey, wantsEmail ? 'pending' : 'not_required']);
  return r.rowCount > 0;
}

// ---------- daily expiry evaluation ----------
export async function runExpiryJob() {
  return record('expiry', async () => {
    refreshToday();
    await loadConfig();
    const sys = cfg().system;
    const rows = await q<any>(`
      SELECT d.id AS doc_id, d.type, d.name, d.owner_module, v.id AS version_id, v.expiry, v.file_id,
             COALESCE(e.emp_no, a.fleet_no) AS owner_no, COALESCE(e.name, a.make || ' ' || a.model) AS owner_name,
             ea.id AS action_id
        FROM documents d
        JOIN document_versions v ON v.document_id = d.id AND v.is_current
        JOIN document_types t ON t.key = d.type AND t.expires
        LEFT JOIN employees e ON d.owner_module = 'hr' AND e.id = d.owner_id AND e.status IN ('Active','On Notice')
        LEFT JOIN assets a ON d.owner_module = 'fleet' AND a.id = d.owner_id AND a.status NOT IN ('Inactive','Disposed')
        LEFT JOIN expiry_actions ea ON ea.document_id = d.id AND ea.completed_at IS NULL
       WHERE v.expiry IS NOT NULL AND (e.id IS NOT NULL OR a.id IS NOT NULL)`);
    const mgmt = sys.escalation ? await q<any>("SELECT id FROM users WHERE active AND role = 'management'") : [];
    let opened = 0, alerts = 0;
    const today = iso(new Date());
    for (const r of rows) {
      const st = docStatus({ type: r.type, expiry: r.expiry, file: { id: r.file_id } });
      if (!['expired', 'critical', 'due', 'monitor'].includes(st.key)) continue;
      const officer = officerFor(r.type);
      // an action opens automatically once a document enters its warning window (§10 Assignment)
      if (['expired', 'critical', 'due'].includes(st.key) && !r.action_id) {
        const assignee = docCfg(r.type).officer || null;
        const a = await one<any>(`INSERT INTO expiry_actions (document_id, status, assigned_to, updated_by, note) VALUES ($1,'Open',$2,'System','Opened by daily expiry check')
                                  ON CONFLICT (document_id) WHERE completed_at IS NULL DO NOTHING RETURNING id`, [r.doc_id, assignee]);
        if (a) { opened++; await pool.query("INSERT INTO action_events (action_id, by_user, status, note) VALUES ($1,'System','Open','Entered warning window')", [a.id]); }
      }
      if (!sys.alertsEnabled || !docCfg(r.type).officer) continue;
      const link = r.owner_module === 'hr' ? `#hr-employee.${r.owner_no.replace('EMP ', '')}` : `#fleet-vehicle.${r.owner_no.replace('VH-', '')}`;
      const vars = { docType: r.name, owner: `${r.owner_no} ${r.owner_name}`, expiry: fmt(r.expiry), days: st.d };
      // one alert per stage per document version; expired documents alert daily until renewed
      const stage = st.key === 'expired' ? `expired:${today}` : st.key;
      const tpl = st.key === 'expired' ? 'T3' : st.key === 'critical' ? 'T2' : 'T1';
      if (await notify(officer.id, tpl, vars, link, `${r.version_id}:${stage}`)) alerts++;
      if (st.key === 'expired') for (const m of mgmt) if (await notify(m.id, 'T3', vars, link, `${r.version_id}:${stage}:esc`)) alerts++;
    }
    const leave = await leaveTransitions();
    return { documentsChecked: rows.length, actionsOpened: opened, alertsCreated: alerts, alertsEnabled: sys.alertsEnabled, ...leave };
  });
}

// Approved leave starts → On Leave; leave ends without rejoining → Awaiting Rejoining (§7 steps 4–5)
export async function leaveTransitions() {
  const started = await q<any>(`UPDATE leave_requests SET status = 'On Leave', updated_at = now() WHERE status = 'Approved' AND start_date <= current_date RETURNING id`);
  const ended = await q<any>(`UPDATE leave_requests SET status = 'Awaiting Rejoining', updated_at = now() WHERE status = 'On Leave' AND end_date < current_date RETURNING id`);
  for (const l of started) await pool.query("INSERT INTO leave_events (leave_id, by_user, from_status, to_status) VALUES ($1,'System','Approved','On Leave')", [l.id]);
  for (const l of ended) await pool.query("INSERT INTO leave_events (leave_id, by_user, from_status, to_status) VALUES ($1,'System','On Leave','Awaiting Rejoining')", [l.id]);
  return { leaveStarted: started.length, leaveEnded: ended.length };
}

// ---------- weekly digest to Management ----------
export async function runDigestJob(force = false) {
  const day = new Date().toLocaleDateString('en-GB', { weekday: 'long', timeZone: env.tz });
  if (!force && day !== cfg().system.digestDay) return { skipped: `digest day is ${cfg().system.digestDay}` };
  return record('digest', async () => {
    const counts = await one<any>(`
      SELECT count(*) FILTER (WHERE v.expiry < current_date) AS expired,
             count(*) FILTER (WHERE v.expiry >= current_date AND v.expiry <= current_date + 30) AS urgent,
             count(*) FILTER (WHERE v.expiry > current_date + 30 AND v.expiry <= current_date + 60) AS due
        FROM documents d JOIN document_versions v ON v.document_id = d.id AND v.is_current
        JOIN document_types t ON t.key = d.type AND t.expires
        LEFT JOIN employees e ON d.owner_module='hr' AND e.id = d.owner_id AND e.status IN ('Active','On Notice')
        LEFT JOIN assets a ON d.owner_module='fleet' AND a.id = d.owner_id AND a.status NOT IN ('Inactive','Disposed')
       WHERE e.id IS NOT NULL OR a.id IS NOT NULL`);
    const leave = await one<any>(`SELECT count(*) FILTER (WHERE status LIKE 'Pending%') AS pending, count(*) FILTER (WHERE status = 'Awaiting Rejoining') AS rejoin FROM leave_requests`);
    const open = await one<any>(`SELECT count(*) AS n FROM expiry_actions WHERE completed_at IS NULL AND status = 'Open'`);
    const body = `Expired: ${counts.expired} · urgent (≤30 days): ${counts.urgent} · renewal due (31–60 days): ${counts.due} · renewal actions not started: ${open.n} · leave awaiting decision: ${leave.pending} · awaiting rejoining: ${leave.rejoin}`;
    const week = iso(new Date());
    let sent = 0;
    for (const m of await q<any>("SELECT id FROM users WHERE active AND role = 'management'")) if (await notify(m.id, 'T6', {}, '#attention', `digest:${week}`, body)) sent++;
    return { recipients: sent, body };
  });
}

// ---------- e-mail delivery (optional) ----------
let transporter: nodemailer.Transporter | null = null;
export const emailConfigured = () => !!env.smtpHost;
function mailer() {
  if (!emailConfigured()) return null;
  transporter ||= nodemailer.createTransport({ host: env.smtpHost, port: env.smtpPort, secure: env.smtpSecure, auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined });
  return transporter;
}
export async function runMailJob() {
  const t = mailer();
  const pending = await q<any>(`SELECT n.*, u.email, u.name FROM notifications n JOIN users u ON u.id = n.user_id WHERE n.email_status = 'pending' AND u.active ORDER BY n.created_at LIMIT 100`);
  if (!pending.length) return { sent: 0 };
  if (!t) return { sent: 0, note: 'SMTP not configured; e-mails stay pending' };
  return record('mail', async () => {
    let sent = 0, failed = 0;
    for (const n of pending) {
      try {
        await t.sendMail({ from: env.mailFrom, to: `${n.name} <${n.email}>`, subject: n.title,
          text: `${n.title}\n\n${n.body || ''}\n\nOpen: ${env.publicUrl}/${n.link || ''}\n\n— Adroit Integrated Management Platform` });
        await pool.query("UPDATE notifications SET email_status = 'sent', email_sent_at = now(), email_error = NULL WHERE id = $1", [n.id]);
        sent++;
      } catch (e) {
        await pool.query("UPDATE notifications SET email_status = 'failed', email_error = $2 WHERE id = $1", [n.id, (e as Error).message.slice(0, 300)]);
        failed++;
      }
    }
    return { sent, failed };
  });
}
export async function verifySmtp() {
  const t = mailer();
  if (!t) return { configured: false };
  try { await t.verify(); return { configured: true, ok: true }; } catch (e) { return { configured: true, ok: false, error: (e as Error).message }; }
}

// ---------- scheduler ----------
export function startScheduler(log: Log) {
  if (!env.jobsEnabled) { log.info('background jobs disabled (JOBS_ENABLED=false)'); return; }
  // single-instance guard across app replicas via an advisory lock per run
  const guarded = (name: string, fn: () => Promise<any>) => async () => {
    const c = await pool.connect();
    try {
      const { rows } = await c.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [name]);
      if (!rows[0].ok) return;
      try { const r = await fn(); if (r && !r.skipped) log.info({ job: name, result: r }, 'job finished'); } catch (e) { log.error({ job: name, err: e }, 'job failed'); await audit(null, null, 'Job failed', 'System', name, (e as Error).message); }
      finally { await c.query('SELECT pg_advisory_unlock(hashtext($1))', [name]); }
    } finally { c.release(); }
  };
  cron.schedule(env.expiryCron, guarded('expiry', runExpiryJob), { timezone: env.tz });
  cron.schedule(env.digestCron, guarded('digest', () => runDigestJob(false)), { timezone: env.tz });
  cron.schedule(env.mailCron, guarded('mail', runMailJob), { timezone: env.tz });
  // catch up at start-up if the daily run was missed (server was down at 00:05)
  setTimeout(async () => {
    const last = await one<any>("SELECT started_at FROM job_runs WHERE job = 'expiry' AND status = 'ok' ORDER BY started_at DESC LIMIT 1").catch(() => null);
    if (!last || new Date(last.started_at).toDateString() !== new Date().toDateString()) guarded('expiry', runExpiryJob)();
  }, 3000);
  log.info(`jobs scheduled: expiry "${env.expiryCron}", digest "${env.digestCron}", mail "${env.mailCron}" (${env.tz})`);
}

export { tx };
