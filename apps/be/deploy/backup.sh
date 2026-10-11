#!/usr/bin/env bash
# Noční záloha SQLite DB (cron na VPS, 02:30). sqlite3 .backup dělá
# konzistentní snapshot i za běhu aplikace. Drží 7 denních a 4 nedělní.
set -euo pipefail
cd "$(dirname "$0")"

DB=data/SemFre.db
OUT=backups
mkdir -p "$OUT/daily" "$OUT/weekly"

stamp=$(date -u +%Y-%m-%dT%H-%M-%SZ)
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
sqlite3 "$DB" ".backup '$tmp'"
gzip -c "$tmp" > "$OUT/daily/SemFre_$stamp.db.gz"
if [ "$(date -u +%u)" = 7 ]; then
  cp "$OUT/daily/SemFre_$stamp.db.gz" "$OUT/weekly/"
fi

ls -1t "$OUT"/daily/*.gz | awk 'NR>7' | xargs -r rm -f
ls -1t "$OUT"/weekly/*.gz 2>/dev/null | awk 'NR>4' | xargs -r rm -f
