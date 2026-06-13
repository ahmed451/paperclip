#!/usr/bin/env bash
# restore.sh — restore agent state onto a host where the stack already exists.
#
# Prereq: on the target host you've copied Dockerfile + compose.yaml + .env, run
#   docker compose up -d --build
# (this creates the volumes and a healthy, EMPTY db). Then run this script.
#
# Usage:   ./scripts/restore.sh <db-*.sql.gz> <paperclip_data-*.tgz>
set -euo pipefail

PROJECT="${PROJECT:-paperclip4}"            # must match `name:` in compose.yaml
DB_SERVICE="paperclip-db"
DATA_VOLUME="${PROJECT}_paperclip_data"

DB_DUMP="${1:?usage: restore.sh <db-*.sql.gz> <paperclip_data-*.tgz>}"
DATA_TGZ="${2:?usage: restore.sh <db-*.sql.gz> <paperclip_data-*.tgz>}"

[ -f "$DB_DUMP" ]  || { echo "no such file: $DB_DUMP";  exit 1; }
[ -f "$DATA_TGZ" ] || { echo "no such file: $DATA_TGZ"; exit 1; }

echo ">> Stopping the server so nothing writes during restore…"
docker compose stop paperclip

echo ">> [1/2] Restoring Postgres from $DB_DUMP…"
gunzip -c "$DB_DUMP" \
  | docker compose exec -T "$DB_SERVICE" psql -U paperclip -d paperclip -v ON_ERROR_STOP=1

echo ">> [2/2] Restoring /paperclip volume from $DATA_TGZ…"
TGZ_DIR="$(cd "$(dirname "$DATA_TGZ")" && pwd)"
TGZ_NAME="$(basename "$DATA_TGZ")"
docker run --rm \
  -v "$DATA_VOLUME":/data \
  -v "$TGZ_DIR":/backup:ro \
  alpine sh -c 'rm -rf /data/* /data/..?* /data/.[!.]* 2>/dev/null || true; tar xzf "/backup/'"$TGZ_NAME"'" -C /data'

echo ">> Starting the server…"
docker compose start paperclip

echo
echo ">> Restore complete. Check: docker compose logs -f paperclip"
