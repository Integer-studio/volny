# 0027 — Toasty pod modaly, umístění toastu a banneru

- **Stav:** done
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

- [x] Toasty jsou vidět i nad otevřeným sheetem (host uvnitř `BottomSheet`,
      nebo chybový řádek přímo v sheetu).
- [x] Toast respektuje `insets.bottom`.
- [x] Offline a notifikační banner posunou obsah, místo aby ho překryly.
      Notifikační banner jde zavřít (na nějakou dobu).
- [x] Toast je live region.

## Poznámky

**2026-10-07 (skupina 0):**
- Hostitelé toastu jsou zásobník (`ToastHost` v `Toast.tsx`). Jeden je
  v `ToastProvider`u a další má každý otevřený `BottomSheet` uvnitř
  `Modal`u. Kreslí ho ten naposledy připojený.
- Spodek toastu je `max(32, insets.bottom + 16)`.
- Live region: Android přes `accessibilityLiveRegion`, web přes
  `role`/`aria-live`, iOS přes `announceForAccessibility`.
- Lišty kreslí `TopBanners` v toku nad `Stack`em. Horní safe area si vezme
  lišta a obsahu pod ní se podstrčí `insets.top = 0`.
- Notifikační lišta se dá zavřít křížkem na 7 dní (`localStorage`).
- Zbývá ověřit na zařízení: toast nad sheetem na Androidu/iOS, odsazení
  hlavičky pod lištou na iOS (nativní header), web.
