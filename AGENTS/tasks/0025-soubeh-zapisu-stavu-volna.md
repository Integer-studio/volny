# 0025 — Souběh zápisů stavu volna a falešné chyby

- **Stav:** todo
- **Priorita:** 1
- **Datum vytvoření:** 2026-10-07

## Popis / kontext

`applyStatus` v `apps/fe/app/index.tsx` je optimistický, ale:

- **Falešné "Nepodařilo se uložit stav."** — `await refreshMe()` je ve
  stejném `try` jako zápis. Když zápis projde a selže až `GET /users/me`, UI
  vrátí stav zpět a ukáže chybu, i když je uživatel na serveru volný. Další
  ťuknutí pak založí druhé volno a přátelům přijde druhá notifikace.
- **Tažení prstence během potvrzování** — `FreeDial` nepředává
  `TimeRing`u `disabled={pending}` (prop existuje). Po ťuknutí je `isFree`
  hned `true`, takže tažení zavolá `extendMyStatus`. Ten nenajde aktivní
  volno (POST ještě nedoběhl) a pošle druhý POST → duplicitní notifikace.
- **Dvojťuk** — tlačítko není blokované první sekundu. Souběžný POST a
  DELETE může na serveru skončit "volný", zatímco UI ukazuje "nevolný",
  dokud `refreshMe` stav nečekaně nepřepne.

## Kritéria splnění

- [ ] Chyba `refreshMe` po úspěšném zápisu nevede k rollbacku ani toastu.
- [ ] Zápisy stavu jsou serializované (fronta), nebo jsou tlačítko, prstenec
      a presety během zápisu zablokované. Vizuální optimismus zůstane.
- [ ] Ověřeno na pomalé síti (throttling): žádné duplicitní volno ani
      notifikace.
