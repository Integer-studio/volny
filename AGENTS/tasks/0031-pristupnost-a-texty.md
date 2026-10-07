# 0031 — Přístupnost a texty

- **Stav:** todo
- **Priorita:** 3
- **Datum vytvoření:** 2026-10-07

## Popis / kontext

- **Špatný pád ve čtečce** — `PresetList.tsx:100` a `TimeRing/index.tsx:754`
  skládají `Volný do ${label.toLowerCase()}` → "Volný do ráno / večer /
  půlnoc". Chce to 2. pád (do rána, do večera, do půlnoci…).
- **Plurál** — `join/[code].tsx`: `memberCount === 1 ? 'člen' : 'členů'` →
  "3 členů". `memberCountLabel` v `groups/index.tsx` to umí správně.
- **Nadpis před označením** — `FreeDial` ukazuje "Volný do 16:00" i když
  uživatel volný není. Noví uživatelé si můžou myslet, že už volní jsou.
  Návrh: "Volno do 16:00?" / "Nastav: do 16:00".
- **Hlavní tlačítko** — popisek "Označit se jako volný" bez času, chybí
  `accessibilityState={{ busy }}`.
- **Ikonová tlačítka bez `accessibilityLabel`/role** — přidat/přijmout/
  odmítnout/odebrat v hledání, QR ve skupině, zavření v `add-friend`,
  `BackButton`, oko u hesla, přepínač režimu v sign-in, scrim `BottomSheet`.
- `FormField` — label není propojený s inputem, chyba se neoznamuje.
- `BootSplash` má natvrdo text cold startu místo `COLD_START_MESSAGE`.
- "Nový kód vygenerován" vs "Nový odkaz vygenerován". QR sheet skupiny nemá
  Kopírovat/Sdílet jako QR přítele.
- `useNow` tiká po 60 s nezarovnaně a po návratu do appky se neobnoví →
  zastaralé "za 5 min" kolem kotevních časů.

## Kritéria splnění

- [x] Všechna ikonová tlačítka mají label a roli.
- [ ] Genitivní popisky presetů (ideálně jako pole v datech presetů, viz
      0009).
- [ ] Opravené plurály a sjednocené texty.
- [ ] `useNow` zarovnaný na minutu a obnovený na `AppState` `active`.

## Poznámky

**2026-10-07 (skupina A), hotové části:**
- Popisky presetů pro čtečku jsou "Volný do 21:00, Večer" místo
  skloňování. Názvy si uživatel píše sám, takže 2. pád by nešel zaručit.
- Nadpis `FreeDial` je "Volný do 16:00?", dokud volno neběží, a za běhu
  "Volný do 16:00!".
- Hlavní tlačítko má v popisku čas a `accessibilityState` `busy`.
- `useNow` tiká zarovnaně na minutu a obnoví se při návratu do appky.

Zbytek patří do skupin B, D a F.

**2026-10-07 (skupina B):** Label a roli dostala ikonová tlačítka v
hledání, QR a obnova odkazu ve skupině, zavření v `add-friend`,
`BackButton`, oko u hesla, přepínač režimu v sign-in a scrim
`BottomSheet`u. Sjednocený text je "Nový odkaz vygenerován".

**2026-10-07 (skupina D):** `FormField` dává inputu `accessibilityLabel` z
popisku a chybu do `accessibilityHint` a live regionu, umí `hint` a `ref`.
`BootSplash` používá `COLD_START_MESSAGE`. Texty "Handle"/"přezdívka" →
"uživatelské jméno", "zabrané" → "obsazené". Zbývá skupina F: plurál
"členů" v `join/[code].tsx` a Kopírovat/Sdílet v QR sheetu skupiny.
