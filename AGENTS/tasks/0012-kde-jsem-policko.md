# 0012 — "Kde jsem" políčko (volný text)

- **Stav:** todo
- **Priorita:** 3 (polish/nice-to-have)
- **Datum vytvoření:** 2026-09-06

## Popis / kontext

Volné textové pole, kam uživatel napíše, kde právě je (např. "u kina") —
jde o text zadaný ručně, ne o GPS/skutečnou polohu zařízení.

**Zjištěný current stav (2026-09-06):** Datový model volna (BE
`Models/FreeTime.cs`: `FreeTimeID`, `UserID`, `StartTime`, `EndTime`) žádné
textové pole nemá — jde o nové pole, vyžaduje novou DB migraci. Zadává se
v BottomSheet UI v `apps/fe/app/index.tsx` (kde se dnes volí jen čas) a
zobrazuje se přátelům v sekci "Kdo je také volný" (`UserRow` v
`index.tsx`) a ve vlastním stavu (`components/StatusHeadline.tsx`).

## Kritéria splnění

- [ ] Nové nepovinné textové pole (např. `Location`) přidané k modelu
      volna — BE `FreeTime` (nová migrace) + `FreeTimeDto`/
      `FreeTimeCreateDto`, FE `ActiveFreeTime`/`FreeEntry` v
      `apps/fe/lib/api.ts`.
- [ ] Validace délky — doporučený limit cca 50–80 znaků (podle vzoru
      `Name`/`Instagram` validace v `UserProfileUpdateDtoValidator`),
      stejná FE i BE validace a chybová hláška.
- [ ] Pole je nepovinné a bez GPS/lokalizační logiky — čistě ruční text.
- [ ] Zobrazuje se přátelům vedle času v sekci "Kdo je také volný"
      (`UserRow` v `apps/fe/app/index.tsx`) a ve vlastním stavu
      (`StatusHeadline.tsx`).
- [ ] Zadává se v BottomSheet UI vedle volby času (`apps/fe/app/index.tsx`).

## Poznámky

Vzniklo jako součást dávky nových tasků 2026-09-06, rozvedeno v [0015](./0015-rozvedeni-novych-tasku.md).
