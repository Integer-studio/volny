# Task tracker

Jednoduchý souborový task tracker nezávislý na GitHub Issues — funguje i bez
přístupu ke GitHubu a je čitelný přímo v repozitáři. Úkol může přidat
kdokoliv (člověk i AI agent), stejně tak si kdokoliv může existující úkol
vzít a dopracovat.

## Stavy

- `todo` — čeká na vyzvednutí.
- `in progress` — někdo (nebo nějaký agent) na tom aktuálně pracuje.
- `done` — hotovo.

## Jak přidat nový úkol

1. Zkopíruj [`sablona.md`](./sablona.md) do nového souboru
   `NNNN-strucny-nazev.md` v této složce (`NNNN` je další volné čtyřmístné
   číslo, viz tabulka níže).
2. Vyplň všechna pole v šabloně.
3. Přidej řádek do tabulky níže se stavem `todo`.

## Jak si úkol vzít / dokončit

1. Otevři si soubor úkolu, přečti kontext a kritéria splnění.
2. Přepni stav v tabulce i v hlavičce souboru úkolu na `in progress`.
3. Po dokončení nastav stav na `done`. Pokud úkol souvisí s PR, odkaž na něj
   v poznámkách souboru úkolu.

## Úkoly

| ID | Název | Stav | Soubor |
|----|-------|------|--------|
| 0001 | Realtime aktualizace (volní lidé, friend requesty) | todo | [0001-realtime-aktualizace.md](./0001-realtime-aktualizace.md) |
| 0002 | Zjistit a definovat stav oznámení (mobil i web) | done | [0002-stav-oznameni.md](./0002-stav-oznameni.md) |
| 0003 | Zmenšit velikost APK | done | [0003-velikost-apk.md](./0003-velikost-apk.md) |
| 0004 | Web push notifikace | in progress | [0004-web-push-notifikace.md](./0004-web-push-notifikace.md) |
| 0005 | Web push notifikace pro iOS (Safari) | todo | [0005-ios-safari-web-push.md](./0005-ios-safari-web-push.md) |
| 0006 | Nepovinný telefon a IG při registraci + disclaimer o viditelnosti | todo | [0006-nepovinny-telefon-ig-registrace.md](./0006-nepovinny-telefon-ig-registrace.md) |
| 0007 | Nové zadávání času | todo | [0007-nove-zadavani-casu.md](./0007-nove-zadavani-casu.md) |
| 0008 | Scheduled začátek volna (max. den dopředu) | todo | [0008-scheduled-zacatek-volna.md](./0008-scheduled-zacatek-volna.md) |
| 0009 | User-based nastavení presetů | todo | [0009-user-presety.md](./0009-user-presety.md) |
| 0010 | Vlastní čas (manuální zadání) | todo | [0010-vlastni-cas.md](./0010-vlastni-cas.md) |
| 0011 | Přichycení (snap) času na nejbližší preset | todo | [0011-snap-casu-na-preset.md](./0011-snap-casu-na-preset.md) |
| 0012 | "Kde jsem" políčko (volný text) | todo | [0012-kde-jsem-policko.md](./0012-kde-jsem-policko.md) |
| 0013 | Lubomír mode on/off (vypnutý stav bez obrázků) | todo | [0013-lubomir-mode.md](./0013-lubomir-mode.md) |
| 0014 | Lepší always-on backend | todo | [0014-always-on-backend.md](./0014-always-on-backend.md) |
| 0015 | Rozvedení zadání nových tasků (0006–0014, 0016) | todo | [0015-rozvedeni-novych-tasku.md](./0015-rozvedeni-novych-tasku.md) |
| 0016 | Sessions nevydrží po scaledownu backendu | todo | [0016-sessions-nevydrzi-po-scaledownu.md](./0016-sessions-nevydrzi-po-scaledownu.md) |
