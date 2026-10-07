#!/bin/sh
# Backup of the database and the document store (§15 backup / recovery).
# Uses the standard PostgreSQL variables: PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE
#   FILES_DIR        document store to archive           (default ./data/files)
#   BACKUP_DIR       where backups are written           (default ./backups)
#   BACKUP_KEEP_DAYS delete backups older than this      (default 30)
# Produces: adroit-YYYYmmdd-HHMM.dump, adroit-files-YYYYmmdd-HHMM.tar.gz and a .manifest with counts and checksums.
set -eu
FILES_DIR="${FILES_DIR:-./data/files}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP="${BACKUP_KEEP_DAYS:-30}"
STAMP="$(date +%Y%m%d-%H%M)"
mkdir -p "$BACKUP_DIR"
DB_OUT="$BACKUP_DIR/adroit-$STAMP.dump"
FILES_OUT="$BACKUP_DIR/adroit-files-$STAMP.tar.gz"
MANIFEST="$BACKUP_DIR/adroit-$STAMP.manifest"

echo "[backup] $(date '+%F %T') database -> $DB_OUT"
pg_dump --format=custom --compress=6 --no-owner --file="$DB_OUT.part"
mv "$DB_OUT.part" "$DB_OUT"

echo "[backup] documents $FILES_DIR -> $FILES_OUT"
if [ -d "$FILES_DIR" ]; then
  tar -czf "$FILES_OUT.part" -C "$FILES_DIR" .
else
  EMPTY="$(mktemp -d)"; tar -czf "$FILES_OUT.part" -C "$EMPTY" .; rmdir "$EMPTY"
fi
mv "$FILES_OUT.part" "$FILES_OUT"

# record counts so a restore can be verified against them
COUNTS="$(psql -At -F ' ' -c "SELECT (SELECT count(*) FROM employees), (SELECT count(*) FROM assets), (SELECT count(*) FROM document_versions), (SELECT count(*) FROM files), (SELECT count(*) FROM audit_events)")"
{
  echo "created=$(date '+%F %T %z')"
  echo "database=$(basename "$DB_OUT")"
  echo "files=$(basename "$FILES_OUT")"
  echo "counts(employees assets document_versions files audit_events)=$COUNTS"
  echo "file_count=$(tar -tzf "$FILES_OUT" | grep -vc '/$' || true)"
  echo "sha256_database=$(sha256sum "$DB_OUT" | cut -d' ' -f1)"
  echo "sha256_files=$(sha256sum "$FILES_OUT" | cut -d' ' -f1)"
} > "$MANIFEST"

echo "[backup] removing backups older than $KEEP days"
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'adroit-*.dump' -o -name 'adroit-files-*.tar.gz' -o -name 'adroit-*.manifest' \) -mtime +"$KEEP" -print -delete || true
echo "[backup] done: $(du -h "$DB_OUT" | cut -f1) database, $(du -h "$FILES_OUT" | cut -f1) documents"
