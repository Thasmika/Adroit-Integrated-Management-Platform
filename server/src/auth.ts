// Authentication: e-mail + password, bcrypt hashes, server-side sessions in an httpOnly cookie,
// lockout after repeated failures. Authorization helpers wrap the shared role rules (@adroit/core access.js).
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { one, q, pool } from './db.js';
import { env } from './env.js';
import { cfg } from './config.js';
import { audit, Actor } from './audit.js';
import { can as coreCan, canModule, canAdmin, canAudit } from '@adroit/core/src/core/access.js';

export const COOKIE = 'adroit_sid';
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}
export const bad = (m: string) => new HttpError(400, m, 'bad_request');
export const forbidden = (m = "Your role doesn't allow this action.") => new HttpError(403, m, 'forbidden');
export const notFound = (m = 'Record not found or outside your access.') => new HttpError(404, m, 'not_found');

export const hashPassword = (p: string) => bcrypt.hash(p, 11);

export function passwordProblem(p: string) {
  const min = cfg()?.system?.passwordMinLength || 10;
  if (!p || p.length < min) return `Use at least ${min} characters.`;
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Use letters and at least one number.';
  return null;
}

export async function login(email: string, password: string, ip: string, ua: string) {
  const u = await one<any>('SELECT * FROM users WHERE lower(email) = lower($1)', [email.trim()]);
  const generic = new HttpError(401, 'The e-mail or password is not correct.', 'invalid_login');
  if (!u || !u.password_hash) { await bcrypt.compare(password, '$2a$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv'); throw generic; }
  if (!u.active) throw new HttpError(403, 'This account is deactivated. Contact the System Administrator.', 'inactive');
  if (u.locked_until && new Date(u.locked_until) > new Date()) {
    throw new HttpError(423, `Too many failed attempts. Try again after ${new Date(u.locked_until).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.`, 'locked');
  }
  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) {
    const fails = u.failed_logins + 1;
    await pool.query('UPDATE users SET failed_logins = $2, locked_until = $3 WHERE id = $1',
      [u.id, fails >= MAX_FAILS ? 0 : fails, fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null]);
    await audit(null, { id: u.id, name: u.name, role: u.role, ip }, 'Login failed', 'Session', u.email, fails >= MAX_FAILS ? `Account locked for ${LOCK_MINUTES} minutes` : `Failed attempt ${fails}`);
    throw generic;
  }
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + env.sessionHours * 3600000);
  await pool.query('UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = now() WHERE id = $1', [u.id]);
  await pool.query('INSERT INTO sessions (token_hash, user_id, expires_at, ip, user_agent) VALUES ($1,$2,$3,$4,$5)', [sha(token), u.id, expires, ip, ua?.slice(0, 200)]);
  await audit(null, { id: u.id, name: u.name, role: u.role, ip }, 'Login', 'Session', u.email, 'Signed in');
  return { token, expires, user: publicUser(u) };
}

export const publicUser = (u: any) => ({ id: u.id, name: u.name, email: u.email, role: u.role, scope: u.scope_department ?? u.scope ?? null, mustChangePassword: !!u.must_change_password });

export async function sessionUser(token: string | undefined) {
  if (!token) return null;
  const row = await one<any>(
    `SELECT u.*, s.token_hash FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.active`, [sha(token)]);
  if (!row) return null;
  pool.query('UPDATE sessions SET last_seen_at = now() WHERE token_hash = $1', [row.token_hash]).catch(() => {});
  return publicUser(row);
}

export async function logout(token: string | undefined) {
  if (token) await pool.query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1', [sha(token)]);
}
export async function revokeUserSessions(userId: string, exceptToken?: string) {
  await pool.query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL AND token_hash <> $2', [userId, exceptToken ? sha(exceptToken) : '']);
}

export function setSessionCookie(reply: FastifyReply, token: string, expires: Date) {
  reply.setCookie(COOKIE, token, { path: '/', httpOnly: true, sameSite: 'strict', secure: env.cookieSecure, expires });
}

// ---------- request helpers ----------
declare module 'fastify' {
  interface FastifyRequest { user: any; actor: Actor }
}
export function actorOf(req: FastifyRequest): Actor {
  return { id: req.user.id, name: req.user.name, role: req.user.role, scope: req.user.scope, ip: req.ip };
}
export const requireUser = async (req: FastifyRequest) => {
  const u = await sessionUser(req.cookies?.[COOKIE]);
  if (!u) throw new HttpError(401, 'Please sign in.', 'unauthenticated');
  req.user = u;
  req.actor = actorOf(req);
  const url = req.routeOptions?.url || '';
  if (u.mustChangePassword && !url.startsWith('/api/auth/')) throw new HttpError(403, 'Change your password to continue.', 'must_change_password');
};

export const can = (u: any, action: string, ctx: any = {}) => coreCan(u, action, ctx);
export function assert(cond: any, err: HttpError = forbidden()) { if (!cond) throw err; }
export const requireModule = (u: any, m: 'hr' | 'fleet') => assert(canModule(u, m));
export const requireAdmin = (u: any) => assert(canAdmin(u));
export const requireAuditor = (u: any) => assert(canAudit(u));

export async function activeManagementUsers() {
  return q<any>("SELECT id, name, email FROM users WHERE active AND role = 'management'");
}
