# 0008 — Scheduled začátek volna (max. den dopředu)

- **Stav:** done
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

- [x] FE: v UI pro zapnutí volna přibude možnost zvolit i budoucí začátek
      (ne jen konec), s omezením max. 24 hodin dopředu.
- [x] BE: `FreeTimeCreateDtoValidator` validuje, že `StartTime` (pokud je
      v budoucnu) není víc než 24 hodin od teď.
- [x] Naplánované budoucí volno je přátelům viditelné už před aktivací
      (např. "bude volný od 18:00"), ne až po aktivaci.
- [x] Aktivace v čase `StartTime` (a odeslání notifikace přátelům) je
      odpovědnost backendu, nezávisle na tom, jestli je klientská appka
      otevřená — např. periodická kontrola v background service
      analogicky k existující `NotificationBackgroundService`, ne
      spoléhání na to, že klient v danou chvíli zavolá nějaký endpoint.
- [x] Ověřeno, že notifikace při dosažení `StartTime` skutečně dojde
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

**Hotovo 2026-10-07** (větev `feature/planovane-volno-a-presny-cas`).

- **BE:** `FreeTime.NotifiedAt` + `FreeTimeActivationService`. Ten každých
  30 s aktivuje volna, jejichž start nastal: push "má teď volno" + realtime,
  stejnou cestou jako tlačítko (`FreeTimeActivator`). Validátor povolí start
  i konec nejvýš 24 h dopředu. `GET /api/connections/upcoming` a
  `UserDto.UpcomingFreeTime`. Migrace vyplní `NotifiedAt` starým řádkům, ať
  deploy nic znovu nerozešle.
- **FE:** druhý, menší obrysový handle na prstenci = začátek. Když dojede ke
  konci, tlačí ho před sebou (mezera `T_MIN`). Popisek ukazuje "Volný od
  18:00 do 21:00". Naplánované volno se ukládá puštěním handle a hlavní
  tlačítko ho zruší. Tlačítko "začít hned" záměrně není, stačí stáhnout
  začátek na teď. Přátelé vidí plány v sekci **"Později"** pod seznamem
  volných. Sekce se ukáže jen když není prázdná, za stejných podmínek jako
  seznam volných.
- **Doladěno po review (2026-10-07):** handle začátku je zmenšený jen
  v klidu na "teď". Tažený nebo stojící jinde vypadá stejně jako konec a má
  stejnou fyziku: pružinu za kraji, zoom podle rychlosti tahu, namotávání,
  setrvačnost a doběh. Presety uhýbají oběma handlům. Klepnutí na preset
  dřív, než může volno skončit, ho udělá začátkem (oblouk se prodlouží
  dozadu). Popisek času má jemný šedý podklad, aby bylo vidět, že jde
  klepnout.
- **Rozhodnuto:** začátek **běžícího** volna jde odtáhnout dopředu. Volno se
  tím vrátí do plánu (`NotifiedAt = null`) a v novém začátku přátelům znovu
  přijde "má teď volno". Push při naplánování se neposílá, jen realtime
  signál.
- Rozsah prstence zůstal 24 h, poznámka výš o 16 h už neplatí. Začátek i
  konec se vejdou do `[teď, teď + 24 h]`.
- Ověřeno lokálně: BE přes curl (aktivace schedulerem, 400 nad 24 h,
  návrat do plánu, okamžitý start) a FE na webu v headless Chromiu (tah
  začátku, plán, sekce Později, stažení na teď). **Neověřeno:** dotyk na
  nativu a skutečný push na zařízení.
