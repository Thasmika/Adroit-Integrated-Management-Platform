# ADROIT | INTEGRATED MANAGEMENT PLATFORM
*Technical Proposal | HR + Vehicle & Equipment Management | September 2026*

## ADROIT BUILDING MATERIALS TRADING ENTERPRISES L.L.C

# TECHNICAL PROPOSAL
# Integrated AI-Assisted HR, Vehicle & Equipment Management System

**Phase 1 — Developer Specification**

One secure web platform • Two operational dashboards • Shared document, expiry, alert and AI services

### Purpose
This document converts the approved management concepts into a consolidated technical scope for software design, development, testing and controlled deployment. Employee Management and Vehicle / Equipment Management are to be implemented as modules of one system, with a common login and management entry point.

| | |
|---|---|
| **Prepared for** | Management & Software Development Team |
| **Prepared date** | September 2026 |
| **Version** | 1.0 |

---

## 1. Executive Technical Summary

Adroit requires a single web-based management platform that replaces fragmented employee and fleet records with controlled digital profiles, document repositories, expiry monitoring, workflow, dashboards and AI-assisted retrieval. The source HR proposal defines a central employee profile, document centre, expiry alerts, leave workflow and management dashboard; salary/payroll/WPS are deliberately outside Phase 1. The vehicle proposal applies the same one-profile principle to more than 100 vehicles and machines, with fleet documents, compliance expiry control and management visibility.

> **INTEGRATED PHASE 1 PRINCIPLE**
> ONE PLATFORM → EMPLOYEE MODULE + VEHICLE / EQUIPMENT MODULE → SHARED DOCUMENTS + EXPIRY ENGINE + ALERTS + DASHBOARDS + SEARCH / AI

### 1.1 Primary Objectives
- Provide one authenticated web application for authorized Adroit users.
- Maintain one permanent Employee Profile for each employee and one permanent Asset Profile for each vehicle / machine.
- Store current scanned documents against the correct employee or asset record.
- Automatically calculate and display document expiry status and upcoming renewal requirements.
- Route attention items to designated responsible officers and provide management visibility.
- Digitize leave request, review, approval, vacation and rejoining records.
- Provide separate Employee and Vehicle dashboards inside one integrated home/dashboard experience.
- Provide controlled natural-language assistance for finding records, documents, expiry lists and management summaries.
- Create a modular technical foundation for later HR, fleet, workshop and cost-management extensions.

### 1.2 Explicit Phase 1 Exclusions
- Salary and payroll calculation
- WPS processing
- Accounting functions
- Vehicle maintenance/service scheduling
- Fuel monitoring
- Tyre/battery management
- Accident/fine management
- Workshop integration
- Fleet cost analysis

---

## 2. Source Requirements Consolidation

The integrated scope below preserves the functional intent of both management proposals while removing duplicated platform functions.

| Capability | Employee Module | Vehicle / Equipment Module | Shared Platform |
|---|---|---|---|
| Master record | Employee Master | Fleet / Asset Master | Common ID, status, company, department/branch concepts |
| Profile | Personal, employment, sponsorship, contact | Identity, ownership, location, operational status | Common profile navigation pattern |
| Documents | Passport, Visa, Emirates ID, Insurance, certificates | Registration, insurance, safety, inspection, permits | Shared document service + file access control |
| Expiry control | Employee compliance expiries | Fleet compliance expiries | Shared rules, status calculation, alert engine |
| Workflow | Leave + rejoining | Renewal action tracking | Shared task / action framework |
| Dashboard | HR attention dashboard | Fleet attention dashboard | Integrated management home |
| AI assistance | HR search and summaries | Fleet search and summaries | Cross-module controlled assistant |
| History | Leave/document history | Document renewal history | Audit trail and record history |

### 2.1 Organization Scope
The HR source specifies Adroit Building Materials Trading Enterprises L.L.C across 10 departments / branches, with employees potentially sponsored by Adroit or another group company. The technical data model must therefore separate Operational Company, Visa Sponsoring Company, Department and Branch/Location rather than treating them as one field.

### 2.2 Fleet Scope
The vehicle source covers more than 100 heavy vehicles, light vehicles and machines. Recommended categories are Heavy Vehicle, Light Vehicle, Trailer, Heavy Machine / Equipment and Other Company Vehicle. The model must permit additional categories without code changes.

---

## 3. Proposed Solution Architecture

The following architecture is a technical recommendation for implementation; the source management proposals intentionally did not prescribe backend technology.

| Layer | Responsibility | Recommended Characteristics |
|---|---|---|
| Web UI | Integrated home, HR dashboard, fleet dashboard, profile screens, forms | Responsive browser UI; desktop-first; role-aware navigation |
| Application/API | Business rules, workflow, search, authorization, alerts | REST/JSON or equivalent service layer; modular domain services |
| Relational Database | Employees, assets, documents, leave, tasks, users, audit | Transactional RDBMS with referential integrity and indexed expiry fields |
| Document Storage | Scanned PDFs/images and generated files | Private object/file storage; metadata in database; no public direct access |
| Background Jobs | Expiry calculations, scheduled alerts, digest generation | Reliable scheduler/queue; retry and failure logging |
| Notification Service | In-app alerts; optional email in rollout | Template-based; recipient rules; delivery status |
| AI Service | Natural-language query and summaries | Read-oriented, permission-aware tool layer; no unrestricted DB access |
| Audit / Logging | Security and operational traceability | Immutable audit events for sensitive reads/writes and workflow actions |

> **ARCHITECTURE REQUIREMENT**
> Employee and Fleet modules must not be built as two separate applications. They should share authentication, user/role administration, company/department master data, document infrastructure, expiry rules, notifications, audit logging and the management home.

### 3.1 Deployment Recommendation
- Production and test/staging environments separated.
- HTTPS only; secrets and connection strings stored outside source code.
- Automated database backups with documented restore procedure.
- Private document storage with authorization checked by the application before download/view.
- Configurable environment settings for expiry thresholds, notification channels and AI enablement.

---

## 4. Users, Roles & Access Control

Use Role-Based Access Control (RBAC), with optional department/branch scope. Final role names and permissions must be confirmed during requirements workshops.

| Proposed Role | Typical Access |
|---|---|
| System Administrator | User/role setup, reference masters, configuration; not automatically entitled to all confidential HR content. |
| Management | Integrated dashboards, summaries and authorized cross-company visibility; generally read-focused. |
| HR Officer | Employee records, HR documents, leave review, expiry follow-up. |
| PRO / Compliance Officer | Assigned visa/EID/passport or regulatory renewal actions as configured. |
| Insurance Officer | Employee/fleet insurance records and assigned expiry actions. |
| Department Head / Authorized User | Submit/review leave within permitted employee scope; limited profile visibility. |
| Fleet / Transport Officer | Fleet master, vehicle documents, compliance action tracking. |
| Read-Only Auditor / Reviewer | Explicitly authorized read-only records and audit reports. |

### 4.1 Security Rules
- Deny access by default; grant only required module, action and organizational scope.
- Separate View, Create, Edit, Delete/Deactivate, Approve and Document Download permissions.
- Sensitive employee documents must not be discoverable by unauthorized fleet-only users.
- AI answers must use the same effective permissions as the signed-in user.
- Every create/update/approval/status change/document upload should capture user, timestamp and before/after context where practical.

---

## 5. Shared Platform & Master Data

| Master / Service | Minimum Fields / Behavior |
|---|---|
| Group Company | Company ID, legal/display name, active status |
| Department | Department ID, name, company applicability, active status |
| Branch / Location | Location ID, name, company/department applicability, active status |
| User | Name, login/email, status, assigned roles, organizational scope |
| Responsible Officer Mapping | Process/document type → responsible user/role; optional company/department scope |
| Document Type | Module, name, expiry required Y/N, default warning thresholds, required Y/N |
| Status Lists | Employee status, asset status, leave status, renewal/action status |
| Notification Templates | Event, audience, subject/title, message body, channel |
| System Configuration | Expiry thresholds, file limits/types, AI settings, retention/backup parameters |

### 5.1 Integrated Home
After login, authorized users should land on a common Adroit Management Home. It should expose Employee Management and Vehicle / Equipment Management as modules, plus a shared attention area. Users only see cards and counts they are permitted to see.

| Integrated KPI / Widget | Example |
|---|---|
| Employee Records | Active employee count |
| Fleet Assets | Active vehicle/machine count |
| Expiring Documents | Combined count with module filter |
| Pending Actions | Assigned HR + fleet actions |
| Employees on Leave | Current leave count |
| Missing Documents | Employee/fleet completion issues |
| Quick Search | Employee ID/name, fleet no., registration no., document reference |
| AI Assistant | Permission-aware natural-language query entry point |

---

## 6. Employee Management Module

### 6.1 Employee Master / Profile

| Area | Required Data |
|---|---|
| Identity | Employee ID, photo, employee name, nationality, DOB, contact details |
| Employment | Employment status, designation, joining date, department, branch/location, department head |
| Company / Sponsorship | Operational company, visa sponsoring company |
| Insurance | Plan/provider/reference fields as confirmed |
| Profile Tabs | Personal, Employment, Passport, Visa, Emirates ID, Insurance, Documents, Leave |
| System Metadata | Created/updated by/date, active/inactive, notes as approved |

### 6.2 Employee Document Centre
At minimum, Phase 1 supports Passport, Employment Visa, Emirates ID, Health Insurance and other major employee documents such as qualification certificates. Each record should hold document number/reference, issue date if used, expiry date when applicable, status, current digital copy and history.

### 6.3 Employee Expiry Status

| Suggested Status | Rule (configurable) |
|---|---|
| EXPIRED | Expiry date < current date |
| URGENT | Expiry within urgent threshold, e.g. 0–30 days |
| RENEWAL DUE | Expiry within warning threshold, e.g. 31–60 days |
| MONITOR | Expiry within extended threshold if configured |
| VALID | Outside configured warning windows |
| ON FILE / N/A | Non-expiring document or expiry not applicable |

The exact day thresholds should be configuration values rather than hard-coded logic. The proposals repeatedly use a 60-day attention view, so 60 days should be supported as the initial management warning horizon.

---

## 7. Leave & Rejoining Workflow

Phase 1 must preserve a complete digital record from request to employee rejoining.

| Step | Actor | System Requirement |
|---|---|---|
| 1. Leave Request | Department Head / authorized user | Select employee, leave type, dates, reason/remarks; validate mandatory fields. |
| 2. HR Review | HR | Check record/eligibility information available in Phase 1; record review notes. |
| 3. Approval | Authorized approver | Approve or reject; capture decision, user and timestamp. |
| 4. Vacation | System / HR | Approved leave appears in current/upcoming leave views. |
| 5. Rejoining | HR / authorized user | Record actual return-to-duty/rejoining date and remarks. |
| 6. History | System | Retain complete leave transaction and status history against employee. |

### 7.1 Leave Types in Initial Scope
- Annual Leave
- Emergency Leave
- Sick Leave

### 7.2 Required Views
- Pending leave requests
- Currently on leave
- Upcoming approved leave
- Expected return dates
- Rejoining pending
- Employee leave history

> **BOUNDARY**
> The management proposal requires digital workflow and visibility but does not define leave entitlement formulas, accrual calculations, UAE statutory calculations or payroll integration. These must not be assumed in Phase 1 unless separately approved.

---

## 8. Vehicle & Equipment Management Module

### 8.1 Fleet / Asset Master

| Area | Required Data |
|---|---|
| Identity | Asset/Fleet No., registration no., category/type, make/model, year, colour, chassis/VIN, engine no., photo |
| Ownership | Owning/registered company |
| Operation | Department/branch, current location, operational status, assigned category, responsible officer |
| Profile Tabs | Overview, Registration, Insurance, Safety, Certificates, Documents, History |
| Lifecycle | Permanent profile retained through active/inactive/disposed status as business rules are confirmed |

### 8.2 Vehicle Document Centre
- Vehicle Registration
- Motor Insurance
- Safety Certificate
- Inspection / Test Certificate
- Permits / Other major documents

Each compliance document should support reference/policy number, expiry date, status, current scanned copy, responsible officer/action status and renewal history.

### 8.3 Vehicle Document Control Process
1. Record or update the document metadata.
2. Upload the current scanned digital copy.
3. Monitor the expiry date automatically.
4. Generate the appropriate alert for the responsible officer.
5. Record renewal action/progress.
6. Replace the current document with the renewed version while retaining history.

---

## 9. Shared Document Management

| Requirement | Developer Specification |
|---|---|
| File association | Every file must be linked to exactly one owning business record and document record. |
| Current vs history | Current document clearly identified; prior versions retained in history where renewal occurs. |
| Metadata | Document type, reference/no., issue/expiry dates, status, notes, upload user/date. |
| File types | Allow common scanned formats such as PDF/JPG/PNG; final allowed list and max size configurable. |
| Naming | System-generated storage key; preserve original filename as metadata. |
| Security | No public file URLs; authorization check before view/download. |
| Integrity | Prevent orphan files; handle failed upload/DB transaction consistently. |
| Preview | Browser preview where supported; otherwise secure download. |
| Deletion | Prefer controlled supersede/archive; hard delete restricted and audited. |
| Search | Search metadata; AI may locate permitted document records, not bypass storage security. |

### 9.1 Data Retention
The source proposals require history but do not define retention periods. The developer should implement archival/history capability and leave retention duration configurable/policy-driven pending management confirmation.

---

## 10. Expiry, Alerts & Action Tracking Engine

A single shared expiry service should process employee and vehicle document records. This avoids duplicated logic and ensures identical status behavior across modules.

| Function | Expected Behavior |
|---|---|
| Daily evaluation | Recalculate expiry status at least daily and on relevant record updates. |
| Thresholds | Support configurable warning windows by document type. |
| Attention list | Show expired, urgent, renewal-due and missing/required documents. |
| Assignment | Resolve designated responsible officer/role from configuration. |
| Action status | Open / In Progress / Completed or equivalent; final values confirmed with users. |
| Completion | Renewed document/update closes or completes the related action as defined. |
| Escalation | Optional management escalation/digest should be configuration-driven. |
| Audit | Record alert/action creation, assignment, status changes and completion. |

### 10.1 Example Queries
- Employees whose Visa or Emirates ID expires within the next 60 days.
- Heavy vehicles whose insurance or registration expires within the next 60 days.
- Safety certificates expiring this month.
- Employee or fleet records with missing required documents.
- All open renewal actions assigned to a selected responsible officer.

---

## 11. Dashboards, Search & Reporting

### 11.1 Employee Dashboard
- Active employee count
- Documents expiring within selected horizon
- Employees currently on leave
- Pending HR actions
- Upcoming expiries by document type
- Quick actions and employee/document search

### 11.2 Vehicle Dashboard
- Total active assets
- Documents expiring within selected horizon
- Missing documents
- Compliant assets
- Attention counts by Registration / Insurance / Safety / Permit
- Quick actions and fleet/document search

### 11.3 Integrated Management Dashboard
The integrated dashboard should aggregate permitted attention items across both modules while preserving drill-down filters: Module, Company, Department, Branch/Location, Document Type, Status, Responsible Officer and Expiry Range.

### 11.4 Search

| Search Type | Minimum Search Keys |
|---|---|
| Employee | Employee ID, name, nationality/contact where permitted |
| Vehicle | Fleet No., registration no., VIN/chassis, make/model |
| Document | Document/reference/policy no., type, owner record |
| Expiry | Date range, status, document type, company/department/location |
| Action | Responsible officer, status, due/expiry range, module |

---

## 12. AI-Assisted Search & Management Summaries

AI is an assistance layer over authorized system data, not a separate source of truth. Structured database queries and permissions must remain authoritative.

| Requirement | Technical Control |
|---|---|
| Natural-language questions | Convert user intent into approved read-only query operations or tool calls. |
| Permission enforcement | Apply user RBAC and organizational scope before data reaches the AI response. |
| Grounded answers | Return results from system records; avoid inventing missing values. |
| Document retrieval | Return authorized document links/records; do not expose raw storage paths. |
| Summaries | Generate attention summaries from retrieved structured records. |
| Write actions | Phase 1 AI should not autonomously approve leave, alter employee/asset records or complete renewals. |
| Logging | Log AI request, effective user, operation invoked and result references subject to privacy policy. |
| Failure mode | If AI is unavailable, core search, dashboards, expiry alerts and workflows must continue normally. |

### 12.1 Initial AI Use Cases
- "Show visas expiring in the next 60 days."
- "Find the insurance card for employee 0115."
- "Who is currently on annual leave?"
- "Find the insurance copy for vehicle VH-0108."
- "List heavy machines with missing documents."
- "Summarize HR and fleet document actions requiring attention this week."

---

## 13. Logical Data Model — Minimum Entities

| Entity | Purpose / Key Relationships |
|---|---|
| Company | Group/operational/registered/sponsoring company reference |
| Department | Organizational unit; linked to company where required |
| Location / Branch | Operating location |
| User / Role / Permission | Authentication authorization and scope |
| Employee | Core employee identity and employment record |
| EmployeeDocument | Employee document metadata; links to file/version/history |
| LeaveRequest | Leave transaction, workflow status and rejoining data |
| Asset | Vehicle/machine identity and operational record |
| AssetDocument | Vehicle compliance document metadata and history |
| DocumentFile / Version | Secure file metadata and version chain |
| DocumentType | Configurable type, module, expiry behavior and requirement |
| ExpiryAction / Task | Attention item, assignee, status, completion |
| Notification | Generated alert/delivery state |
| AuditEvent | Trace of sensitive business/system actions |
| AIInteraction | Optional governed log/reference of AI-assisted operations |

### 13.1 Identifier Rules
- Use internal immutable database identifiers in addition to business identifiers such as Employee ID and Fleet No.
- Employee ID and Fleet/Asset No. must be unique according to confirmed company-wide rules.
- Registration number, VIN/chassis and document numbers should be indexed where search is required; uniqueness constraints must reflect actual business rules rather than assumptions.

---

## 14. Functional API / Service Boundaries

Exact endpoint naming is implementation-dependent. The developer should preserve the following service boundaries.

| Service | Core Operations |
|---|---|
| Authentication / Authorization | Login/session, user context, role/scope checks |
| Reference Data | Companies, departments, locations, document types, statuses |
| Employees | Create/read/update/search/deactivate employee profiles |
| Employee Documents | Create metadata, upload/version/view, expiry status/history |
| Leave | Submit, review, approve/reject, list current/upcoming, rejoin, history |
| Assets | Create/read/update/search/deactivate vehicle/machine profiles |
| Asset Documents | Create metadata, upload/version/view, renewal/action history |
| Expiry / Actions | Evaluate status, list attention items, assign/update/complete |
| Dashboard | Aggregated KPI queries and drill-down datasets |
| Search | Unified scoped search across permitted modules |
| AI Assistance | Permission-aware query orchestration and summaries |
| Audit | Record/query authorized audit events |

---

## 15. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Security | HTTPS, RBAC, secure password/identity mechanism, least privilege, protected document access. |
| Performance | Dashboard and normal record/search screens should respond interactively under expected Adroit load; final SLA to be agreed. |
| Scalability | Design beyond current ~248 employee prototype figure and 100+ fleet assets without architectural redesign. |
| Availability | Business-hours reliability with documented restart/recovery process; target SLA to be agreed. |
| Backup / Recovery | Scheduled DB and document backups; restore test before production acceptance. |
| Auditability | Trace sensitive changes, approvals, uploads and status changes. |
| Usability | Consistent HR/fleet visual language, clear attention statuses, minimal training burden. |
| Browser Support | Current mainstream desktop browsers; mobile responsiveness for essential views. |
| Maintainability | Modular codebase, configuration over hard-coding, documented deployment and database migrations. |
| Observability | Application error logging, background-job monitoring and notification failure visibility. |
| Privacy | Limit employee personal/document access to authorized roles and scopes. |
| Business Continuity | Core system functions must not depend on AI availability. |

---

## 16. Data Migration & Initial Setup

The proposals describe existing standalone/manual records and separate scanned/physical files. Migration should therefore be controlled rather than treated as a simple bulk import.

1. Inventory existing employee and fleet data sources.
2. Agree field mapping and mandatory fields for each module.
3. Clean duplicates, obsolete records and inconsistent identifiers.
4. Create reference masters: companies, departments, branches/locations, document types and users.
5. Import employee and asset master records into staging.
6. Validate counts and sample records with HR / Transport responsible users.
7. Upload current documents first and link them to verified records.
8. Import expiry dates and verify attention lists before enabling notifications.
9. Historical documents may be loaded later, consistent with the vehicle proposal's recommended approach.
10. Obtain business sign-off on migrated records before production cutover.

### 16.1 Migration Controls
- Pre-import backup/snapshot
- Import log with accepted/rejected rows
- Duplicate detection
- Post-import reconciliation counts
- Business owner verification
- Rollback/re-run procedure

---

## 17. Testing & Acceptance Criteria

| Test Area | Minimum Acceptance |
|---|---|
| Login/RBAC | Users see only authorized modules, actions and scoped records. |
| Employee Profile | Create/search/open/update employee and view correct tabs/data. |
| Employee Documents | Upload/view/version documents; status reflects expiry date. |
| Leave | Request → review → approval/rejection → current leave → rejoining → history works end-to-end. |
| Asset Profile | Create/search/open/update vehicle/machine with correct company/location/status. |
| Asset Documents | Registration/insurance/safety/etc. upload and expiry/action tracking works. |
| Expiry Engine | Boundary dates and configured thresholds produce correct statuses. |
| Dashboards | Counts reconcile to underlying filtered records. |
| Alerts | Correct responsible user receives/opens assigned attention item. |
| Search | Employee/fleet/document keys return correct permitted results. |
| AI | Example approved questions return grounded, permission-filtered results; unavailable AI does not block core system. |
| Audit | Required sensitive actions create traceable audit events. |
| Migration | Agreed source totals and samples reconcile after import. |
| Backup Restore | Test restore succeeds before go-live. |

### 17.1 User Acceptance Testing
UAT should include representatives from Management, HR, PRO/compliance, Insurance and Transport/Fleet. Defects should be categorized by severity, corrected, retested and formally signed off before production rollout.

---

## 18. Recommended Implementation Plan

| Stage | Deliverable |
|---|---|
| 1. Requirements Confirmation | Field dictionary, roles, workflow decisions, document types, expiry thresholds, responsible-officer matrix. |
| 2. UX / Prototype | Integrated home, HR dashboard, employee profile, fleet dashboard, asset profile, document/expiry screens, leave screens. |
| 3. Technical Foundation | Authentication/RBAC, shared masters, DB schema, document storage, audit, deployment pipeline. |
| 4. Employee Module | Employee master, documents, expiry, dashboard, leave/rejoining. |
| 5. Fleet Module | Asset master, documents, expiry/action tracking, dashboard. |
| 6. Shared Intelligence | Unified search, integrated dashboard, AI assistance. |
| 7. Migration & UAT | Clean/import data, upload current documents, user testing, corrections. |
| 8. Controlled Rollout | Pilot user group, monitor issues, production stabilization. |
| 9. Handover | Source code, deployment/configuration docs, DB schema, admin guide, user guide, backup/restore procedure. |

> **DEVELOPMENT STRATEGY**
> Build shared services first, then implement the Employee and Fleet modules on the same platform. This is preferable to building two independent systems and attempting to merge them later.

---

## 19. Requirements Requiring Management Confirmation

The attached management proposals define the business direction but do not specify every software rule. The following items should be resolved before final development estimates and database/API freeze.

| Decision | Why Required |
|---|---|
| Final user roles and organizational access scope | Controls confidentiality and UI visibility. |
| Authentication method | Local account vs company identity provider; password/MFA policy. |
| Exact employee fields and mandatory fields | Prevents migration/rework. |
| Leave approval authority and entitlement rules | Source defines workflow, not calculation/authority detail. |
| Expiry warning thresholds by document type | 60-day view is shown, but exact urgent/monitor rules need confirmation. |
| Notification channels | In-app only vs email and escalation. |
| Responsible-officer matrix | Needed before alerts are enabled. |
| Required vs optional document types | Needed for missing-document logic. |
| File size/type limits and retention policy | Needed for storage and governance. |
| Fleet identifier uniqueness and asset lifecycle statuses | Needed for constraints/history. |
| AI provider/hosting/privacy requirements | Needed before production AI integration. |
| Hosting environment and backup policy | Needed for deployment design. |
| Expected concurrent users / SLA | Needed for capacity and support planning. |
| Data migration source formats | Needed for import tooling and effort estimate. |

---

## 20. Future Expansion — Outside Phase 1

The integrated architecture should permit later modules without including them in the present development commitment.

| HR Future Options | Fleet Future Options |
|---|---|
| Salary / payroll module | Maintenance schedules |
| Additional HR workflows | Service history |
| Performance / increment workflows | Tyre / battery records |
| Training & qualification tracking | Fuel monitoring |
| Further AI-assisted administration | Driver / operator assignment |
| — | Accident / fine records |
| — | Workshop integration |
| — | Cost analysis |

### 20.1 Recommended Phase 1 Product Name
**ADROIT INTEGRATED MANAGEMENT PLATFORM — Phase 1: Employee, Vehicle & Equipment Management**

### 20.2 Final Developer Deliverables
- Production-ready integrated web application and database.
- Employee Management and Vehicle / Equipment Management modules within one login/platform.
- Source code and dependency/build instructions.
- Database schema and migration scripts.
- Configuration and deployment documentation.
- Role/permission matrix and administrator guide.
- User guide for HR, Fleet and Management functions.
- Data import/migration utilities or documented repeatable import process.
- Test evidence and UAT issue resolution record.
- Backup/restore and operational support procedure.
- AI integration documentation, safeguards and fallback behavior if AI is enabled.

---

## Appendix A — Phase 1 Traceability Matrix

| Source Requirement | Integrated Technical Location |
|---|---|
| Employee Master | Sections 6, 13, 14 |
| Employee documents | Sections 6, 9 |
| Employee expiry monitoring | Sections 6, 10 |
| Leave/rejoining | Section 7 |
| HR dashboard | Section 11 |
| Fleet/asset master | Section 8 |
| Vehicle compliance documents | Sections 8, 9 |
| Fleet expiry/action tracking | Sections 8, 10 |
| Fleet dashboard | Section 11 |
| Shared management entry point | Section 5 |
| AI-assisted search/summaries | Section 12 |
| Management visibility | Sections 5, 11 |
| Controlled rollout | Section 18 |
| Future extensibility | Section 20 |

## Appendix B — Developer Interpretation Notes

- All example employee/fleet counts and sample IDs shown in the management proposals are prototype examples unless confirmed as production data.
- Technical architecture, RBAC detail, API boundaries, database entities, security controls and acceptance criteria in this document are implementation recommendations derived from the business scope; they were not prescribed in the original management proposals.
- Where a business rule is not defined by the source proposals, this proposal marks it as configurable or requiring management confirmation rather than silently fixing a rule.
