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
| 0003 | Zmenšit velikost APK | todo | [0003-velikost-apk.md](./0003-velikost-apk.md) |
| 0004 | Web push notifikace | todo | [0004-web-push-notifikace.md](./0004-web-push-notifikace.md) |
