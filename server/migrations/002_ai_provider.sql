-- Record which path answered each AI question (§12 logging): the configured provider or the rules engine.
ALTER TABLE ai_interactions ADD COLUMN IF NOT EXISTS engine text NOT NULL DEFAULT 'rules';
ALTER TABLE ai_interactions ADD COLUMN IF NOT EXISTS routed_as text;
CREATE INDEX IF NOT EXISTS ai_interactions_at_idx ON ai_interactions (at DESC);
