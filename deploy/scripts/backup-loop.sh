#!/bin/sh
# Runs backup.sh every day at BACKUP_TIME (HH:MM, container time zone). Used by the compose "backup" service.
set -u
BACKUP_TIME="${BACKUP_TIME:-02:30}"
echo "[backup-loop] daily backups at $BACKUP_TIME ($(date +%Z)), keeping ${BACKUP_KEEP_DAYS:-30} days"
while true; do
  now=$(date +%s)
  target=$(date -d "$(date +%F) $BACKUP_TIME" +%s 2>/dev/null || date -D '%Y-%m-%d %H:%M' -d "$(date +%F) $BACKUP_TIME" +%s)
  [ "$target" -le "$now" ] && target=$((target + 86400))
  sleep $((target - now))
  /bin/sh /scripts/backup.sh || echo "[backup-loop] BACKUP FAILED at $(date '+%F %T')"
done
