# Changes Report 01: Employee Management

Implemented October 2026. Database change: `server/migrations/004_changes_report_01.sql` runs automatically when the application starts. It only adds columns, indexes and the Labour Card document type, and existing records are kept.

| # | Request | What changed |
|---|---|---|
| 1 | The user enters the employee number when adding an employee | The Add employee form has a required **Employee number**. It must be unique (case-insensitive) and cannot be changed after the record is created. The system no longer generates numbers. CSV import now requires `emp_no`. |
| 1 | Add an Employee code | There is an optional **Employee code** on the form. It is shown in the employee list, the profile and search, and it can be edited later. |
| 2 | Table: Company Name → MOL Code | `companies.mol_code` is unique per company. It is maintained in **Employee Management → MOL Register** by HR or the System Administrator, and it is also shown under Administration → Masters. |
| 2 | Table: Employee Name → Emp (MOL) ID | `employees.mol_id` is unique per employee. It is entered on the employee form, edited in place in the MOL Register, and can be searched. It is hidden from Department Heads. |
| 2 | New profile card: Labour Card | There is a new **Labour Card** tab, so the profile now has 9 cards. The tab shows the Emp (MOL) ID, the sponsoring company's MOL code, and the labour card itself (number, issue and expiry dates, scan, renewal and history). Labour Card is a new HR document type with expiry alerts. The PRO officer handles it, using the same officer as Emirates ID. |
| 3 | Dates as dd/mm/yyyy everywhere | Every displayed date uses dd/mm/yyyy. This covers tables, profiles, dashboards, the AI assistant, notifications, e-mails and audit text. Every date field is typed as dd/mm/yyyy, and has a calendar button. CSV import takes DD/MM/YYYY, and impossible dates such as 31/02 are rejected. |
| 4 | Employees page: remove "All branches / locations" | Removed. |
| 5 | Employees page: add Sponsor, Employee Code, Company Names | The filters are now **All companies (n)**, **All sponsors**, **All employee codes**, nationality and status. The company and sponsor filters list every company in Administration → Companies. |
| 5 | Remove "Any visa sponsor" and "Any document status" | Both removed. Document status is still available in Documents & Expiry and the Attention Centre. |
| 5 | Remove "On Notice" from the status choices | Removed from the status filter and from the form. Employees who already have "On Notice" keep it until HR changes it. Their status is still shown, and it stays selectable on their own edit form. |

## Decisions made while implementing (confirm or change)

- **Labour Card is not a required document by default.** Making it required would flag every employee without one as "missing". To change this, go to Administration → Document types & thresholds → Labour Card → Required.
- **Employee code** is free text. The Employee Code filter lists the codes that are in use.
- **Page links** for employee numbers that don't follow the `EMP 0001` pattern look like `#hr-employee.~ADR-7001`. Older links such as `#hr-employee.0115` keep working.
- **The demo data** (`npm run seed:demo`) now includes employee codes (STF, DRV, TEC, LAB), Emp (MOL) IDs, company MOL codes and labour cards. Its "On Notice" employees are now "Inactive".
