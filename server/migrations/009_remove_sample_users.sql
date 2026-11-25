-- Migration 009: remove the made-up sample users from the initial setup (they are not real staff).
-- Accounts that have never logged in are deactivated (kept only for audit-trail integrity; can be
-- re-enabled in Administration → Users) and are no longer shown as responsible officers anywhere.

CREATE TEMP TABLE sample_users ON COMMIT DROP AS
  SELECT id FROM users
   WHERE id IN ('u-gm', 'u-hr', 'u-pro', 'u-ins', 'u-dh', 'u-trn', 'u-hse', 'u-aud')
     AND last_login_at IS NULL;

UPDATE document_types SET officer_user_id = NULL WHERE officer_user_id IN (SELECT id FROM sample_users);
UPDATE expiry_actions SET assigned_to = NULL WHERE assigned_to IN (SELECT id FROM sample_users);
DELETE FROM sessions WHERE user_id IN (SELECT id FROM sample_users);
UPDATE users SET active = false WHERE id IN (SELECT id FROM sample_users);
