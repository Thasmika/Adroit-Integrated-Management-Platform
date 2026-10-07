// Operations CLI
//   migrate                    apply database migrations
//   seed                       reference masters + first administrator (ADMIN_EMAIL / ADMIN_PASSWORD)
//   seed --demo [--reset]      demo data (fictional); --reset wipes existing data first
//   run-job expiry|digest|mail run a background job now
//   reset-password <email>     issue a temporary password (forces change at next sign-in)
//   make-admin <email>         grant sysadmin role and full access to a user
import crypto from 'node:crypto';
import { migrate, pool, one } from './db.js';
import { loadConfig } from './config.js';
import { seedProduction, seedDemo } from './seed.js';
import { runExpiryJob, runDigestJob, runMailJob } from './jobs.js';
import { hashPassword } from './auth.js';

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case 'migrate': await migrate(); break;
    case 'seed':
      await migrate();
      if (args.includes('--demo')) { await seedDemo({ reset: args.includes('--reset') }); await loadConfig(); console.log(await runExpiryJob()); }
      else await seedProduction();
      break;
    case 'run-job': {
      await loadConfig();
      const fn = ({ expiry: runExpiryJob, digest: () => runDigestJob(true), mail: runMailJob } as any)[args[0]];
      if (!fn) throw new Error('usage: run-job expiry|digest|mail');
      console.log(await fn());
      break;
    }
    case 'reset-password': {
      const u = await one<any>('SELECT id, email FROM users WHERE lower(email) = lower($1)', [args[0] || '']);
      if (!u) throw new Error('user not found');
      const temp = crypto.randomBytes(7).toString('base64url') + '9';
      await pool.query('UPDATE users SET password_hash = $2, must_change_password = true, failed_logins = 0, locked_until = NULL, active = true WHERE id = $1', [u.id, await hashPassword(temp)]);
      await pool.query("UPDATE sessions SET revoked_at = now() WHERE user_id = $1", [u.id]);
      await pool.query(`INSERT INTO audit_events (user_name, role, action, entity, record, detail) VALUES ('Server console','System','Update','User',$1,'Password reset from server console')`, [u.email]);
      console.log(`temporary password for ${u.email}: ${temp}`);
      break;
    }
    case 'make-admin': {
      const u = await one<any>('SELECT id, email FROM users WHERE lower(email) = lower($1)', [args[0] || '']);
      if (!u) throw new Error('user not found');
      await pool.query("UPDATE users SET role = 'sysadmin', active = true WHERE id = $1", [u.id]);
      await pool.query(`INSERT INTO audit_events (user_name, role, action, entity, record, detail) VALUES ('Server console','System','Update','User',$1,'Role changed to sysadmin from server console')`, [u.email]);
      console.log(`User ${u.email} is now a sysadmin.`);
      break;
    }
    default:
      console.log('commands: migrate | seed [--demo [--reset]] | run-job expiry|digest|mail | reset-password <email> | make-admin <email>');
  }
  await pool.end();
}
main().catch(async (e) => { console.error(e.message || e); await pool.end().catch(() => {}); process.exit(1); });
