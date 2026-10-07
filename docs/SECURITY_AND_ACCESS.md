# Security and access control

Technical proposal §4, §9 and §15. All rules are enforced by the server on every request. The web app hides what a user can't do, but it is never the only check.

## Roles

Access is denied by default. Each role grants modules, actions and, where needed, an organisational scope.

| Area | System Administrator | Management | HR Officer | PRO / Compliance | Insurance Officer | Department Head | Fleet / Transport | Read-Only Auditor |
|---|---|---|---|---|---|---|---|---|
| Employee records | – | View | Create, edit | View | View | Own department, limited fields | – | View |
| Employee documents | – | View | All, upload, renew | Passport, Visa, Emirates ID | Health insurance | – | – | View |
| Leave | – | Approve / reject | Submit, HR review, rejoining | View | View | Submit, rejoining (own dept) | – | View |
| Fleet records | – | View | – | – | View | – | Create, edit | View |
| Fleet documents | – | View | – | – | Motor insurance | – | All, upload, renew | View |
| Document view / download | – | Yes | HR | Own types | Own types | – | Fleet | Yes |
| AI assistant | – | Both modules | HR | HR (own types) | Own types | Own department | Fleet | Both modules |
| Administration | Yes | – | – | – | – | – | – | – |
| Audit log | Yes | Yes | – | – | – | – | – | Yes |

- The System Administrator manages users, masters and configuration but **cannot open employee records or documents** (§4).
- A Department Head sees only their own department, without gender, date of birth, e-mail, emergency contact, home address, notes, insurance details or any documents.
- Sensitive employee documents can't be found by fleet-only users, not even through search or the AI assistant (§4.1).
- Role names and permissions are a §19 confirmation item. They are defined in one place: `packages/core/src/core/shared.js` (`ROLES`) and `packages/core/src/core/access.js`.

## Sign-in and sessions

| Control | Setting |
|---|---|
| Passwords | bcrypt hashes. At least 10 characters with letters and a number (configurable). |
| New users and resets | One-time temporary password; the user must set their own at first sign-in. |
| Lockout | 5 wrong passwords lock the account for 15 minutes. Every failure is audited. |
| Rate limit | `LOGIN_RATE_LIMIT` sign-in attempts per minute per IP address (default 10). |
| Sessions | Server-side, random token stored hashed. HttpOnly, SameSite=Strict, Secure cookie. Lifetime `SESSION_HOURS` (default 10). Deactivating a user or resetting a password ends their sessions. |
| CSRF | SameSite=Strict cookie plus a required custom header on every change request. |

## Documents and files (§9)

- Files are stored under system-generated keys in a private folder, never at a public URL. The original file name is kept as metadata only.
- Every view or download is permission-checked by the application and written to the audit log.
- File content is checked by its bytes (PDF, JPG, PNG, TIFF, HEIC signatures), not by the name, and against the allowed types and size set in Administration.
- Every file belongs to exactly one record and one document version. The record and file are written in one transaction, and a failed save leaves no orphan file.
- Renewal supersedes the current version and keeps the old one in history. Documents are never hard-deleted through the application.

## Audit trail

- Records sign-ins (including failures), creates, updates with before → after values, uploads, document views, renewals, leave decisions, configuration changes, imports, job runs and AI questions.
- Append-only: a database trigger refuses `UPDATE` and `DELETE` on `audit_events`, even for the application's own account.
- Viewable in **Audit log** by Administrators, Management and Auditors.

## Transport and headers

- HTTPS terminated by Caddy or nginx. HSTS is on when `COOKIE_SECURE=true`.
- Content Security Policy restricted to the application's own origin (plus Google Fonts), `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
- Request body limit 2 MB for JSON, 60 MB for uploads (the configured file limit applies first).
- Logs redact passwords and cookies.

## Recommendations before go-live

- Put the server behind the company firewall or VPN if the system does not need to be reachable from outside.
- Keep `.env` / `adroit.env` readable by root and the service account only (`chmod 600`).
- Copy backups off the server daily; test restores monthly ([BACKUP_RESTORE.md](BACKUP_RESTORE.md)).
- Apply OS and Node.js security updates monthly; rebuild the Docker image to pick up base-image fixes.
