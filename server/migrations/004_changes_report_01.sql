-- Changes Report 01 (Employee Management)
--  1) Employee number is entered by the user (emp_no already exists and stays unique); new Employee Code.
--  2) MOL register: each company has a unique MOL code; each employee has an Emp (MOL) ID.
--     Labour Card is a new HR document type with its own profile tab.

-- Employee code and Emp (MOL) ID
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emp_code text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS mol_id   text;
CREATE INDEX IF NOT EXISTS employees_code_idx ON employees (emp_code);
CREATE UNIQUE INDEX IF NOT EXISTS employees_mol_id_uq ON employees (lower(mol_id)) WHERE mol_id IS NOT NULL;

-- Company MOL code (unique per company)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS mol_code text;
CREATE UNIQUE INDEX IF NOT EXISTS companies_mol_code_uq ON companies (lower(mol_code)) WHERE mol_code IS NOT NULL;

-- Labour Card document type, placed after Emirates ID, handled by the same officer as Emirates ID.
-- On a new database the document types do not exist yet; the seed then creates Labour Card with the others.
UPDATE document_types SET sort = sort + 1
 WHERE sort >= 3 AND NOT EXISTS (SELECT 1 FROM document_types WHERE key = 'Labour Card');
INSERT INTO document_types (key, module, short, expires, required, required_for, urgent_days, due_days, monitor_days, officer_user_id, sort)
SELECT 'Labour Card', 'hr', 'LC', true, false, '{}', 30, 60, 90, (SELECT officer_user_id FROM document_types WHERE key = 'Emirates ID'), 3
 WHERE EXISTS (SELECT 1 FROM document_types)
ON CONFLICT (key) DO NOTHING;
