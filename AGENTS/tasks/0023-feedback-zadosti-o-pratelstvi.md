# 0023 — Zpětná vazba při posílání žádostí o přátelství

- **Stav:** todo
- **Priorita:** 1
- **Datum vytvoření:** 2026-10-07

## Popis / kontext

Uživatelé hlásí, že posílání žádostí "nemá feedback". Příčiny (UX audit
2026-10-07):

- **Hledání (`apps/fe/app/search.tsx`, `handleAdd`)** — po ťuknutí na "+" se
  tlačítko jen změní na šedou fajfku (`addedDict`). Žádný toast, žádný text
  "Odesláno". Fajfka vypadá stejně jako "už jste přátelé".
- **Chyba je tichá** — `catch {}` v `handleAdd` jen vrátí "+". Na studeném
  backendu uživatel vidí několik sekund fajfku a pak zase "+" bez vysvětlení.
  Chybí `useSlowActionNotice` (na rozdíl od `add-friend/[code].tsx`).
- **Stav se zapomíná** — `addedDict` je lokální stav. `searchUsers` vrací
  holé `UserSummary` bez vztahu (přítel / odeslaná / přijatá žádost), takže
  při novém hledání má uživatel, kterému už žádost odešla, zase "+". Další
  ťuknutí dostane 409 "Suggestion already exists", které tichý catch změní
  na fajfku → "+". Působí to jako "nefunguje to".
- **Odeslané žádosti nejsou nikde vidět ani nejdou zrušit** — backend má
  `GET /friendsuggestions/outgoing` a `DELETE /friendsuggestions`, ale
  `lib/api.ts` je nepoužívá. `ProfileSheet` ukazuje jen mrtvé šedé
  "Žádost odeslána".
- **Protisměrná žádost** — když mi druhý už žádost poslal a já dám "+",
  vznikne druhá zrcadlová žádost místo toho, aby z nás byli přátelé
  (`FriendSuggestionsController` kontroluje jen jeden směr).
- **Přijetí/odmítnutí** v hledání — řádek zmizí (OK), ale chybí potvrzení
  ("Teď jste přátelé s X") a odmítnutí nemá undo.
- **Hledání** nemá minimální délku dotazu ani limit výsledků
  (`UsersController` — `LIKE %a%` bez `Take`), což je pomalé a vypisuje celý
  adresář uživatelů. Řádky výsledků nejdou rozkliknout, takže nejde poznat,
  kterého "Petra" přidávám.

## Kritéria splnění

- [ ] Vyhledávání vrací (nebo klient dopočítá) vztah k uživateli a řádek má
      stavy "Přidat" / "Odesláno · Zrušit" / "Přátelé" / "Přijmout".
- [ ] Úspěšné odeslání ukáže toast "Žádost odeslána uživateli X". Chyba
      ukáže `errorMessage()`. 409 se bere jako úspěch.
- [ ] Při pomalé odpovědi se ukáže `useSlowActionNotice`.
- [ ] Sekce "Odeslané žádosti" (napojená na `/outgoing`) s možností zrušit.
- [ ] "+" na uživatele, který mi už žádost poslal, žádost rovnou přijme
      (BE nebo FE).
- [ ] Hledání od 2–3 znaků s nápovědou, na BE `Take(20)`.

## Poznámky

Související: toasty pod modaly (0027) — chyby v `ProfileSheet` se kvůli tomu
vůbec nezobrazí.
