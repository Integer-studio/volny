# 0019 — Interaktivní onboarding po registraci

- **Stav:** done
- **Priorita:** 1
- **Datum vytvoření:** 2026-10-05

## Popis / kontext

Nový uživatel po registraci skončil na hlavní obrazovce bez vysvětlení (jen
odklikávací karta `OnboardingCard`). Průvodce ho teď provede:

1. **Úvod** (`app/onboarding.tsx`) – „Teď už můžeš dávat přátelům vědět, kdy
   jsi Volný/á – a nebudeš znít jako žebrák!“
2. **Kontakt** – telefon a Instagram (nepovinné). Z registračního formuláře
   se tahle pole přesunula sem.
3. **Plocha + oznámení** – podle platformy:
   - iOS Safari: video návod „Sdílet → Přidat na plochu“ (GIF převedený na
     MP4, `public/tutorial/`). Přihlášení se do aplikace z plochy přenese
     jednorázovým kódem v cookie (`lib/handoff.ts`), tam průvodce pokračuje
     zapnutím oznámení.
   - Android web: tlačítko „Zapnout oznámení“ + instalace přes
     `beforeinstallprompt` (nebo nápověda „⋮ → Přidat na plochu“).
   - Desktop / nainstalovaná PWA: jen zapnutí oznámení.
   - Nativní APK: krok se přeskočí (oznámení řeší `PushGate`).
4. **Nápovědy nad skutečným UI** (`components/tour/`) – ztmavení s výřezem:
   prstenec (uživatel ho opravdu posune), tlačítko (opravdu se nastaví
   volno), ikona Přátel → QR kód, ikona Skupin → Vytvořit skupinu, a nakonec
   ukázkový volný přítel „Pepa Volný“ (jen na FE, nikdy na API) s kontaktem
   v ProfileSheet.

Stav průvodce je per uživatel a per zařízení v AsyncStorage
(`volny:tour:<userId>`, mimo `lib/cache.ts`, aby ho neodmazala expirace ani
odhlášení). Spouští se jen po `signUp()`, přihlášení existujícího účtu ho
nespustí.

### Stav notifikací (rešerše 2026-10-05)

| Kde | Push |
|---|---|
| Android APK | Expo push (funguje) |
| Android Chrome – jen záložka | FCM web push funguje i se zavřeným prohlížečem (Doze může zdržet, BE posílá `Urgency: high`) |
| Android – nainstalovaná PWA | funguje stejně, navíc vlastní ikona a nastavení oznámení; Chrome jí od 2025 neodebírá oprávnění automaticky |
| iOS Safari záložka | nikdy (omezení platformy) |
| iOS aplikace z plochy (16.4+) | přes FCM (task 0005) |

## Kritéria splnění

- [x] BE: `POST /api/auth/handoff` + `POST /api/auth/handoff/redeem`
      (tabulka `HandoffCodes`, migrace `AddHandoffCodes`).
- [x] FE: úvodní kroky, nápovědy, ukázkový přítel, manifest + ikony,
      odstraněná `OnboardingCard`.
- [x] Ověřeno v Chromiu (mobilní viewport, Android i iPhone UA): celý
      průchod, přeskočení, reload po dokončení, handoff včetně opakovaného
      použití kódu (→ přihlašovací obrazovka).
- [ ] Ověřeno na reálném iPhonu (iOS 17.2+): po „Přidat na plochu“ se
      aplikace z plochy otevře přihlášená na kroku s oznámeními.
- [ ] Ověřeno na reálném Androidu: instalace (WebAPK) a povolení oznámení.
- [ ] Ověřeno v nativním APK (výřez nad modálními obrazovkami stacku).

## Poznámky

- Hotovo v [PR #11](https://github.com/Integer-studio/volny/pull/11), nasazeno
  2026-10-05 (BE, web i EAS Update prošly; na produkci ověřeno: handoff
  endpointy odpovídají, tabulka `HandoffCodes` existuje, manifest/ikony/video
  se servírují se správným content-type). Ověření na reálných zařízeních
  (tři nezaškrtnutá kritéria výš) zůstává otevřené – iPhone hlídá i
  [task 0005](./0005-ios-safari-web-push.md).

- Pro výstup `web.output: "single"` Expo bere `public/index.html`, ne
  `app/+html.tsx` (ověřeno exportem) – manifest a odchyt
  `beforeinstallprompt` jsou proto tam.
- Na hlavní obrazovce se během průvodce schovává
  `NotificationPermissionBanner` (překrýval by nápovědy).
- V úvodu průvodce schválně není obrázek Lubomíra Volného (viz task 0013).
  PWA ikony ho používají stejně jako stávající ikona aplikace.
