# volny

Monorepo for the FreeTime / SemFre ("volny") app: a mobile/web frontend and its .NET backend API.

- [`apps/fe`](apps/fe/README.md) — Expo/React Native frontend (`semfre-fe`), deployed to Azure Static Web Apps (web) and EAS Update (mobile).
- [`apps/be`](apps/be/README.md) — ASP.NET Core backend (`SemFre`), deployed as a container to Azure Container Apps.

CI workflows live under `.github/workflows/` at the repo root and are scoped by path (`apps/fe/**` / `apps/be/**`) so each app's pipeline only runs on its own changes.

This repo was created 2026-09-03 by merging the previously separate `volny-FE` and `volny-BE` repositories, starting from a fresh history. The originals remain available as archives (not deleted).
