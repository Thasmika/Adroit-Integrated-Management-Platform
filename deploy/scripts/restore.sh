#!/bin/sh
# Restores a backup made by backup.sh. THIS REPLACES THE CURRENT DATABASE AND DOCUMENTS.
#   restore.sh <adroit-YYYYmmdd-HHMM.dump> <adroit-files-YYYYmmdd-HHMM.tar.gz> [--yes]
# Stop the application first (docker compose stop app), run this, then start it again.
# Uses PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE and FILES_DIR like backup.sh.
set -eu
DB_FILE="${1:?usage: restore.sh <db.dump> <files.tar.gz> [--yes]}"
FILES_FILE="${2:?usage: restore.sh <db.dump> <files.tar.gz> [--yes]}"
FILES_DIR="${FILES_DIR:-./data/files}"
[ -f "$DB_FILE" ] || { echo "not found: $DB_FILE"; exit 1; }
[ -f "$FILES_FILE" ] || { echo "not found: $FILES_FILE"; exit 1; }
if [ "${3:-}" != "--yes" ]; then
  printf 'Restore into database "%s" and replace documents in %s? Type RESTORE to continue: ' "${PGDATABASE:-?}" "$FILES_DIR"
  read -r answer
  [ "$answer" = "RESTORE" ] || { echo "cancelled"; exit 1; }
fi
MANIFEST="$(dirname "$DB_FILE")/$(basename "$DB_FILE" .dump).manifest"
if [ -f "$MANIFEST" ]; then
  want=$(grep '^sha256_database=' "$MANIFEST" | cut -d= -f2)
  have=$(sha256sum "$DB_FILE" | cut -d' ' -f1)
  [ "$want" = "$have" ] || { echo "checksum mismatch for $DB_FILE"; exit 1; }
fi
echo "[restore] database <- $DB_FILE"
# the audit table refuses UPDATE/DELETE; --clean drops and recreates it, which is allowed
pg_restore --clean --if-exists --no-owner --single-transaction --dbname="${PGDATABASE}" "$DB_FILE"
echo "[restore] documents <- $FILES_FILE"
mkdir -p "$FILES_DIR"
TMP="$FILES_DIR.restore-$$"
mkdir -p "$TMP" && tar -xzf "$FILES_FILE" -C "$TMP"
find "$FILES_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
( cd "$TMP" && tar -cf - . ) | ( cd "$FILES_DIR" && tar -xf - )
rm -rf "$TMP"
echo "[restore] done. Start the application and check Administration -> System health."
