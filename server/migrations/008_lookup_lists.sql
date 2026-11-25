-- Migration 008: user-extendable item lists (nationality, insurance plan, emirate, vehicle usage, leave type).
-- The built-in values stay in code; items users add with the "+" button are stored here.

CREATE TABLE IF NOT EXISTS lookup_values (
  list        text NOT NULL,
  value       text NOT NULL,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS lookup_values_uq ON lookup_values (list, lower(value));

-- leave types are no longer limited to Annual / Emergency / Sick
ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_type_check;
