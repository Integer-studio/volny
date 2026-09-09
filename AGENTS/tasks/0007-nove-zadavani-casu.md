# 0007 — Nové zadávání času

- **Stav:** in progress
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

- [x] Nové UI pro volbu "volno do kdy" nahrazuje současný slider s krokem
      1 hodina — nový krok je 15 minut.
- [ ] UI zobrazuje presety definované v [0009](./0009-user-presety.md)
      (uživatelsky nastavitelné), místo natvrdo daných tlačítek
      `[1, 2, 3, 5]` hodin (`hourOffset` v `apps/fe/lib/time.ts`).
      **Blokováno 0009** — prstenec presety zobrazuje, ale bere je z pevného
      seznamu kotev v `apps/fe/components/TimeRing/presets.ts`. Až bude
      entita z 0009 hotová, vymění se za ni jen ten jeden seznam.
- [x] Vždy dostupná i možnost zadat vlastní čas
      (viz [0010](./0010-vlastni-cas.md)/[0011](./0011-snap-casu-na-preset.md))
      mimo presety.
- [x] Výchozí předvyplněný čas při otevření odpovídá logice snapu
      z [0011](./0011-snap-casu-na-preset.md).
- [x] Datová vrstva (BE `FreeTime`/`FreeTimeCreateDto`) zůstává beze změny.
      Na FE ale přibyl `api.extendMyStatus` — viz poznámky.
- [ ] Ověřeno manuálním průchodem appkou (Expo) — zadání času novým UI
      funguje na iOS/Android/webu. **Zatím jen web** (`npm run web`):
      nastavení, potvrzení i ukončení volna prochází proti API. Na iOS
      a Androidu neověřeno — chce to hlavně zkusit haptiku a plynulost
      tažení, které se na webu posoudit nedají.

## Implementace

Prstencový slider kolem hlavního tlačítka, chová se jako kuchyňský časovač.
Kód je v `apps/fe/components/`:

- `TimeRing/scale.ts` — časová škála. Prstenec je vždy **lineární okno**
  `[teď, teď + range]`, takže čárky jsou dokola rovnoměrné. "Zoom" dělá to,
  že okno hodnotu jen **dohání**, a to tím pomaleji, čím pomaleji uživatel
  táhne — pomalé míření prstenec prakticky zmrazí. Zadává se **absolutní
  čas** ("do 15:00"), ne délka; čárky sedí na nástěnných čtvrthodinách.
  Rozsah 15 min – 16 h.
- `TimeRing/index.tsx` — kresba (`react-native-svg`) a gesto (`PanResponder`,
  aby jelo shodně na nativu i na webu). Chytit jde jen handle; puštění
  pružinou dosedne na nejbližší **viditelnou** čárku. Setrvačnost má mrtvou
  zónu, aby běžné zadání nepřeskočilo o čtvrthodinu.
- `TimeRing/RingMarker.tsx` — cokoli, co stojí na prstenci a musí ustoupit
  handle: ikonky presetů (uhýbají) i čísla hodin (vytrácejí se).
- `TimeRing/presets.ts` — denní kotvy (oběd/po práci/večer/půlnoc) a pravidlo
  pro výchozí čas.
- `FreeDial.tsx` — složení prstence, tlačítka a popisku.

Z `apps/fe/app/index.tsx` tím odešel `BottomSheet` se sliderem i řádek čtyř
rychlých tlačítek; závislost `@react-native-community/slider` už není potřeba.

Tentýž prstenec slouží i **za běhu volna**: oblouk vede od `teď` do
`freeUntil`, takže se sám zkracuje, a puštění handle nový konec hned uloží.
To muselo jít přes nový `api.extendMyStatus`, tedy `PUT /freetimes/{id}` —
`POST /freetimes` v `FreeTimesController.Create` vždy zakládá **nový** záznam,
takže by vzniklo druhé překrývající se volno a přátelům by podruhé odešla
notifikace "má teď volno".

## Co ještě zbývá

- Presety z 0009 (viz kritéria výše).
- Ověření na iOS/Androidu.
- Klávesnice na webu prstenec neovládá: role `adjustable` je nastavená
  (čtečky na nativu umí "zvýšit/snížit"), ale RNW pro ni sama šipky
  neobsluhuje a vlastní `onKeyDown` v jejím API není. Kdo nemůže táhnout,
  má zatím jen klepnutí na presety.

## Poznámky

Implementováno 2026-09-07 na větvi `feature/prstencovy-slider-casu`.

Hmatová odezva prstence se řeší zvlášť v [0018](./0018-haptika-prstence.md).

Vzniklo jako součást dávky nových tasků 2026-09-06, rozvedeno v [0015](./0015-rozvedeni-novych-tasku.md).
Souvisí s [0009](./0009-user-presety.md), [0010](./0010-vlastni-cas.md) a
[0011](./0011-snap-casu-na-preset.md) — všechny se týkají zadávání času.
