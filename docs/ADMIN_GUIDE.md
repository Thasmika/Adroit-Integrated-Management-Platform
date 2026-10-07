# Administrator guide

For the System Administrator. Everything here is under **Administration** in the menu. Every change is recorded in the audit log.

## Users and roles

**Administration → Users & roles**

- **Add a user**: name, e-mail, role, and department for a Department Head. The system shows a one-time temporary password; give it to the user privately. They must choose their own password at first sign-in.
- **Change a role** or **department scope** with the selectors in the list.
- **Deactivate** a user who leaves. Their sessions end immediately; their history stays.
- **Reset password** issues a new temporary password.
- If the only administrator is locked out, reset from the server console:
  - Docker: `docker compose exec app node dist/cli.mjs reset-password it.admin@adroit.ae`
  - systemd: `cd /opt/adroit/server && sudo -u adroit env $(cat /etc/adroit/adroit.env | xargs) node dist/cli.mjs reset-password it.admin@adroit.ae`

The permissions of each role are listed on the same page and in [SECURITY_AND_ACCESS.md](SECURITY_AND_ACCESS.md).

## Reference masters

**Administration → Companies, departments & locations**

Add, rename or deactivate group companies, departments, branches / locations and vehicle categories. Deactivated values stay on existing records but can't be chosen for new ones. New vehicle categories need no code change.

## Document types and thresholds

**Administration → Document types & thresholds**

For each document type:

- **Expires**: whether it has an expiry date (a qualification certificate does not).
- **Required**: for HR types, required for every employee; for fleet types, the vehicle categories that must have it. Missing required documents appear in the Attention Centre.
- **Urgent / Warning / Monitor** (days): drive the statuses Urgent, Renewal due and Monitor. They must increase: urgent ≤ warning ≤ monitor.

A change takes effect immediately for every screen and at the next expiry run.

## Responsible officers

**Administration → Responsible officers**

Each document type is routed to one user. That user receives the alerts and owns the renewal actions for it. Assign an officer to every expiring type before switching on alerts.

## Notification templates

**Administration → Notification templates**: the title of each alert. Placeholders such as `{docType}`, `{owner}`, `{expiry}`, `{days}` and `{ref}` are filled in automatically.

## System configuration

**Administration → System configuration**

| Setting | Effect |
|---|---|
| Maximum file size, allowed file types | Applied to every upload |
| Retention period | Recorded policy (pending management confirmation) |
| **Expiry alerts** | Master switch for alerts. Leave off until the migrated data and officers are verified. |
| In-app alerts / Email alerts | Delivery channels. E-mail also needs SMTP settings on the server. |
| Escalate expired documents to Management | Management is also notified once a document has expired |
| Weekly digest day | Day the management digest is sent |
| AI assistant enabled | Turns the assistant on or off; the rest of the system is unaffected |

## System health

**Administration → System health** shows:

- the application version and uptime;
- the database size and schema version;
- document storage and free space;
- the e-mail queue, with a **Test SMTP connection** button;
- AI assistant status;
- the latest backup;
- the last run of each background job, with **Run now** buttons.

Check it weekly. A failed job or a missing recent backup needs attention.

## Background jobs

| Job | When | What it does |
|---|---|---|
| Expiry | Daily 00:05 | Recalculates document statuses, opens renewal actions, assigns them to the responsible officer, creates alerts (once per stage, no duplicates), escalates expired documents, and moves approved leave to On Leave / Awaiting Rejoining by date |
| Mail | Every 5 minutes | Sends pending alert e-mails and retries failures |
| Digest | Daily 07:00, sends on the digest day | Weekly attention summary to Management |

## Audit log

**Audit log** in the menu. Filter by user, action, record type or record. Entries can't be edited or deleted.

## Data import

The HR Officer and Fleet Officer import records from CSV (**Employees → Import CSV**, **Fleet Master → Import CSV**). See [DATA_MIGRATION.md](DATA_MIGRATION.md).
