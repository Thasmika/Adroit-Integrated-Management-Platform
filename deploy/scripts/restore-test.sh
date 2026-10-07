#!/bin/sh
# Proves the latest backup can be restored (§17 "Backup Restore": test restore succeeds before go-live).
# Restores into a scratch database and a temporary folder, compares counts with the manifest, then cleans up.
# Does not touch the live database or documents.
set -eu
BACKUP_DIR="${BACKUP_DIR:-./backups}"
LIVE_DB="${PGDATABASE:?set PGDATABASE}"
TEST_DB="${LIVE_DB}_restore_test"
MANIFEST="$(ls -1t "$BACKUP_DIR"/adroit-*.manifest 2>/dev/null | head -1)"
[ -n "$MANIFEST" ] || { echo "no backups found in $BACKUP_DIR"; exit 1; }
DB_FILE="$BACKUP_DIR/$(grep '^database=' "$MANIFEST" | cut -d= -f2)"
FILES_FILE="$BACKUP_DIR/$(grep '^files=' "$MANIFEST" | cut -d= -f2)"
echo "[restore-test] using $(basename "$MANIFEST")"
[ "$(sha256sum "$DB_FILE" | cut -d' ' -f1)" = "$(grep '^sha256_database=' "$MANIFEST" | cut -d= -f2)" ] || { echo "FAIL database checksum"; exit 1; }
[ "$(sha256sum "$FILES_FILE" | cut -d' ' -f1)" = "$(grep '^sha256_files=' "$MANIFEST" | cut -d= -f2)" ] || { echo "FAIL files checksum"; exit 1; }
psql -q -d postgres -c "DROP DATABASE IF EXISTS \"$TEST_DB\"" -c "CREATE DATABASE \"$TEST_DB\""
pg_restore --no-owner --dbname="$TEST_DB" "$DB_FILE"
GOT="$(PGDATABASE="$TEST_DB" psql -At -F ' ' -c "SELECT (SELECT count(*) FROM employees), (SELECT count(*) FROM assets), (SELECT count(*) FROM document_versions), (SELECT count(*) FROM files), (SELECT count(*) FROM audit_events)")"
WANT="$(grep '^counts' "$MANIFEST" | cut -d= -f2)"
TMP="$(mktemp -d)"; tar -xzf "$FILES_FILE" -C "$TMP"
FILES_GOT="$(find "$TMP" -type f | wc -l | tr -d ' ')"; FILES_WANT="$(grep '^file_count=' "$MANIFEST" | cut -d= -f2)"
rm -rf "$TMP"
psql -q -d postgres -c "DROP DATABASE IF EXISTS \"$TEST_DB\""
echo "[restore-test] records  backup: $WANT | restored: $GOT"
echo "[restore-test] files    backup: $FILES_WANT | restored: $FILES_GOT"
if [ "$GOT" = "$WANT" ] && [ "$FILES_GOT" = "$FILES_WANT" ]; then echo "[restore-test] PASS"; else echo "[restore-test] FAIL"; exit 1; fi
