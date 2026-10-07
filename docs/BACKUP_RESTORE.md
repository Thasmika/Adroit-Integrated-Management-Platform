# Backup and restore

The database and the document store are backed up together every night. Every backup has a manifest with record counts and checksums, so a restore can be verified.

## What a backup contains

For each run, in `BACKUP_DIR`:

| File | Content |
|---|---|
| `adroit-YYYYmmdd-HHMM.dump` | Full database (PostgreSQL custom format, compressed) |
| `adroit-files-YYYYmmdd-HHMM.tar.gz` | All scanned documents and photos |
| `adroit-YYYYmmdd-HHMM.manifest` | Time, record counts, file count, SHA-256 checksums |

Backups older than `BACKUP_KEEP_DAYS` (default 30) are deleted automatically. **Copy the backup folder to another machine or storage every day.** A backup kept only on the same server does not protect against losing that server.

## Schedule

- Docker: the `backup` service runs every night at `BACKUP_TIME` (default 02:30).
- systemd: `adroit-backup.timer` runs at 02:30.
- Take an extra backup before upgrades and large imports:
  - Docker: `docker compose exec backup sh /scripts/backup.sh`
  - systemd: `sudo systemctl start adroit-backup`

## Prove a backup restores (do this before go-live and monthly)

```bash
docker compose exec backup sh /scripts/restore-test.sh
```

This restores the latest backup into a temporary database, compares the record and file counts with the manifest, checks the checksums, and removes the temporary copy. The live system is not touched. It ends with `PASS` or `FAIL`.

## Restore (disaster recovery)

This **replaces** the current database and documents with the backup.

```bash
cd /opt/adroit/deploy
docker compose exec backup ls -1 /backups                 # choose the backup
docker compose stop app
docker compose run --rm restore /scripts/restore.sh /backups/adroit-20261001-0230.dump /backups/adroit-files-20261001-0230.tar.gz
docker compose start app
```

To restore from a copy kept elsewhere, first copy the three files of that backup into the `backups` volume (e.g. `docker compose cp <file> backup:/backups/`).

Without Docker:

```bash
sudo systemctl stop adroit
sudo -u adroit env $(cat /etc/adroit/backup.env | xargs) sh /opt/adroit/deploy/scripts/restore.sh <dump> <files.tar.gz>
sudo systemctl start adroit
```

The script checks the database checksum against the manifest, asks you to type `RESTORE`, restores the database in one transaction, and replaces the documents. Afterwards, sign in and check **Administration → System health**.

## Tested

On 29 Sep 2026 a restore was tested against the demo data set. Leave records were deleted and 500 of the 2,577 documents removed; after `restore.sh` all 50 leave records and all 2,577 documents were back and documents opened normally in the application. The `restore-test.sh` run matched every count (249 employees, 126 assets, 2,595 document versions, 2,577 files, 513 audit events).
