# Architektura

## Přehled

`volny` (FreeTime / SemFre) je monorepo se dvěma samostatnými aplikacemi:

- **`apps/fe`** (`semfre-fe`) — Expo/React Native frontend v TypeScriptu.
  Nasazuje se jako web na Azure Static Web Apps a jako mobilní aplikace přes
  EAS Update.
- **`apps/be`** (`SemFre`) — ASP.NET Core backend API v C#. Nasazuje se jako
  Docker kontejner na VPS (viz [Backend na VPS](#backend-na-vps)).

Obě aplikace žijí ve stejném repozitáři, ale nemají společný build systém
ani závislosti — jde o dvě nezávislé aplikace vedle sebe, ne o npm/pnpm/yarn
workspaces.

Repozitář vznikl 2026-09-03 sloučením dříve samostatných repozitářů
`volny-FE` a `volny-BE` (s čistou historií); originály zůstávají dostupné
jako archivy.

## CI/CD

CI workflows jsou v `.github/workflows/` v rootu repozitáře a jsou omezené
cestou (`paths:`), takže se spouští jen pro tu aplikaci, které se změna
týká:

- `azure-static-web-apps-volny-fe.yml` — build a deploy `apps/fe` na Azure
  Static Web Apps při push do `main`.
- `eas-update.yml` — publikace OTA update pro Expo/EAS.
- `volny-be-deploy.yml` — build arm64 image `apps/be` a deploy na VPS přes
  SSH.

Při úpravě jedné aplikace tedy typicky běží jen odpovídající workflow, ne
oba.

## Backend na VPS

Od 2026-10-11 backend neběží na Azure Container Apps (stálo to ~9 USD
měsíčně, hlavně Container Registry a instance běžící 24/7), ale na Oracle
Cloud VPS (`ssh oracle`, Ubuntu, **arm64**), sdíleném s dalšími službami.

- **URL:** `https://api.volny.limit6.eu/api`. TLS a reverse proxy dělá
  sdílený Caddy (`~/devops/services/caddy/config/Caddyfile` na serveru),
  který předává na `127.0.0.1:8090`.
- **Kontejner:** `~/devops/services/volny-be/` na serveru — kopie
  `apps/be/deploy/` (`docker-compose.yml`, `deploy.sh`, `backup.sh`) plus
  `.env` se secrets (`Jwt__Key`, `Fcm__ServiceAccountJson`) a `data/`
  s SQLite DB. Paměť omezená na 512 MB.
- **Deploy:** `volny-be-deploy.yml` postaví image na arm runneru a pošle ho
  `docker save | ssh` — žádná registry. Deploy klíč má v `authorized_keys`
  vynucený příkaz `deploy.sh` (secrets `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`).
  Rollback: na serveru `docker tag volny-be:previous volny-be:latest &&
  docker compose up -d`.
- **Zálohy:** `backup.sh` z cronu každou noc, 7 denních + 4 týdenní
  v `backups/` — jen na stejném stroji, ne off-site.
- Změny v `apps/be/deploy/` se na server nepropisují samy — po úpravě je
  zkopíruj ručně.
