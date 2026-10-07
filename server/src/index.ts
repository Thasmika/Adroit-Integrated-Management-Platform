import { buildApp } from './app.js';
import { migrate, pool } from './db.js';
import { env } from './env.js';
import { startScheduler } from './jobs.js';
import { seedProduction } from './seed.js';

async function main() {
  await migrate((m) => console.log(m));
  await seedProduction((m) => console.log(m));   // no-op once reference data exists
  const app = await buildApp();
  startScheduler(app.log);
  const close = async (sig: string) => {
    app.log.info(`${sig} received, shutting down`);
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', () => close('SIGTERM'));
  process.on('SIGINT', () => close('SIGINT'));
  await app.listen({ port: env.port, host: env.host });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
