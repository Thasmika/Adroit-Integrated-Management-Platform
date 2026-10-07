# Decisions still needed from management

Technical proposal §19 lists the decisions that the business proposals did not settle. The system is built so that each one is a setting, not a code change. The current default is shown for each; confirm or change it before go-live.

| # | Decision | Current default in the system | Where it is changed |
|---|---|---|---|
| 1 | Final user roles and organisational access scope | The 8 roles of §4; Department Heads see only their department | Roles: `packages/core/src/core/shared.js` (`ROLES`), rules in `access.js`. Users and scopes: Administration → Users & roles |
| 2 | Authentication method | Local accounts with bcrypt passwords, lockout, forced change of temporary passwords. No MFA or company single sign-on yet | A company identity provider (e.g. Microsoft Entra ID) needs a small addition to `server/src/routes/auth.ts` |
| 3 | Exact employee fields and mandatory fields | Fields from §6.1; mandatory: name, department, designation, operational company, visa sponsor (the web form also requires the joining date) | `server/src/routes/hr.ts` (input schema), web form `web/src/hr/EmployeeForm.jsx`, import template |
| 4 | Leave approval authority and entitlement rules | Workflow HR review → Management approval. No entitlement or balance calculation (§7 boundary); days taken are shown | Approver role in `access.js`. Entitlement rules are a new feature once defined |
| 5 | Expiry warning thresholds by document type | Urgent 30, warning 60, monitor 90 days for every expiring type | Administration → Document types & thresholds |
| 6 | Notification channels and escalation | In-app on; e-mail off until SMTP is verified; expired documents escalate to Management; weekly digest on Sunday | Administration → System configuration; SMTP in `.env` |
| 7 | Responsible-officer matrix | One officer per document type (PRO: passport, visa, EID; Insurance: health and motor insurance; HR: other HR; Fleet: registration, safety, inspection, permits) | Administration → Responsible officers |
| 8 | Required vs optional document types | HR: passport, visa, EID, health insurance required. Fleet: by category (e.g. machines need insurance, safety and inspection; no registration) | Administration → Document types & thresholds |
| 9 | File size / type limits and retention policy | 10 MB; PDF, JPG, PNG; retention "pending management confirmation"; nothing is hard-deleted | Administration → System configuration |
| 10 | Fleet identifier uniqueness and asset lifecycle statuses | Fleet no. unique; chassis / VIN and plate unique; statuses Active, Under Repair, Standby, Off-road, Inactive, Disposed | Database constraints (`001_init.sql`), status list in `packages/core/src/fleet/data.js` |
| 11 | AI provider, hosting and privacy | Rules engine only; nothing leaves the server. Optional Anthropic provider that receives only the question text | `.env`: `AI_PROVIDER`, `ANTHROPIC_API_KEY` ([AI.md](AI.md)) |
| 12 | Hosting environment and backup policy | Docker Compose on one Linux server with HTTPS; nightly backup kept 30 days; off-server copy required | `deploy/.env`, [DEPLOYMENT.md](DEPLOYMENT.md), [BACKUP_RESTORE.md](BACKUP_RESTORE.md) |
| 13 | Expected concurrent users / SLA | Sized for about 50 concurrent users, ~250 employees and ~130 assets on 2 vCPU / 4 GB; business-hours availability | Scale the server; the app can run as several instances behind the proxy with `JOBS_ENABLED=false` on all but one |
| 14 | Data migration source formats | CSV templates for employees and assets, with validate-then-import | [DATA_MIGRATION.md](DATA_MIGRATION.md) |

Also to replace before go-live:

- A production install starts with only Adroit Building Materials Trading Ent. L.L.C as a company. Add the real group companies (visa sponsors and registered owners, e.g. Gateway Gulf Transport) in Administration → Companies before importing data.
- Real employees, assets and users. The demo data (`npm run seed:demo`) must never be loaded on the production database.
