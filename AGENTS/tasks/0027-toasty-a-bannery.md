# 0027 — Toasty pod modaly, umístění toastu a banneru

- **Stav:** todo
- **Priorita:** 2
- **Datum vytvoření:** 2026-10-07

## Popis / kontext

- **Toast je pod RN `Modal`em** — `ToastProvider` se vykresluje pod
  `BottomSheet`em (přiznává to komentář v `ProfileSheet.tsx:40`). Chyby při
  přidání/přijetí/odmítnutí v `ProfileSheet` a při joinu v `GroupInviteSheet`
  tak nejsou vidět. Ukážou se až po zavření sheetu, nebo už mezitím
  vyprší.
- Toast má pevné `bottom: 32` a ignoruje safe area. Na iPhonu může sedět na
  home indicatoru.
- `OfflineBanner` (absolutně `top: 0`) překrývá horní ikony v hlavičce a
  bere jim ťuknutí.
- `NotificationPermissionBanner` nejde zavřít a taky překrývá horní lištu.
- Toast nemá `accessibilityLiveRegion`/`role="alert"`, takže čtečka chyby
  neoznámí.

## Kritéria splnění

- [ ] Toasty jsou vidět i nad otevřeným sheetem (host uvnitř `BottomSheet`,
      nebo chybový řádek přímo v sheetu).
- [ ] Toast respektuje `insets.bottom`.
- [ ] Offline a notifikační banner posunou obsah, místo aby ho překryly.
      Notifikační banner jde zavřít (na nějakou dobu).
- [ ] Toast je live region.
