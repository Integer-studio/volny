# 0026 — Prázdné stavy se ukazují místo načítání nebo chyby

- **Stav:** done
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

- [x] Každý seznam rozlišuje: načítání / chyba (s "Zkusit znovu") / prázdno /
      data.
- [x] Hledání ukazuje inline spinner během debounce a requestu.
- [x] Hlavní obrazovka nefetchuje ani nepřepisuje cache, když uživatel není
      volný.
- [x] Pozvánky: "neplatná" jen při 404, jinak chyba s retry.

## Poznámky

**2026-10-07 (skupina B):** Hledání má spinner už během psaní a debounce,
chybu s "Zkusit znovu", nápovědu pod 2 znaky a "Nikoho takového jsme
nenašli." až po doběhnutí. Seznam přátel v hledání rozlišuje načítání,
chybu, prázdno a data. Zbytek (hlavní obrazovka, skupiny, pozvánky) patří
do skupiny C.

**2026-10-07 (skupina C):** Hlavní obrazovka seznam volných nefetchuje, když
uživatel volný není (`useAsyncData` má `enabled`), takže se nepřepíše cache.
Během načítání ukazuje spinner i přes prázdná data, při chybě bez dat
"Nepodařilo se načíst, kdo je volný" a "Zatím nikoho nemáš." jen podle
čerstvě načtených přátel a skupin. Skupiny rozlišují chybu od prázdna.
Pozvánky (`InviteLoadError`) ukazují "Neplatná pozvánka" jen při 404, jinak
chybu se "Zkusit znovu" (a už nebliknou "neplatnou" před spinnerem).
`PendingInviteGate` při síťové chybě pozvánku nezahodí a join v sheetu
hlásí 404 zvlášť.
