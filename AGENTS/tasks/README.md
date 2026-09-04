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
| — | (zatím žádné úkoly) | — | — |
