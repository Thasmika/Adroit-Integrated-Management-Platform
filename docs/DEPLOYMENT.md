# Deployment guide

How to install, start, upgrade and roll back the Adroit Integrated Management Platform (Phase 1).

## 1. What gets installed

| Part | What it is |
|---|---|
| Application | One Node.js 22 service. It serves the web app and the API from the same address, runs the daily expiry job, alert e-mails and the weekly digest. |
| Database | PostgreSQL 16. All records, configuration and the audit trail. |
| Document store | A private folder (`FILES_DIR`) with the scanned copies and photos. It is never published directly; every download goes through the application's permission check. |
| Reverse proxy | Caddy (Option A) or nginx (Option B). Terminates HTTPS. |
| Backups | Nightly database dump and document archive, with a manifest for verification. |

## 2. Server requirements

- Linux server (Ubuntu 22.04 / 24.04 or similar), 2 vCPU, 4 GB RAM, 40 GB disk to start. Document storage grows with scans; allow roughly 1 GB per 1,000 scanned documents.
- A DNS name for the system, e.g. `hr.adroit.ae`, pointing to the server. Ports 80 and 443 open for HTTPS certificates (Let's Encrypt). For an internal-only server, see the note in `deploy/Caddyfile`.
- A separate location for copies of the backups (another server, NAS or cloud storage).
- Optional: an SMTP account for e-mail alerts. Optional: an Anthropic API key for the AI assistant (see [AI.md](AI.md)).

## 3. Option A: Docker (recommended)

Requires Docker Engine 24+ with the Compose plugin.

```bash
git clone <repository> /opt/adroit && cd /opt/adroit/deploy
cp .env.example .env
nano .env                      # set DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD, ADMIN_EMAIL (and SMTP if available)
docker compose up -d --build
docker compose logs app | grep -A1 "administrator:"
```

The last command prints the first administrator's e-mail and a one-time temporary password (unless you set `ADMIN_PASSWORD`). Open `https://<DOMAIN>`, sign in, and set a new password.

The stack runs four services:

| Service | Role | Data |
|---|---|---|
| `db` | PostgreSQL 16 | volume `db-data` |
| `app` | Application (port 3000, internal only) | volume `files` (documents); reads `backups` |
| `proxy` | Caddy: HTTPS and certificates | volumes `caddy-data`, `caddy-config` |
| `backup` | Runs `scripts/backup.sh` every night at `BACKUP_TIME` | volume `backups` |

Useful commands:

```bash
docker compose ps                         # status and health
docker compose logs -f app                # application log
docker compose exec app node dist/cli.mjs reset-password user@adroit.ae
docker compose exec backup sh /scripts/backup.sh          # backup now
docker compose exec backup sh /scripts/restore-test.sh    # prove the latest backup restores
```

Copy the backups off the server every day, for example with a cron job on the host:

```bash
rsync -a /var/lib/docker/volumes/adroit_backups/_data/ backup-host:/srv/adroit-backups/
```

## 4. Option B: without Docker (systemd)

1. Install Node.js 22, PostgreSQL 16 and nginx. Create the database and a user:

   ```bash
   sudo -u postgres createuser -P adroit
   sudo -u postgres createdb -O adroit adroit
   ```

2. Create a service account and folders:

   ```bash
   sudo useradd --system --home /opt/adroit adroit
   sudo mkdir -p /opt/adroit /var/lib/adroit/files /var/backups/adroit /etc/adroit
   sudo chown -R adroit:adroit /var/lib/adroit /var/backups/adroit
   ```

3. Build and copy the application (on the server or a build machine with the same Node version):

   ```bash
   npm ci && npm run build
   sudo rsync -a --delete package.json package-lock.json packages server web deploy /opt/adroit/
   cd /opt/adroit && sudo -u adroit npm ci --omit=dev -w @adroit/server -w @adroit/core --include-workspace-root
   ```

4. Configure: `sudo cp deploy/adroit.env.example /etc/adroit/adroit.env`, then edit it (database URL, domain, admin e-mail). `chmod 600` the file.

5. Install the services:

   ```bash
   sudo cp deploy/systemd/adroit*.service deploy/systemd/adroit-backup.timer /etc/systemd/system/
   printf 'PGHOST=127.0.0.1\nPGUSER=adroit\nPGPASSWORD=...\nPGDATABASE=adroit\nFILES_DIR=/var/lib/adroit/files\nBACKUP_DIR=/var/backups/adroit\nBACKUP_KEEP_DAYS=30\n' | sudo tee /etc/adroit/backup.env
   sudo systemctl daemon-reload
   sudo systemctl enable --now adroit adroit-backup.timer
   journalctl -u adroit | grep -A1 "administrator:"
   ```

6. HTTPS: copy `deploy/nginx/adroit.conf` to `/etc/nginx/sites-enabled/`, replace `hr.adroit.ae`, then run `sudo certbot --nginx -d <your domain>` and `sudo systemctl reload nginx`.

## 5. Configuration reference

All settings come from environment variables (`deploy/.env` or `/etc/adroit/adroit.env`). Secrets are never stored in the source code.

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | – | PostgreSQL connection string |
| `FILES_DIR` | `./data/files` | Private document store |
| `PUBLIC_URL` | `http://localhost:3000` | Address used in e-mail links |
| `COOKIE_SECURE` | `true` in production | Session cookie only over HTTPS |
| `SESSION_HOURS` | `10` | Sign-in lifetime |
| `LOGIN_RATE_LIMIT` | `10` | Sign-in attempts per minute per IP. Accounts also lock for 15 minutes after 5 wrong passwords. |
| `TZ` | `Asia/Dubai` | Time zone for jobs and dates |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | – | First administrator, created once on an empty database |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | – | E-mail alerts (optional) |
| `EXPIRY_CRON` | `5 0 * * *` | Daily expiry evaluation and alerts |
| `DIGEST_CRON` | `0 7 * * *` | Weekly digest check (sends on the digest day set in Administration) |
| `MAIL_CRON` | `*/5 * * * *` | E-mail delivery and retry |
| `JOBS_ENABLED` | `true` | Set `false` on extra app instances so jobs run once |
| `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `AI_MODEL`, `AI_TIMEOUT_MS` | `none` | Optional AI provider (see [AI.md](AI.md)) |
| `BACKUP_DIR` | – | Where the health page looks for backups |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |

## 6. First start and go-live checklist

Follow this order (technical proposal §16 and §17). Expiry alerts start switched **off** so nobody gets alerts from unverified data.

1. Sign in as the first administrator and set a new password.
2. **Administration → Companies, departments & locations**: check the reference lists; add the real group companies.
3. **Administration → Users & roles**: create the users (each gets a temporary password to hand over privately).
4. **Administration → Document types & thresholds** and **Responsible officers**: confirm thresholds and assign an officer for every document type.
5. **Data import**: the HR Officer uses **Employees → Import CSV** and the Fleet Officer uses **Fleet Master → Import CSV**. Download the CSV template, fill it from the existing records, **Validate**, fix rejected rows, then **Import**. See [DATA_MIGRATION.md](DATA_MIGRATION.md).
6. Upload the current scanned documents to the imported records. Older versions can follow later.
7. Check the **Attention Centre** lists with HR, PRO, Insurance and Transport. Correct any wrong dates.
8. Set the SMTP variables, restart the app, then use **Administration → System health → Test SMTP connection**. In **Administration → System configuration**, switch on **Email alerts** and **Expiry alerts**.
9. Run a backup and `restore-test.sh`. Confirm **System health** shows the backup.
10. User acceptance testing with Management, HR, PRO, Insurance and Transport ([TEST_EVIDENCE.md](TEST_EVIDENCE.md) lists the acceptance tests).
11. Controlled rollout: pilot user group first, then everyone.

## 7. Upgrades and rollback

```bash
# before every upgrade
docker compose exec backup sh /scripts/backup.sh
git pull
docker compose up -d --build app      # migrations run automatically at start-up
docker compose logs app | tail
```

Migrations are ordered SQL files in `server/migrations`, applied once and recorded in `schema_migrations`. They run under an advisory lock, so several instances starting together are safe. To roll back, check out the previous version and restore the backup taken before the upgrade ([BACKUP_RESTORE.md](BACKUP_RESTORE.md)).

## 8. Monitoring

- **Administration → System health** shows the database, document storage and free space, e-mail queue, AI status, the last run of each background job with any failures, and the latest backup.
- `GET /api/health` returns `200` when the application and database respond. Point an uptime monitor at it.
- Logs are structured JSON on stdout (`docker compose logs app` or `journalctl -u adroit`). Passwords and cookies are redacted.
