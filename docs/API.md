# API reference

JSON over HTTPS, same origin as the web app. Grouped by the service boundaries in technical proposal §14.

**Conventions**

- Authentication is a session cookie (`adroit_sid`) set by `POST /api/auth/login`.
- Every request that changes data (POST / PUT) must send the header `x-adroit-client: web` (CSRF defence).
- Errors return `{ "error": "<message for the user>", "code": "<machine code>" }` with an HTTP status: `400` validation, `401` not signed in, `403` not permitted, `404` not found or outside your access, `409` duplicate, `423` account locked, `429` too many attempts, `503` AI switched off.
- Permissions are applied to every response. Records outside a user's scope return `404`, and document types they may not see are left out.

## Authentication / authorization

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/login` | `{email, password}`; starts a session |
| POST | `/api/auth/logout` | Ends the session |
| GET | `/api/auth/me` | Current user, role, scope; `mustChangePassword` |
| POST | `/api/auth/change-password` | `{currentPassword, newPassword}` |

## Reference data, dashboard, search, notifications

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness and database check (no sign-in) |
| GET | `/api/public-info` | Organisation name, demo flag (no sign-in) |
| GET | `/api/bootstrap` | Everything the web app needs for the signed-in user: configuration, permitted employees, assets and leave |
| GET | `/api/dashboard` | Aggregated KPIs for the Management Home |
| GET | `/api/attention` | Attention items (expired / urgent / due / monitor / missing) with owner, officer and action status |
| GET | `/api/search?q=` | Unified scoped search: employees, assets, documents |
| GET | `/api/notifications` | The user's alerts and unread count |
| POST | `/api/notifications/:id/read`, `/api/notifications/read-all` | Mark read |

## Employees and leave

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/employees`, `/api/employees/:no` | List / one employee (`:no` = the employee number, e.g. `EMP 0115`, URL-encoded) with permitted documents |
| POST | `/api/employees` | Create (HR Officer). `empNo` (employee number) is required and unique; `empCode` and `molId` (Emp (MOL) ID, unique) are optional |
| PUT | `/api/employees/:no` | Update (HR Officer); changes audited with before → after |
| POST | `/api/employees/:no/photo` | Multipart image upload |
| PUT | `/api/employees/:no/mol` | Set the Emp (MOL) ID `{ molId }` (HR Officer); unique; audited |
| PUT | `/api/companies/:id/mol` | Set a company's MOL code `{ molCode }` (HR Officer, System Administrator); unique per company; returns the configuration |
| GET | `/api/leave` | Leave requests in scope |
| POST | `/api/leave` | Submit a request (HR Officer, Department Head) |
| POST | `/api/leave/:id/review` | HR review → Pending Approval |
| POST | `/api/leave/:id/approve` | Management approval |
| POST | `/api/leave/:id/reject` | Reject (reason required) |
| POST | `/api/leave/:id/rejoin` | Record the rejoining date |

## Assets (vehicles and machines)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/assets`, `/api/assets/:no` | List / one asset (`VH-0108`) with permitted documents |
| GET | `/api/assets/:no/history` | Asset timeline |
| POST | `/api/assets` | Create (Fleet / Transport Officer) |
| PUT | `/api/assets/:no` | Update, including lifecycle status |
| POST | `/api/assets/:no/photo` | Multipart image upload |

## Documents and renewal actions (both modules)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/documents/:module/:owner/:type` | Multipart: `mode=upload` (record details and/or scan) or `mode=renew` (new version supersedes the current one, which moves to history; the open action completes). Fields: `ref, issuer, issued, expiry, name, file` |
| PUT | `/api/actions/:module/:owner/:type` | Update the renewal action status and note |
| GET | `/api/documents/:module/:owner/:type/actions` | Action history |
| GET | `/api/files/:id` | Stream a stored file after the permission check; every view is audited |

`:module` is `hr` or `fleet`; `:owner` is the employee or fleet number; `:type` is the document type (URL-encoded).

## AI assistance

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/ai/ask` | `{question}`. Read-only, permission-filtered answer with the records it used; `engine` says whether the AI provider or the rules engine produced it. See [AI.md](AI.md). |

## Data import

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/import/template/employees`, `/api/import/template/assets` | CSV template |
| POST | `/api/import/employees?mode=validate`, `…?mode=commit` (same for `assets`) | Multipart CSV upload; `validate` writes nothing, `commit` imports only rows that pass |
| GET | `/api/import/batches` | Import log |

## Administration and audit

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/config` | Full configuration |
| PUT | `/api/admin/doc-types/:key` | Thresholds, required, expires, officer |
| POST / PUT | `/api/admin/lists/:list`, `/api/admin/lists/:list/:key` | Companies, departments, locations, categories |
| POST / PUT | `/api/admin/users`, `/api/admin/users/:id` | Create / update users (create returns a temporary password) |
| POST | `/api/admin/users/:id/reset-password` | New temporary password |
| PUT | `/api/admin/templates/:id` | Notification template |
| PUT | `/api/admin/system` | System settings |
| GET | `/api/admin/health` | System health |
| POST | `/api/admin/email/verify` | Test the SMTP connection |
| POST | `/api/admin/jobs/:job/run` | Run `expiry`, `digest` or `mail` now |
| GET | `/api/audit` | Audit events with filters (Administrator, Management, Auditor) |
