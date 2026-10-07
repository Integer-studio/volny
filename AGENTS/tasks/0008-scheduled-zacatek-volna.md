# 0008 — Scheduled začátek volna (max. den dopředu)

- **Stav:** todo
- **Priorita:** 2 (důležité, ale nebrání releasu)
- **Datum vytvoření:** 2026-09-06

## Popis / kontext

Možnost naplánovat si "volno" tak, aby se aktivovalo automaticky v budoucnu
(max. 1 den dopředu), místo nutnosti zapínat ho manuálně v danou chvíli.

**Zjištěný current stav (2026-09-06):** BE datový model to napůl podporuje
už dnes — `POST /api/freetimes` (`FreeTimesController.Create`) přijímá
libovolný budoucí `StartTime` a nijak ho neomezuje. Chybí ale dvě věci:
(1) validace max. 1 den dopředu neexistuje, (2) notifikace přátelům se
posílá jen když `start <= DateTime.UtcNow` — pro budoucí start se
**nepošle vůbec** a nic ji později nespustí, takže naplánované volno by se
fakticky nikdy neprojevilo navenek. FE navíc nemá žádné UI pro volbu
budoucího začátku — dnes lze zvolit jen konec ("volno do…").

## Kritéria splnění

- [ ] FE: v UI pro zapnutí volna přibude možnost zvolit i budoucí začátek
      (ne jen konec), s omezením max. 24 hodin dopředu.
- [ ] BE: `FreeTimeCreateDtoValidator` validuje, že `StartTime` (pokud je
      v budoucnu) není víc než 24 hodin od teď.
- [ ] Naplánované budoucí volno je přátelům viditelné už před aktivací
      (např. "bude volný od 18:00"), ne až po aktivaci.
- [ ] Aktivace v čase `StartTime` (a odeslání notifikace přátelům) je
      odpovědnost backendu, nezávisle na tom, jestli je klientská appka
      otevřená — např. periodická kontrola v background service
      analogicky k existující `NotificationBackgroundService`, ne
      spoléhání na to, že klient v danou chvíli zavolá nějaký endpoint.
- [ ] Ověřeno, že notifikace při dosažení `StartTime` skutečně dojde
      (dnes se u budoucího startu nepošle vůbec, viz
      `FreeTimesController.Create`, podmínka `start <= DateTime.UtcNow`).

## Poznámky

Vzniklo jako součást dávky nových tasků 2026-09-06, rozvedeno v [0015](./0015-rozvedeni-novych-tasku.md).

Realtime ([0001](./0001-realtime-aktualizace.md)): background aktivace
naplánovaného volna musí po uložení zavolat
`IRealtimeNotifier.FreeChangedAsync(userId)`, jinak se aktivace přátelům
v otevřené appce projeví až fallback pollingem (5 min). Dnes
`FreeTimesController.Create` pro budoucí start realtime signál neposílá.

**Návrh UI (2026-10-07):** budoucí začátek by se mohl zadávat vizuálně
druhým handlem na prstenci z [0007](./0007-nove-zadavani-casu.md). Dnes
oblouk začíná pevně na `teď`. Na jeho začátek by přibyl handle, který jde
odtáhnout dopředu, a oblouk by pak vedl od začátku do konce volna. Kód je
v `apps/fe/components/TimeRing/index.tsx` a `scale.ts`. Pozor, že rozsah
prstence je dnes max. 16 h, takže na limit 24 h dopředu nestačí.
