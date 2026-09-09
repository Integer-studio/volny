# 0011 — Přichycení (snap) vlastního času k nejbližšímu presetu

- **Stav:** todo
- **Priorita:** 1 (musí být hotové před veřejným releasem — součást implementace [0007](./0007-nove-zadavani-casu.md))
- **Datum vytvoření:** 2026-09-06

## Popis / kontext

Když uživatel otevře appku, výchozí zobrazený/předvyplněný čas má
"snapnout" na nejbližší preset, který je zároveň alespoň 1 hodinu vzdálený
od aktuálního času — ne prostě na úplně nejbližší preset. Mimo to má
uživatel při zadávání času vždy mít i možnost nastavit si čas vlastní
(mimo presety).

**Zjištěný current stav (2026-09-06):** Dnes žádná taková logika
neexistuje — `toggleFree()` v `apps/fe/app/index.tsx` vždy resetuje
`hourIndex` na `1` (tj. nejbližší celá hodina přes `nextHour()` v
`apps/fe/lib/time.ts`), bez ohledu na presety. Task závisí na existenci
konfigurovatelných presetů z [0009](./0009-user-presety.md) — bez nich
není co snapovat.

## Kritéria splnění

- [ ] Při otevření appky se výchozí navrhovaný čas nastaví na nejbližší
      preset (z [0009](./0009-user-presety.md)) splňující podmínku, že je
      vzdálený od teď alespoň 1 hodinu — ne prostě na úplně nejbližší
      preset.
- [ ] Nová funkce vedle `hourOffset`/`nextHour` v `apps/fe/lib/time.ts`
      implementující pravidlo "nejbližší preset, ale ≥ 1h od teď".
- [ ] Vedle snapnutého presetu je vždy dostupná i akce pro zadání
      vlastního času (viz [0010](./0010-vlastni-cas.md)).
- [ ] [0009](./0009-user-presety.md) (existence konfigurovatelných
      presetů) je prerekvizita — tento task nelze dokončit dřív.

## Poznámky

**Částečně hotové (2026-09-07, [0007](./0007-nove-zadavani-casu.md)).** Pravidlo
"nejbližší preset, ale ≥ 1 h od teď" je implementované jako `defaultTarget()`
v `apps/fe/components/TimeRing/presets.ts` (ne v `lib/time.ts`, jak čekala
kritéria — patří k presetům, ne k obecné práci s časem) a prstenec s ním
startuje. Vlastní čas mimo presety je dostupný pořád, tažením prstence.

Zbývá jen napojit to na uživatelské presety z [0009](./0009-user-presety.md)
místo pevného seznamu kotev.

Má to jednu hranu, která se možná bude chtít změnit: ve 23:40 je půlnoc jen
20 minut daleko, takže se přeskočí a výchozí padne na oběd druhý den, tedy
12hodinové volno. Odpovídá to zadání, ale rozumnější by možná byl fallback
"+2 h".

Vzniklo jako součást dávky nových tasků 2026-09-06, rozvedeno v [0015](./0015-rozvedeni-novych-tasku.md).
