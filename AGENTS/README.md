# AGENTS

Tato složka je hlavní zdroj pravidel a kontextu pro AI agenty (především
Claude Code), kteří pracují v tomto repozitáři. Repozitář je monorepo se
dvěma odlišnými aplikacemi (`apps/fe`, `apps/be`) — sdílená pravidla jsou
tady, specifika jednotlivých aplikací jsou v `konvence-fe.md` a
`konvence-be.md` a natahují se přes `CLAUDE.md` přímo v dané aplikaci.

Na začátku session si agent projde tento soubor (a soubory, které
importuje) a `tasks/README.md`, kde jsou rozpracované a čekající úkoly.

## Obsah

- [`architektura.md`](./architektura.md) — přehled monorepa, jednotlivých
  aplikací a jejich nasazení.
- [`konvence-fe.md`](./konvence-fe.md) — konvence pro `apps/fe`
  (Expo/React Native/TypeScript).
- [`konvence-be.md`](./konvence-be.md) — konvence pro `apps/be`
  (ASP.NET Core/.NET).
- [`git-workflow.md`](./git-workflow.md) — větvení, commity, pull requesty.
- [`tasks/`](./tasks/README.md) — souborový task tracker.

@./architektura.md
@./git-workflow.md
@./tasks/README.md
