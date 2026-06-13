#!/usr/bin/env bash
# backup.sh — capture all portable state of the agent into two files.
#
# Produces:
#   <out>/db-<ts>.sql.gz            logical Postgres dump (consistent, version-safe)
#   <out>/paperclip_data-<ts>.tgz   the /paperclip volume (config + Hermes ~/.hermes)
#
# Those two files + the Dockerfile + compose.yaml + .env are everything needed to
# recreate the agent on another host (priority 2).
#
# Usage:   ./scripts/backup.sh [output_dir]      (default ./backups)
# Run from the project dir (where compose.yaml lives) with the stack up.
set -euo pipefail

PROJECT="${PROJECT:-paperclip5a}"            # must match `name:` in compose.yaml
DB_SERVICE="paperclip-db"
DATA_VOLUME="${PROJECT}_paperclip_data"
OUT_DIR="${1:-./backups}"
TS="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$OUT_DIR"
ABS_OUT="$(cd "$OUT_DIR" && pwd)"

echo ">> [1/2] Dumping Postgres (logical, consistent)…"
docker compose exec -T "$DB_SERVICE" \
  pg_dump -U paperclip -d paperclip --clean --if-exists \
  | gzip > "$ABS_OUT/db-$TS.sql.gz"

echo ">> [2/2] Archiving the /paperclip volume ($DATA_VOLUME)…"
docker run --rm \
  -v "$DATA_VOLUME":/data:ro \
  -v "$ABS_OUT":/backup \
  alpine tar czf "/backup/paperclip_data-$TS.tgz" -C /data .

echo
echo ">> Backup complete:"
echo "   $ABS_OUT/db-$TS.sql.gz"
echo "   $ABS_OUT/paperclip_data-$TS.tgz"
echo
echo "   To move the agent: copy those two files + Dockerfile + compose.yaml + .env"
echo "   to the new host, 'docker compose up -d --build', then ./scripts/restore.sh."
