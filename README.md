# Adroit Integrated Management Platform

**Phase 1: Employee, Vehicle & Equipment Management** for Adroit Building Materials Trading Ent. L.L.C.

One secure web platform with two operational modules and shared services:

- **Employee Management**: employee master, the HR document centre (passport, visa, Emirates ID, insurance, certificates), expiry control, and leave from request to rejoining.
- **Vehicle & Equipment Management**: fleet master, compliance documents (registration, insurance, safety, inspection, permits), expiry control and renewal tracking.
- **Shared services**:
  - one sign-in with role-based access and a Management Home;
  - the Attention Centre, unified search and an AI assistant;
  - private document storage with version history;
  - one expiry engine with alerts and e-mail;
  - an append-only audit trail;
  - CSV data import, administration, and system health.

Built to the *Integrated AI-Assisted HR, Vehicle & Equipment Management System: Technical Proposal v1.0 (September 2026)*.

## Architecture

```
Browser ──HTTPS──► Caddy / nginx ──► Node.js 22 application (Fastify)
                                        ├─ serves the React web app
                                        ├─ REST/JSON API with server-side RBAC
                                        ├─ background jobs: expiry & alerts, e-mail, digest
                                        ├─ optional AI provider (read-only routing, rules-engine fallback)
                                        ├─► PostgreSQL 16   (records, configuration, audit)
                                        └─► private file store (scans, photos)
```

| Folder | Contents |
|---|---|
| `packages/core` | Business rules shared by server and web: expiry engine, access rules, attention list, rules-based AI |
| `server` | API, authentication, jobs, storage, migrations (`server/migrations`), tests (`server/test`), CLI |
| `web` | React web app (Vite) |
| `deploy` | Docker Compose stack, Caddy, `.env.example`, backup / restore scripts, systemd and nginx files |
| `e2e` | Browser end-to-end test |
| `docs` | Deployment, administration, user, security, data migration, backup, AI, API, database and test documents |
| `tools` | Documentation generator |

## Documentation

| Document | For |
|---|---|
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | IT: install, configure, go-live checklist, upgrade, monitor |
| [ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) | System Administrator |
| [USER_GUIDE.md](docs/USER_GUIDE.md) | HR, PRO, Insurance, Department Heads, Management, Fleet, Auditors |
| [SECURITY_AND_ACCESS.md](docs/SECURITY_AND_ACCESS.md) | Role / permission matrix and security controls |
| [DATA_MIGRATION.md](docs/DATA_MIGRATION.md) | Loading existing employee and fleet records |
| [BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) | Backups, restore test, disaster recovery |
| [AI.md](docs/AI.md) | AI integration, safeguards and fallback |
| [API.md](docs/API.md) | API endpoints by service |
| [DATABASE.md](docs/DATABASE.md) | Database schema |
| [TEST_EVIDENCE.md](docs/TEST_EVIDENCE.md) | Test results against the §17 acceptance criteria |
| [OPEN_DECISIONS.md](docs/OPEN_DECISIONS.md) | §19 items management must confirm, with current defaults |

## Outside Phase 1

Salary and payroll, WPS, accounting, vehicle maintenance and service scheduling, fuel, tyres and batteries, accidents and fines, workshop integration and cost analysis (§1.2). The modular structure allows them to be added later (§20).
