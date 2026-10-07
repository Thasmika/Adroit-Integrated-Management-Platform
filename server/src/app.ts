import Fastify, { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { ZodError } from 'zod';
import { env, isProd } from './env.js';
import { HttpError } from './auth.js';
import { loadConfig } from './config.js';
import authRoutes from './routes/auth.js';
import coreRoutes from './routes/core.js';
import hrRoutes from './routes/hr.js';
import fleetRoutes from './routes/fleet.js';
import docRoutes from './routes/documents.js';
import adminRoutes from './routes/admin.js';

const PG_ERRORS: Record<string, [number, string]> = {
  '23503': [400, 'A selected value (company, department, location, category or user) does not exist or is inactive.'],
  '23505': [409, 'A record with the same unique value already exists.'],
  '23514': [400, 'A value is outside the allowed range.'],
  '22007': [400, 'A date is not valid.'],
  '22008': [400, 'A date is out of range.'],
  '22P02': [400, 'A value has the wrong format.'],
};

export async function buildApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger === false ? false : { level: env.logLevel, redact: ['req.headers.cookie', 'req.body.password', 'req.body.newPassword'] },
    trustProxy: env.trustProxy,
    bodyLimit: 2 * 1048576,
  });
  await loadConfig();

  await app.register(cookie);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        frameSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        connectSrc: ["'self'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: env.cookieSecure ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: env.cookieSecure ? { maxAge: 31536000 } : false,
  });
  await app.register(rateLimit, { global: false });
  await app.register(multipart, { limits: { fileSize: 60 * 1048576, files: 1, fields: 20 } });

  // CSRF defence in depth: SameSite=Strict cookie + a custom header that a cross-site form cannot send
  app.addHook('onRequest', async (req) => {
    if (req.url.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers['x-adroit-client'] !== 'web') {
      throw new HttpError(403, 'Missing client header.', 'csrf');
    }
  });

  app.setErrorHandler((err: any, req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: err.message, code: err.code });
    if (err instanceof ZodError) return reply.status(400).send({ error: err.issues.map((i) => `${i.path.join('.') || 'value'}: ${i.message}`).join('; '), code: 'validation' });
    if (err.code && PG_ERRORS[err.code]) {
      const [s, m] = PG_ERRORS[err.code];
      req.log.warn({ err: err.message, detail: err.detail }, 'database constraint');
      return reply.status(s).send({ error: m, code: 'constraint' });
    }
    if (err.statusCode === 429) return reply.status(429).send({ error: 'Too many attempts. Wait a minute and try again.', code: 'rate_limited' });
    if (err.code === 'FST_REQ_FILE_TOO_LARGE') return reply.status(413).send({ error: 'The file is too large.', code: 'too_large' });
    if (err.statusCode && err.statusCode < 500) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
    req.log.error({ err }, 'unhandled error');
    return reply.status(500).send({ error: 'Something went wrong on the server. The error has been logged.', code: 'server_error' });
  });

  await app.register(authRoutes);
  await app.register(coreRoutes);
  await app.register(hrRoutes);
  await app.register(fleetRoutes);
  await app.register(docRoutes);
  await app.register(adminRoutes);

  // serve the built web app from the same origin (cookies stay first-party, no CORS)
  const webDir = env.webDir || path.resolve(process.cwd(), '../web/dist');
  if (fs.existsSync(path.join(webDir, 'index.html'))) {
    await app.register(fastifyStatic, { root: webDir, prefix: '/', index: ['index.html'], maxAge: isProd ? '1h' : 0 });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) return reply.status(404).send({ error: 'Not found', code: 'not_found' });
      return reply.sendFile('index.html');
    });
  } else {
    app.setNotFoundHandler((req, reply) => reply.status(404).send({ error: 'Not found', code: 'not_found' }));
  }
  return app;
}
