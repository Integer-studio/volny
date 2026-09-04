# 0001 — Realtime aktualizace (volní lidé, friend requesty)

- **Stav:** todo
- **Datum vytvoření:** 2026-09-04

## Popis / kontext

Přesunuto z `apps/fe/README.md` Todos ("implementovat sockety (volni lide,
friend requests)"). Aplikace by měla přes sockety živě aktualizovat dvě věci
bez nutnosti manuálního refreshe:

- seznam aktuálně "volných" lidí,
- příchozí friend requesty.

## Kritéria splnění

- [ ] Seznam volných lidí se v UI aktualizuje v reálném čase, jakmile někdo
      změní svůj stav (bez nutnosti refreshe/reloadu obrazovky).
- [ ] Nový příchozí friend request se objeví/upozorní uživatele okamžitě,
      bez nutnosti refreshe.

## Poznámky

Přesná forma upozornění na nový friend request (toast, badge, zvuk apod.)
zatím není určená — vyjasnit před implementací.
