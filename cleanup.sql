BEGIN;

-- Check if K Nimal Premaratne exists, just for safety
-- (If not, we still proceed, but good to know)

-- Leaves
DELETE FROM leave_requests WHERE employee_id IN (SELECT id FROM employees WHERE name != 'K Nimal Premaratne');

-- Employees
DELETE FROM employees WHERE name != 'K Nimal Premaratne';

-- Assets
DELETE FROM assets;

-- Orphaned Documents
DELETE FROM documents WHERE owner_module = 'hr' AND owner_id NOT IN (SELECT id FROM employees);
DELETE FROM documents WHERE owner_module = 'fleet';

-- Orphaned Files
DELETE FROM files WHERE owner_module = 'hr' AND owner_id NOT IN (SELECT id FROM employees);
DELETE FROM files WHERE owner_module = 'fleet';

COMMIT;
