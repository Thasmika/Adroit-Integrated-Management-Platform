# Adroit Integrated Management Platform - Full System Documentation

This document is a combined reference containing the project overview, environment configuration, and local running instructions.

## 1. Project Overview & Architecture
*(From README.md)*

**Phase 1: Employee, Vehicle & Equipment Management** for Adroit Building Materials Trading Ent. L.L.C.

One secure web platform with two operational modules and shared services:
- **Employee Management**: employee master, the HR document centre, expiry control, and leave from request to rejoining.
- **Vehicle & Equipment Management**: fleet master, compliance documents, expiry control and renewal tracking.
- **Shared services**: one sign-in with role-based access, Attention Centre, unified search, private document storage, expiry engine, append-only audit trail, and CSV import.

### Architecture
```text
Browser ──HTTPS──► Caddy / nginx ──► Node.js 22 application (Fastify)
                                        ├─ serves the React web app
                                        ├─ REST/JSON API with server-side RBAC
                                        ├─ background jobs: expiry & alerts, e-mail, digest
                                        ├─ optional AI provider (read-only routing, rules-engine fallback)
                                        ├─► PostgreSQL 16   (records, configuration, audit)
                                        └─► private file store (scans, photos)
```

## 2. Environment Configuration
*(From .env)*

Below are the environment variables configured for this system:

```env
APP_VERSION=1.0.0
DOMAIN=16.16.123.213.nip.io
ACME_EMAIL=admin@gmail.com
TZ=Asia/Dubai

# Database connection
POSTGRES_DB=adroit
POSTGRES_USER=adroit
POSTGRES_PASSWORD=change-me-to-a-long-random-value
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/adroit

# Admin Credentials
ADMIN_EMAIL=admin@gmail.com
ADMIN_NAME=System Administrator
ADMIN_PASSWORD=Admin123

# Sessions & Security
SESSION_HOURS=10
LOGIN_RATE_LIMIT=10
BACKEND_CORS_ORIGINS=["https://16.16.123.213.nip.io", "http://16.16.123.213"]

# Background Jobs & AWS
EXPIRY_CRON=5 0 * * *
DIGEST_CRON=0 7 * * *
MAIL_CRON=*/5 * * * *
AI_PROVIDER=none
BACKUP_TIME=02:30
BACKUP_KEEP_DAYS=30
AWS_REGION=eu-north-1
AWS_S3_BACKUP_BUCKET=adroit-database-backups-bucket
```
*(Note: Sensitive keys like AWS access keys have been deliberately omitted from this shared documentation for security, but are present in the actual `.env` file.)*

## 3. How to Run the System Locally (Windows)
*(From how to run.md)*

This guide explains how to start the Adroit Integrated Management Platform on your local Windows machine without using Docker.

### Prerequisites
1. **Node.js** (v20 or higher) must be installed.
2. **PostgreSQL** must be installed and running locally on port `5432`.

### Step-by-Step Instructions
1. **Install Dependencies:**
   Open PowerShell or your terminal in the root folder and run:
   ```powershell
   npm install
   ```

2. **Start the Backend Server:**
   In the same terminal (or a new tab), start the backend API:
   ```powershell
   npm run dev:server
   ```
   *The server will apply any missing database migrations and start on `http://127.0.0.1:3000`.*

3. **Start the Frontend Web App:**
   Open a new terminal tab in the root folder and start the React frontend:
   ```powershell
   npm run dev:web
   ```
   *Vite will start the frontend on `http://localhost:5173`.*

4. **Access the System:**
   - Open your web browser and go to **[http://localhost:5173](http://localhost:5173)**.
   - Log in using the `ADMIN_EMAIL` and `ADMIN_PASSWORD` (e.g., `admin@gmail.com` / `Admin123`).
