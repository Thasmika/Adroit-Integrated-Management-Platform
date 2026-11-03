-- Migration 005: Add photo-page document types missing from the database.
-- These types exist in DOC_TYPES_INIT (shared.js) but were never seeded via migration,
-- causing 400 FK-violation errors when uploading Passport Page 2/3 or Emirates ID Back.

INSERT INTO document_types (key, module, short, expires, required, required_for, urgent_days, due_days, monitor_days, officer_user_id, sort)
VALUES
  ('Passport Page 2',  'hr', 'PP2',  false, false, '{}', 0, 0, 0, (SELECT id FROM users WHERE id = 'u-pro'), 0),
  ('Passport Page 3',  'hr', 'PP3',  false, false, '{}', 0, 0, 0, (SELECT id FROM users WHERE id = 'u-pro'), 0),
  ('Emirates ID Back', 'hr', 'EID2', false, false, '{}', 0, 0, 0, (SELECT id FROM users WHERE id = 'u-pro'), 0)
ON CONFLICT (key) DO NOTHING;
