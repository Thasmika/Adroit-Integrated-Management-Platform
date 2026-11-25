-- Migration 007: allow several documents of the same type per owner (e.g. many Qualification Certificates).
-- Types flagged "multi" can hold any number of documents, told apart by their name.

ALTER TABLE document_types ADD COLUMN IF NOT EXISTS multi boolean NOT NULL DEFAULT false;
UPDATE document_types SET multi = true WHERE key IN ('Qualification Certificate', 'Other Permit');

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_owner_module_owner_id_type_key;
CREATE UNIQUE INDEX IF NOT EXISTS documents_owner_type_name_uq ON documents (owner_module, owner_id, type, lower(name));
