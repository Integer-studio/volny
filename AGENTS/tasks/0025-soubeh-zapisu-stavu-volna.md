# 0025 — Souběh zápisů stavu volna a falešné chyby

- **Stav:** in progress
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

- [x] Chyba `refreshMe` po úspěšném zápisu nevede k rollbacku ani toastu.
- [x] Zápisy stavu jsou serializované (fronta), nebo jsou tlačítko, prstenec
      a presety během zápisu zablokované. Vizuální optimismus zůstane.
- [ ] Ověřeno na pomalé síti (throttling): žádné duplicitní volno ani
      notifikace.

## Poznámky

**2026-10-07 (skupina A):** `applyStatus` v `app/index.tsx` už neposílá
request za každé ťuknutí. Drží poslední potvrzený stav ze serveru a
poslední chtěný stav z UI. `syncStatus()` mezi nimi dorovnává po jednom
requestu a request volí podle potvrzeného stavu: `DELETE`, `POST`, nebo
`PUT` přes `extendMyStatus`. Dvojťuk tak pošle POST a DELETE za sebou.
Tažení během POSTu skončí PUTem, ne druhým POSTem. Rollback jde na
potvrzený stav a `refreshMe` po úspěšném zápisu už nic nevrací. Zbývá
ověřit s throttlingem.
