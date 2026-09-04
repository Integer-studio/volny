# Architektura

## Přehled

`volny` (FreeTime / SemFre) je monorepo se dvěma samostatnými aplikacemi:

- **`apps/fe`** (`semfre-fe`) — Expo/React Native frontend v TypeScriptu.
  Nasazuje se jako web na Azure Static Web Apps a jako mobilní aplikace přes
  EAS Update.
- **`apps/be`** (`SemFre`) — ASP.NET Core backend API v C#. Nasazuje se jako
  kontejner na Azure Container Apps.

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
- `volny-be-AutoDeployTrigger-*.yml` — automatický deploy `apps/be` jako
  kontejneru na Azure.

Při úpravě jedné aplikace tedy typicky běží jen odpovídající workflow, ne
oba.
