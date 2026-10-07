# 0029 — Nastavení a oznámení: autosave a povolení notifikací

- **Stav:** done
- **Priorita:** 2
- **Datum vytvoření:** 2026-10-07

## Popis / kontext

**Oznámení**
- iOS Safari bez "Přidat na plochu" nemá cestu zpět k notifikacím.
  `NotificationPermissionBanner` se v tabu neukáže (`PushManager` chybí) a
  "Spustit průvodce znovu" krok s instalací přeskočí. V nastavení není
  sekce "Oznámení".
- Android: systémový dialog na povolení vyskočí hned po registraci přes
  intro onboardingu (`PushGateNative`), bez vysvětlení. Lidé ho odmítnou.
- Web: `Notification.requestPermission()` se volá až po `await` dvou
  dynamických importů. Safari/Firefox můžou gesto považovat za vypršené.
  Zavřený dialog (`default`) se v onboardingu hlásí jako "zablokovaná".

**Autosave v nastavení**
- Uživatelské jméno (přihlašovací!) se ukládá po 800 ms pauzy při psaní.
  Může se uložit napůl napsané jméno.
- Chyba uložení po zavření obrazovky do 800 ms se neukáže. Selhání samotného
  `refreshMe` se hlásí jako "Uložení se nezdařilo", i když se uložilo.
- Chybí `autoCorrect={false}` u jména a Instagramu (autokorekce + autosave).
- Popisek "Handle" (anglicky) vs "Uživatelské jméno" v registraci, různé
  formulace "jméno je zabrané/obsazené".

## Kritéria splnění

- [x] Sekce "Oznámení" v nastavení podle stavu: iOS tab → návod k instalaci,
      `default` → "Zapnout", `denied` → návod pro daný prohlížeč.
- [x] Na nativu žádost o povolení až po vysvětlujícím kroku (ne přes intro).
- [x] Web: `requestPermission()` synchronně v click handleru. `default` ≠
      "zablokováno".
- [x] Jméno se ukládá až na blur / "Uložit", s poznámkou "Tímto jménem se
      přihlašuješ".
- [x] Pending save se flushne při odchodu. `me` se aktualizuje z odpovědi
      `updateProfile`.
- [x] Sjednocené popisky a hlášky.

## Poznámky

Překrývá se s 0005 (iOS Safari web push).

**2026-10-07 (skupina D):** Uživatelské jméno se ukládá jen na blur / Enter
(`useAutosaveField` s `debounceMs: null`) s poznámkou "Tímto jménem se
přihlašuješ". Rozepsaná změna se při odchodu z nastavení uloží a případnou
chybu ohlásí toast. `me` se bere z odpovědi `PUT /users/me` (`applyMe`), bez
`refreshMe`. Jméno a Instagram mají `autoCorrect={false}`. Popisek
"Uživatelské jméno", hláška "je už obsazené" všude. Oznámení zbývají pro
skupinu E.

**2026-10-07 (skupina E):** Nový `lib/notifications.ts` sjednocuje stav
oznámení pro web i APK (`needsInstall` / `unsupported` / `default` /
`granted` / `denied`):
- Na webu se `Notification.requestPermission()` volá synchronně jako první
  věc v klepnutí. `getFcmWebTokenAsync` už o povolení nežádá, jen čte stav.
- Zavřený dialog (`default`) není "zablokováno". Průvodce i nastavení
  nabídnou zkusit znovu.
- APK: `PushGateNative` registruje jen při už povoleném stavu. O povolení
  se žádá z nového kroku průvodce (varianta `native` s vysvětlením), z
  lišty (teď i na APK) nebo z nastavení.
- Nastavení má sekci "Oznámení" podle stavu, včetně návodu pro iOS kartu a
  odblokování podle prohlížeče (`unblockInstructions`).

Neověřeno na zařízení: Android 13+ (dialog až po kroku průvodce), iOS
z plochy a Firefox/Safari (synchronní žádost).
