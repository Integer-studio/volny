# 0024 — Mizející rychlá volba (presety)

- **Stav:** done
- **Priorita:** 1
- **Datum vytvoření:** 2026-10-07

## Popis / kontext

"Presety občas prostě zmizí." Audit našel tři mechanismy:

1. **Race v `components/Reveal.tsx` (hlavní příčina).** `PresetList` je
   obalený `<Reveal visible={!isFree} delayMs={180}>` (`FreeDial.tsx:224`).
   Skrytí spustí 160ms fade-out, který po dokončení zavolá
   `setRendered(false)`. Když se `visible` vrátí na `true` dřív, než fade-out
   doběhne, `setRendered(true)` nic neudělá (pořád je `true`), fade-in čeká
   180 ms, fade-out mezitím doběhne s `finished: true` a seznam odmountuje.
   Rychlá volba pak zůstane pryč až do dalšího celého cyklu
   volný → nevolný, nebo do reloadu.
   Typické spouštěče:
   - offline / rychlá síťová chyba: `applyStatus` nastaví `isFree=true`
     hned, `POST /freetimes` spadne během milisekund (neretryuje se) a
     rollback `setIsFree(false)` přijde v okně 160 ms;
   - dvojťuk na hlavní tlačítko (to je zablokované až po 1 s,
     `useDeferredPending(statusPending, 1000)`).
   Stejný bug může schovat i sekci "Kdo je také volný". S Reduce Motion se
   neprojeví (delay se přeskočí).
2. **Ikony presetů na prstenci** (`TimeRing/index.tsx:742`,
   `if (off <= 0 || off > range) return null`) zmizí, když jsou mimo
   viditelné okno prstence (výchozí 6 h). Večer/Půlnoc/Ráno tak na prstenci
   často chybí a při tažení naskakují bez animace.
3. **Malé obrazovky** — seznam je pod ohybem a `BottomFade` se ukáže až po
   prvním scrollu (`canScrollMore` se počítá jen v `onScroll`).

## Kritéria splnění

- [x] `Reveal`: při zobrazení zastavit běžící exit (`stopAnimation`/run id)
      a v exit callbacku ověřit, že `visible` je pořád `false`.
- [x] Ikony mimo okno prstence se plynule skryjí/objeví (nebo se připnou na
      konec dráhy).
- [x] `canScrollMore` se počítá i v `onContentSizeChange`/`onLayout`.
- [x] Ověřeno: offline ťuknutí na "volný" a dvojťuk — rychlá volba zůstane.

## Poznámky

Souvisí s 0025 (dvojťuk a souběh zápisů) a 0011 (snap na preset).

**2026-10-07 (skupina A):**
- `Reveal` při zobrazení zastaví běžící exit a exit callback kontroluje
  aktuální `visible`.
- Ikony za koncem okna prstence se připnou na konec dráhy a vytrácejí se
  podle `range` (`PRESET_EDGE_FADE`).
- `canScrollMore` v `app/index.tsx` se počítá i z `onLayout` a
  `onContentSizeChange`.
- Zbývá ověřit offline ťuknutí a dvojťuk.
