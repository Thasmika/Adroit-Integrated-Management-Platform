# Data migration

How to load the existing employee and fleet records into the platform (technical proposal §16). Migration is controlled, not a single bulk load: validate first, fix, then import, and have the business owners check the result.

## Process

1. **Inventory**: list where employee and fleet data lives today (spreadsheets, files, PRO records, insurance lists).
2. **Reference masters first**: in **Administration → Companies, departments & locations**, make sure every company, department, branch and vehicle category used in the data exists. A new installation contains only Adroit Building Materials as a company, so add the group companies first. The import refuses rows that refer to unknown values.
3. **Take a backup** (`backup.sh`). It gives you a restore point to roll back to.
4. **Download the template**: **Employees → Import CSV** (HR Officer) or **Fleet Master → Import CSV** (Fleet / Transport Officer), then **Download CSV template**.
5. **Fill the template** from the cleaned source data. Save as CSV (UTF-8).
6. **Validate**: upload and click **Validate**. Nothing is written. The result lists every row as accepted or rejected, with the reason.
7. **Fix and re-validate** until the rejected rows are either fixed or deliberately left out.
8. **Import**: only rows that pass every check are written, in one transaction per batch. The batch and its accepted / rejected counts are kept in the import log and the audit trail.
9. **Reconcile**: compare the totals shown after import with the source counts, and have HR / Transport check a sample of records.
10. **Upload current scans** against the imported records. Historical versions can be added later.
11. **Verify attention lists** in the Attention Centre before switching on expiry alerts.
12. **Sign-off** by the business owners before go-live.

## Employee template columns

`emp_no, emp_code, mol_id, name, gender, nationality, dob, department, location, designation, mobile, email, status, joined, company, sponsor, dept_head, insurance_plan, insurance_provider, emergency_contact, home_address, passport_no, passport_issued, passport_expiry, visa_no, visa_issued, visa_expiry, eid_no, eid_issued, eid_expiry, labour_card_no, labour_card_issued, labour_card_expiry, insurance_no, insurance_expiry`

- Required: `name, department, designation, company, sponsor`.
- `emp_no`: required. Employee numbers are entered by HR, not generated; each must be unique.
- `emp_code`: optional employee code. `mol_id`: optional Emp (MOL) ID, unique per employee.
- `company` is the operational company; `sponsor` is the visa-sponsoring company. Both must match a company name in Administration.
- Dates: `DD/MM/YYYY` (the system standard). Older files in `YYYY-MM-DD` are still accepted.
- A document expiry without its number is rejected.

## Asset template columns

`fleet_no, category, make, model, body, year, colour, emirate, plate, vin, engine, capacity, company, department, location, status, usage, officer, acquired, odometer, remarks, registration_no, registration_expiry, insurance_policy, insurer, insurance_expiry, safety_no, safety_expiry, inspection_no, inspection_expiry, permit_name, permit_no, permit_expiry`

- Required: `category, make, model, vin, company, department`.
- `plate` is required except for `Heavy Machine / Equipment`.
- `fleet_no`: leave empty to assign the next `VH-` number, or give the existing one.

## Checks applied to every row

| Check | Result |
|---|---|
| Required columns present | Whole file refused, with the list of missing columns |
| Company, department, location, category exist and are active | Row rejected |
| Dates readable | Row rejected, with the value shown |
| Employee number / fleet number already exists | Row rejected |
| Same name and date of birth as an existing employee | Row rejected (likely duplicate) |
| Same chassis / VIN or plate as an existing asset | Row rejected, naming the existing fleet number |
| Duplicate within the same file | Row rejected |
| Document expiry given without a document number | Row rejected |

## Rollback

If an imported batch turns out to be wrong, restore the backup taken in step 3 ([BACKUP_RESTORE.md](BACKUP_RESTORE.md)), fix the file and import again.
