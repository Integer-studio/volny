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

- [ ] Všechna ikonová tlačítka mají label a roli.
- [ ] Genitivní popisky presetů (ideálně jako pole v datech presetů, viz
      0009).
- [ ] Opravené plurály a sjednocené texty.
- [ ] `useNow` zarovnaný na minutu a obnovený na `AppState` `active`.
