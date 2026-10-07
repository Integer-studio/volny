# 0026 — Prázdné stavy se ukazují místo načítání nebo chyby

- **Stav:** todo
- **Priorita:** 1
- **Datum vytvoření:** 2026-10-07

## Popis / kontext

Na studeném backendu nebo offline aplikace tvrdí, že "nic není", místo aby
ukázala načítání nebo chybu. To je horší než spinner — uživatel si myslí, že
přišel o přátele/skupiny.

- **Hledání** (`app/search.tsx:262`) — "Nenalezeni žádní uživatelé." se
  ukazuje během psaní, během debounce i během requestu (prázdný dotaz se
  vyřeší na `[]`, takže `data` už nikdy není `undefined` a spinner nenastane).
  Chyba requestu vypadá taky jako "nikdo".
- **Přátelé** (`app/search.tsx:318`) — "Zatím nemáš žádné přátele." při
  chybě načtení.
- **Skupiny** (`app/groups/index.tsx:115`) — "Zatím nejsi v žádné skupině."
  při chybě.
- **Hlavní obrazovka** (`app/index.tsx`):
  - "Zatím nikdo z přátel." se ukáže hned po označení se jako volný. Když
    uživatel volný není, fetcher vrací `[]`, `useAsyncData` to bere jako
    úspěch a přepíše tím cache `freeNow`, takže spinner se už neukáže.
  - "Zatím nikoho nemáš." se ukáže i lidem s přáteli, když `connections`
    ještě nedoběhlo nebo selhalo.
  - Banner "zobrazuji poslední známý stav" se ukazuje i když žádný stav
    v cache není.
- **Pozvánky** — `add-friend/[code].tsx` ukáže "Neplatná pozvánka" i při
  síťové chybě (ne jen při 404). Join do skupiny nerozlišuje 404 od ostatních
  chyb.

## Kritéria splnění

- [ ] Každý seznam rozlišuje: načítání / chyba (s "Zkusit znovu") / prázdno /
      data.
- [ ] Hledání ukazuje inline spinner během debounce a requestu.
- [ ] Hlavní obrazovka nefetchuje ani nepřepisuje cache, když uživatel není
      volný.
- [ ] Pozvánky: "neplatná" jen při 404, jinak chyba s retry.
