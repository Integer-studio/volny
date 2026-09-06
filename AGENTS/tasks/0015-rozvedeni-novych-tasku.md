# 0015 — Rozvedení zadání nových tasků (0006–0014, 0016)

- **Stav:** done
- **Priorita:** 1 (blokuje pořádné zahájení práce na ostatních tascích)
- **Datum vytvoření:** 2026-09-06

## Popis / kontext

Tasky [0006](./0006-nepovinny-telefon-ig-registrace.md) až
[0014](./0014-always-on-backend.md) a [0016](./0016-sessions-nevydrzi-po-scaledownu.md)
vznikly 2026-09-06 z krátkých poznámek a mají zatím jen hrubě popsané
zadání ("co"), ne návrh řešení ("jak"). Tento task je zastřešující — projít
každý z nich a rozvést zadání do konkrétnějšího popisu a kritérií splnění,
než se na nich začne pracovat.

## Kritéria splnění

- [x] Pro každý z tasků 0006–0014, 0016 doplněno konkrétnější zadání a
      kritéria splnění.

## Poznámky

Neřeší návrh implementace samotné — jen doostření zadání.

**Rozvedeno 2026-09-06** na základě průzkumu kódu a rozhodnutí uživatele:

- 0006: rozhodnuto přidat telefon/IG jako volitelná pole přímo do
  registračního formuláře (ne jen do Nastavení).
- 0007/0009/0010/0011: zdokumentován current stav (žádné presety,
  hodinová granularita) a závislosti mezi tasky. 0009: rozhodnuto ukládat
  presety persistentně na backendu (sync mezi zařízeními), ne jen
  lokálně.
- 0008: doplněna zjištěná mezera (notifikace se u budoucího startu dnes
  neodešle vůbec). Rozhodnuto: naplánované volno je přátelům viditelné
  už před aktivací, a aktivace/notifikace je odpovědnost backendu
  (background service), ne závislá na otevřené klientské appce.
- 0013: rozhodnut rozsah (jen runtime — hlavní tlačítko + push ikona na
  webu, app icon/favicon mimo rozsah) a výchozí stav **zapnuto**
  (opt-out) — vědomě přijaté riziko vzhledem k právnímu kontextu v
  původním zadání.
- 0014: rozhodnut přístup — scheduled scaling přes den (provozní okno
  7:00–21:00), ne trvalé `minReplicas: 1`.
- 0016: původní podezření (session zahazovaná při scaledownu) se
  ukázalo jako nesprávné — appka nemá server-side session vůbec, jde o
  stateless JWT bez refresh tokenu s TTL 120 min. Rozhodnuto zavést
  refresh token pattern; task přejmenován a kritéria přepsána podle
  skutečné příčiny.
