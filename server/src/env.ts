// All secrets and connection strings come from the environment, never from source (§3.1).
import path from 'node:path';

const bool = (v: string | undefined, d: boolean) => (v == null || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()));
const num = (v: string | undefined, d: number) => (v == null || v === '' || isNaN(+v) ? d : +v);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 3000),
  host: process.env.HOST || '0.0.0.0',
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/adroit',
  filesDir: path.resolve(process.env.FILES_DIR || './data/files'),
  webDir: process.env.WEB_DIR ? path.resolve(process.env.WEB_DIR) : '',
  publicUrl: (process.env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, ''),
  cookieSecure: bool(process.env.COOKIE_SECURE, process.env.NODE_ENV === 'production'),
  sessionHours: num(process.env.SESSION_HOURS, 10),
  trustProxy: bool(process.env.TRUST_PROXY, true),
  // e-mail (optional; in-app alerts always work)
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: num(process.env.SMTP_PORT, 587),
  smtpSecure: bool(process.env.SMTP_SECURE, false),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  mailFrom: process.env.MAIL_FROM || 'Adroit Platform <no-reply@adroit.local>',
  // jobs
  jobsEnabled: bool(process.env.JOBS_ENABLED, true),
  expiryCron: process.env.EXPIRY_CRON || '5 0 * * *',   // 00:05 daily
  digestCron: process.env.DIGEST_CRON || '0 7 * * *',   // 07:00 daily; sends only on the configured digest day
  mailCron: process.env.MAIL_CRON || '*/5 * * * *',
  tz: process.env.TZ || 'Asia/Dubai',
  // initial administrator (production seed)
  adminEmail: process.env.ADMIN_EMAIL || 'admin@adroit.local',
  adminName: process.env.ADMIN_NAME || 'System Administrator',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  // AI provider (optional). Without a key the built-in rules engine answers; nothing leaves the server.
  aiProvider: (process.env.AI_PROVIDER || 'none').toLowerCase(),        // 'none' | 'anthropic'
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicBaseUrl: (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, ''),
  aiModel: process.env.AI_MODEL || 'claude-haiku-4-5-20251001',
  aiTimeoutMs: num(process.env.AI_TIMEOUT_MS, 8000),
  loginRateLimit: num(process.env.LOGIN_RATE_LIMIT, 10),   // attempts per minute per IP
  logLevel: process.env.LOG_LEVEL || 'info',
};
export const isProd = env.nodeEnv === 'production';
