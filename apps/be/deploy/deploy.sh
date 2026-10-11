#!/usr/bin/env bash
# Vynucený příkaz deploy klíče z GitHub Actions (authorized_keys:
# command="…/deploy.sh",restrict). Na stdin dostane `docker save | gzip`
# image volny-be:latest, nahraje ho a restartuje kontejner. Předchozí image
# zůstane jako volny-be:previous pro ruční rollback:
#   docker tag volny-be:previous volny-be:latest && docker compose up -d
set -euo pipefail
cd "$(dirname "$0")"

if docker image inspect volny-be:latest >/dev/null 2>&1; then
  docker tag volny-be:latest volny-be:previous
fi

gunzip | docker load
docker compose up -d --remove-orphans

# Start zahrnuje migrace DB; 401 z chráněného endpointu = aplikace odpovídá.
for _ in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8090/api/users/me || true)
  if [ "$code" != "000" ] && [ "${code:0:1}" != "5" ]; then
    echo "volny-be up (HTTP $code)"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 2
done

echo "volny-be neodpovídá po deployi" >&2
docker compose logs --tail 50 >&2
exit 1
