# 0007 — Nové zadávání času

- **Stav:** todo
- **Priorita:** 1 (musí být hotové před veřejným releasem)
- **Datum vytvoření:** 2026-09-06

## Popis / kontext

Současné UI pro zadávání času (kdy má kdo volno) je nepřehledné/pomalé —
potřeba navrhnout a implementovat lepší způsob zadávání.

**Zjištěný current stav (2026-09-06):** Jediné místo je
`apps/fe/app/index.tsx` — 4 natvrdo daná rychlá tlačítka (`[1, 2, 3, 5]`
hodin dopředu, `hourOffset()` v `apps/fe/lib/time.ts`) a BottomSheet se
sliderem s rozsahem 1–24 **hodin, krok 1 hodina** (`hourIndex`) — žádná
granularita jemnější než celá hodina, žádné ikonky, žádná
uživatelská konfigurace. Datová vrstva (BE `FreeTime`/
`FreeTimeCreateDto`, FE `api.setMyStatus`) přitom libovolnou přesnost
zvládne už dnes (UTC `DateTime`/ISO string) — úprava je čistě na FE.

Tento task je zastřešující pro [0009](./0009-user-presety.md) (uživatelsky
nastavitelné presety), [0010](./0010-vlastni-cas.md) (vlastní čas na
minuty) a [0011](./0011-snap-casu-na-preset.md) (výchozí snap na preset)
— podrobná kritéria pro jednotlivé části jsou v těch tascích.

## Kritéria splnění

- [ ] Nové UI pro volbu "volno do kdy" nahrazuje současný slider s krokem
      1 hodina — nový krok je 15 minut.
- [ ] UI zobrazuje presety definované v [0009](./0009-user-presety.md)
      (uživatelsky nastavitelné), místo natvrdo daných tlačítek
      `[1, 2, 3, 5]` hodin (`hourOffset` v `apps/fe/lib/time.ts`).
- [ ] Vždy dostupná i možnost zadat vlastní čas
      (viz [0010](./0010-vlastni-cas.md)/[0011](./0011-snap-casu-na-preset.md))
      mimo presety.
- [ ] Výchozí předvyplněný čas při otevření odpovídá logice snapu
      z [0011](./0011-snap-casu-na-preset.md).
- [ ] Datová vrstva (BE `FreeTime`/`FreeTimeCreateDto`, FE
      `api.setMyStatus`) zůstává beze změny — úprava je čistě na FE.
- [ ] Ověřeno manuálním průchodem appkou (Expo) — zadání času novým UI
      funguje na iOS/Android/webu.

## Poznámky

Vzniklo jako součást dávky nových tasků 2026-09-06, rozvedeno v [0015](./0015-rozvedeni-novych-tasku.md).
Souvisí s [0009](./0009-user-presety.md), [0010](./0010-vlastni-cas.md) a
[0011](./0011-snap-casu-na-preset.md) — všechny se týkají zadávání času.
