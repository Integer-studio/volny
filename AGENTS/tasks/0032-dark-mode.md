# 0032 — Dark mode

- **Stav:** todo
- **Priorita:** 3 (polish/nice-to-have)
- **Datum vytvoření:** 2026-10-07

## Popis / kontext

Appka má jen světlý režim. Má respektovat systémové nastavení a umět i tmavý.

**Zjištěný current stav (2026-10-07):** `apps/fe/app.json` má natvrdo
`"userInterfaceStyle": "light"`. NativeWind/nativecn tokeny `dark-*` a
`dark:` varianty už existují (např. `components/ui/button/styles.ts`), ale
zbytek appky má barvy natvrdo jako hex (cca 30 souborů v `app/`,
`components/` a `lib/`). Patří sem i kresba prstence v `TimeRing`
(`react-native-svg`), kam se třídy nedostanou a barvy musí jít přes props.

## Kritéria splnění

- [ ] Appka respektuje systémové nastavení (`userInterfaceStyle: "automatic"`,
      `useColorScheme`), na webu `prefers-color-scheme`.
- [ ] Natvrdo dané barvy jsou nahrazené tokeny (Tailwind/NativeWind `dark:`),
      včetně SVG prstence, sheetů, toastů a bannerů.
- [ ] Status bar, splash a PWA `theme_color` odpovídají režimu.
- [ ] Ověřeno na webu, Androidu a iOS v obou režimech (kontrast, Lubomír mode).

## Poznámky

Souvisí s [0031](./0031-pristupnost-a-texty.md) (kontrast, přístupnost).
