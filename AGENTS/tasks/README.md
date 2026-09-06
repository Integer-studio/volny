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

Priorita: 1 = musí být hotové před veřejným releasem, 2 = důležité, ale
nebrání releasu, 3 = polish/nice-to-have. U hotových/rozpracovaných tasků z
doby před zavedením priorit je uvedena orientačně.

## Úkoly

| ID | Název | Stav | Priorita | Soubor |
|----|-------|------|----------|--------|
| 0001 | Realtime aktualizace (volní lidé, friend requesty) | todo | 1 | [0001-realtime-aktualizace.md](./0001-realtime-aktualizace.md) |
| 0002 | Zjistit a definovat stav oznámení (mobil i web) | done | — | [0002-stav-oznameni.md](./0002-stav-oznameni.md) |
| 0003 | Zmenšit velikost APK | done | — | [0003-velikost-apk.md](./0003-velikost-apk.md) |
| 0004 | Web push notifikace | in progress | 1 | [0004-web-push-notifikace.md](./0004-web-push-notifikace.md) |
| 0005 | Web push notifikace pro iOS (Safari) | todo | 1 | [0005-ios-safari-web-push.md](./0005-ios-safari-web-push.md) |
| 0006 | Nepovinný telefon a IG při registraci + disclaimer o viditelnosti | todo | 1 | [0006-nepovinny-telefon-ig-registrace.md](./0006-nepovinny-telefon-ig-registrace.md) |
| 0007 | Nové zadávání času | todo | 1 | [0007-nove-zadavani-casu.md](./0007-nove-zadavani-casu.md) |
| 0008 | Scheduled začátek volna (max. den dopředu) | todo | 2 | [0008-scheduled-zacatek-volna.md](./0008-scheduled-zacatek-volna.md) |
| 0009 | User-based nastavení presetů | todo | 2 | [0009-user-presety.md](./0009-user-presety.md) |
| 0010 | Vlastní čas (manuální zadání) | todo | 3 | [0010-vlastni-cas.md](./0010-vlastni-cas.md) |
| 0011 | Přichycení (snap) času na nejbližší preset | todo | 1 | [0011-snap-casu-na-preset.md](./0011-snap-casu-na-preset.md) |
| 0012 | "Kde jsem" políčko (volný text) | todo | 3 | [0012-kde-jsem-policko.md](./0012-kde-jsem-policko.md) |
| 0013 | Lubomír mode on/off (vypnutý stav bez obrázků) | todo | 1 | [0013-lubomir-mode.md](./0013-lubomir-mode.md) |
| 0014 | Lepší always-on backend | todo | 1 | [0014-always-on-backend.md](./0014-always-on-backend.md) |
| 0015 | Rozvedení zadání nových tasků (0006–0014, 0016) | todo | 1 | [0015-rozvedeni-novych-tasku.md](./0015-rozvedeni-novych-tasku.md) |
| 0016 | Sessions nevydrží po scaledownu backendu | todo | 1 | [0016-sessions-nevydrzi-po-scaledownu.md](./0016-sessions-nevydrzi-po-scaledownu.md) |
