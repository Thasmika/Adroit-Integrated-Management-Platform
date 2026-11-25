-- Migration 006: Add "Other" as a visa sponsoring company (MOL code 0)
-- for employees whose visa is sponsored outside the Adroit group.

INSERT INTO companies (id, name, short, kind, active, mol_code)
VALUES ('C10', 'Other', 'Other', 'Group company', true, '0')
ON CONFLICT DO NOTHING;
