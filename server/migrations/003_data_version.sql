-- Change counter for the record cache: any write to the tables the employee / asset loaders read bumps it.
-- Statement-level triggers, so a bulk import bumps it once per statement, not per row.
CREATE TABLE IF NOT EXISTS data_version (id int PRIMARY KEY CHECK (id = 1), v bigint NOT NULL DEFAULT 0);
INSERT INTO data_version (id, v) VALUES (1, 0) ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION bump_data_version() RETURNS trigger AS $$
BEGIN
  UPDATE data_version SET v = v + 1 WHERE id = 1;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['employees', 'assets', 'documents', 'document_versions', 'files', 'expiry_actions'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_bump_version ON %I', t, t);
    EXECUTE format('CREATE TRIGGER %I_bump_version AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION bump_data_version()', t, t);
  END LOOP;
END $$;
