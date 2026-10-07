# Test evidence

Results of the automated and manual checks run before handover on 29 Sep 2026, mapped to the acceptance criteria of technical proposal §17. Environment: Node.js 22.22, PostgreSQL 16.13, Chromium (Playwright), 2 vCPU / 8 GB Linux.

## How to rerun

```bash
# API and AI tests (needs a PostgreSQL server; creates its own test databases)
TEST_DATABASE_URL=postgres://postgres:<pw>@127.0.0.1:5432/adroit_test npm test

# browser end-to-end test against a running server with demo data
npm run seed:demo -- --reset     # on a NON-production database only
BASE_URL=http://127.0.0.1:3000/ OUT=./e2e-out python3 e2e/e2e_test.py
```

## 1. API integration tests: 27 / 27 passed

`server/test/api.test.ts` (19 tests) and `server/test/ai.test.ts` (8 tests), against a real PostgreSQL database.

| §17 area | Test | Result |
|---|---|---|
| Expiry engine | Status boundaries follow the configured thresholds | Pass |
| Expiry engine | Daily job is idempotent: a second run opens no duplicate actions or alerts | Pass |
| Login / RBAC | Wrong password rejected; account locks after five failures | Pass |
| Login / RBAC | Change requests without the client header refused (CSRF) | Pass |
| Login / RBAC | Unauthenticated API calls refused | Pass |
| Login / RBAC | Module and record scope enforced by the server | Pass |
| Login / RBAC | PRO can't change health insurance; Insurance Officer can't change visas | Pass |
| Employee / Asset documents | Renewal supersedes the current version, keeps history, completes the action | Pass |
| Employee / Asset documents | Renewal needs a future expiry date | Pass |
| Documents (§9) | A text file named `.pdf` is refused by content check | Pass |
| Documents (§9) | Files private: permission checked, views audited | Pass |
| Leave | Request → HR review → Management approval → rejoining, with role checks | Pass |
| Leave | Reject needs a reason; rejoining completes an awaiting leave | Pass |
| Asset profile | Create; duplicate chassis refused; lifecycle status | Pass |
| AI | Grounded, permission-filtered, logged, can be switched off | Pass |
| Admin | Thresholds validated; changes audited; users get temporary passwords | Pass |
| Audit | Audit trail append-only in the database | Pass |
| Migration | Import validation reports accepted / rejected rows; commit imports only valid rows | Pass |
| Performance | Record cache: changes from this or another app instance visible on the next request | Pass |
| AI provider | Provider picks an approved tool; server answers from records | Pass |
| AI provider | Provider receives only the question and tool list, never records | Pass |
| AI provider | Provider error falls back to the rules engine | Pass |
| AI provider | Slow provider times out and falls back | Pass |
| AI provider | Unknown tools and bad parameters ignored | Pass |
| AI provider | Permissions still apply after routing | Pass |
| AI provider | Fleet, leave and officer tools route to grounded answers | Pass |
| AI provider | Each question logged with the path that answered it | Pass |

## 2. Browser end-to-end test: 24 / 24 passed

`e2e/e2e_test.py`, run in Chromium against the production build with demo data.

| # | Check | Result |
|---|---|---|
| 1 | Wrong password shows an error | Pass |
| 2 | Renewal saved | Pass |
| 3 | Previous version kept in history | Pass |
| 4 | PDF opens in the viewer | Pass |
| 5 | Fake PDF rejected by the server | Pass |
| 6 | HR review sends the request for approval | Pass |
| 7 | Employee created with a server-assigned number | Pass |
| 8 | Management approves leave | Pass |
| 9 | AI summarises HR and fleet together | Pass |
| 10 | Management receives escalations / approvals | Pass |
| 11 | Audit records the renewal | Pass |
| 12 | Audit records the document view | Pass |
| 13 | Asset history loads | Pass |
| 14 | Fleet user blocked from the HR page | Pass |
| 15 | Fleet user blocked from the HR API (403) | Pass |
| 16 | Renewal action updated | Pass |
| 17 | Department Head sees own department only, no documents, no date of birth | Pass |
| 18 | Insurance Officer sees insurance documents only | Pass |
| 19 | System health page | Pass |
| 20 | Temporary password shown once | Pass |
| 21 | Administrator blocked from HR content (403) | Pass |
| 22 | Forced password change at first sign-in | Pass |
| 23 | New user signed in after changing password | Pass |
| 24 | No horizontal scrolling on a phone | Pass |

The three browser console messages during the run (one 400, two 403) are the test's deliberate negative checks.

## 3. Fresh production install

Production bundle with production-only dependencies (as in the Docker image), empty database:

| Check | Result |
|---|---|
| Migrations `001`–`003` applied automatically | Pass |
| First administrator created with a one-time temporary password; no demo data | Pass |
| Administrator must set a password at first sign-in | Pass |
| Administrator creates an HR user; HR user sets their password | Pass |
| HR creates an employee, uploads a passport scan | Pass |
| A passport expiring in 21 days appears as Urgent in the Attention Centre | Pass |
| Security headers: CSP, X-Frame-Options, nosniff, Referrer-Policy | Pass |
| System health shows AI status (rules engine only) and the latest backup | Pass |

## 4. Backup and restore

| Check | Result |
|---|---|
| `backup.sh` writes database dump, document archive and manifest | Pass |
| `restore-test.sh` restores to a scratch database; counts and checksums match (249 / 126 / 2,595 / 2,577 / 513) | PASS |
| Disaster recovery: leave records deleted and 500 documents removed, then `restore.sh`: all 50 leave records and 2,577 documents back; documents open in the application | Pass |
| Backup of a fresh install with no documents folder yet | Pass |

## 5. Performance

Demo data: 249 employees, 126 assets, 2,595 document versions. Production mode, one application instance, 2 vCPU.

| Measure | Result |
|---|---|
| Single user, sequential | Full data load (`bootstrap`, 1.2 MB) 36 ms; Attention Centre 14 ms; dashboard 11 ms; search 7 ms (medians) |
| 50 users all requesting the heaviest pages at the same instant, 10 requests each (500 requests) | 0 errors; median 335 ms, 95th percentile 792 ms; finished in 3.9 s |

Before the record cache was added, the same burst took a 1.6 s median, so the cache made it about 4× faster. For more users, run a second application instance (see [DEPLOYMENT.md](DEPLOYMENT.md), `JOBS_ENABLED`).

## 6. Not tested here

- **Docker image build and the running compose stack.** The build environment could not download base images. `docker compose config` validates the file, and the image's install step was reproduced exactly outside Docker. The CI workflow (`.github/workflows/ci.yml`) builds the image on every push.
- **Live e-mail delivery.** Needs Adroit's SMTP account. Use **System health → Test SMTP connection** during setup.
- **A live AI provider call.** Needs an API key; the adapter is tested against a mock of the provider's API.
- **User acceptance testing** with Management, HR, PRO, Insurance and Transport (§17.1). To be done by Adroit before rollout.
