import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { COOKIE, login, logout, requireUser, setSessionCookie, passwordProblem, hashPassword, bad, revokeUserSessions } from '../auth.js';
import { one, pool } from '../db.js';
import { audit } from '../audit.js';
import { env } from '../env.js';

export default async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', { config: { rateLimit: { max: env.loginRateLimit, timeWindow: '1 minute' } } }, async (req, reply) => {
    const b = z.object({ email: z.string().min(3).max(200), password: z.string().min(1).max(200) }).parse(req.body);
    const r = await login(b.email, b.password, req.ip, req.headers['user-agent'] || '');
    setSessionCookie(reply, r.token, r.expires);
    return { user: r.user };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    await logout(req.cookies?.[COOKIE]);
    reply.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: requireUser }, async (req) => ({ user: req.user }));

  app.post('/api/auth/change-password', { preHandler: requireUser, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const b = z.object({ currentPassword: z.string().min(1), newPassword: z.string().max(200) }).parse(req.body);
    const row = await one<any>('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!row?.password_hash || !(await bcrypt.compare(b.currentPassword, row.password_hash))) throw bad('The current password is not correct.');
    const p = passwordProblem(b.newPassword);
    if (p) throw bad(p);
    if (await bcrypt.compare(b.newPassword, row.password_hash)) throw bad('Choose a password different from the current one.');
    await pool.query('UPDATE users SET password_hash = $2, must_change_password = false, password_changed_at = now(), updated_at = now() WHERE id = $1', [req.user.id, await hashPassword(b.newPassword)]);
    await revokeUserSessions(req.user.id, req.cookies?.[COOKIE]);
    await audit(null, req.actor, 'Update', 'User', req.user.email, 'Password changed; other sessions signed out');
    return { user: { ...req.user, mustChangePassword: false } };
  });
}
