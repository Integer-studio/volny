# 0001 — Realtime aktualizace (volní lidé, friend requesty)

- **Stav:** done
- **Priorita:** 1 (musí být hotové před veřejným releasem)
- **Datum vytvoření:** 2026-09-04

## Popis / kontext

Přesunuto z `apps/fe/README.md` Todos ("implementovat sockety (volni lide,
friend requests)"). Aplikace by měla přes sockety živě aktualizovat dvě věci
bez nutnosti manuálního refreshe:

- seznam aktuálně "volných" lidí,
- příchozí friend requesty.

## Kritéria splnění

- [x] Seznam volných lidí se v UI aktualizuje v reálném čase, jakmile někdo
      změní svůj stav (bez nutnosti refreshe/reloadu obrazovky).
- [x] Nový příchozí friend request se objeví/upozorní uživatele okamžitě,
      bez nutnosti refreshe.

## Poznámky

Rozhodnuto 2026-10-05:

- **Transport**: SignalR, hub `/hubs/realtime`, jen WebSockets se
  `skipNegotiation`. Kontrakt eventů je v `apps/be/SemFre/API_DOCS.md`
  (sekce Realtime).
- **Eventy jsou jen signály k refetch** (`FreeChanged`, `FriendsChanged`).
  Výjimkou je `FriendRequestReceived`, který nese `{fromUserId, fromName}`
  kvůli toastu.
- **Upozornění na nový friend request** v otevřené appce: tečka u ikony
  přátel se aktualizuje živě, zobrazí se toast a systémová push notifikace
  se nezobrazí, pokud je socket připojený. Platí jen pro `friend_request`.
  Ostatní typy (`friend_accepted`, `friend_added_via_qr`, `friend_imfree`)
  nemají toast, takže jejich notifikace v popředí zůstává.
- **Polling zůstává jako fallback**: 30 s bez socketu, 5 min s připojeným
  socketem. Po každém (re)connectu proběhne refetch (`Resync`).
- **Na pozadí** (na webu skrytý tab) se socket odpojí, při návratu znovu
  připojí.
- `FreeChanged` chodí i při změně přátelství a skupin, protože ty mění,
  koho v seznamu vidím. Lidi bez volna seznam neřeší, protože se načítá,
  jen když jsem sám volný.

Implementováno v PR [#17](https://github.com/Integer-studio/volny/pull/17).
