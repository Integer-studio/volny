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
