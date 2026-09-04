# 0005 — Web push notifikace pro iOS (Safari)

- **Stav:** todo
- **Datum vytvoření:** 2026-09-04

## Popis / kontext

Navazuje na [task 0004](./0004-web-push-notifikace.md) (web push přes FCM
pro desktop/Chromium/Firefox). iOS Safari byl v tasku 0004 vědomě mimo
rozsah. iOS má teď (2026-09-04) relativně vysokou prioritu, proto samostatný
task.

## Kritéria splnění

- [ ] Web manifest appky (`apps/fe/app.json`'s `expo.web` sekce / generovaný
      PWA manifest) doplněný o `icons` (víc velikostí), `name`/`short_name`,
      `display: "standalone"`, `theme_color` — bez `display: standalone`
      Safari nedovolí push ani po přidání na plochu.
- [ ] Detekce "appka běží jako nainstalovaná PWA" (`navigator.standalone`
      na iOS / `matchMedia('(display-mode: standalone)')` obecně).
- [ ] Vlastní onboarding UI pro iOS Safari uživatele, co appku ještě nemají
      na ploše — tutoriál "Sdílet → Přidat na plochu" (Safari nemá
      programový install prompt jako Chrome).
- [ ] Ověřeno na reálném iPhonu (iOS 16.4+): appka nainstalovaná z plochy
      dostane FCM web token, `POST /api/devices` ho zaregistruje
      (`TokenType: fcm_web` — token z Safari by měl projít stejnou cestou
      jako z Chromu/Firefoxu), a systémová notifikace se skutečně zobrazí
      (foreground i background).

## Poznámky

### Zjištění z rešerše (2026-09-04)

- **Firebase Cloud Messaging podporuje Safari** od srpna 2023 (Safari 16.1+/
  iOS,iPadOS 16.4+, po přechodu Safari na standardní Push API + VAPID).
  Firebase JS SDK (`getToken()`) tohle řeší transparentně — backend
  (`FcmWebPushNotificationService.cs` z tasku 0004) by tedy **neměl
  potřebovat žádnou změnu**, token ze Safari by měl přijít jako běžný
  `fcm_web` token stejnou cestou jako z Chromu/Firefoxu. Zdroj:
  [Firebase blog — Sending to MacOS, iOS Safari using FCM JS SDK](https://firebase.blog/posts/2023/08/fcm-for-safari/).
- **iOS 16.4+ podporuje web push JEN pro weby přidané na plochu** ("Add to
  Home Screen") — běžná karta v Safari notifikace nedostane vůbec, appka
  musí běžet ve standalone módu spuštěná z ikony na ploše. To je tvrdý
  limit platformy, žádná knihovna (viz níže) ho neobchází.
- Safari vrací jiný push endpoint (`https://web.push.apple.com/...`) než
  Chrome (`fcm.googleapis.com`), ale Firebase SDK/backend to abstrahuje —
  není potřeba nic řešit ručně na úrovni endpointů/VAPID.
- Zvažovali jsme třetí stranu (OneSignal a podobné) — **nevyplatí se** pro
  tenhle konkrétní problém: (a) FCM už Safari podporuje samo, není potřeba
  nová knihovna na "doručení", (b) knihovny jako OneSignal ani tak
  neobcházejí požadavek "Přidat na plochu" — pořád je nutné postavit
  vlastní onboarding UI, což je hlavní práce v tomhle tasku. OneSignal navíc
  od 2026-09/10 zavádí limit 1000 MAU/měsíc na free tier pro mobilní push
  (web push zůstává free) — irelevantní pro tenhle task, ale relevantní
  pokud by se řešila migrace celé notifikační vrstvy (mimo rozsah).
- Odhad práce: srovnatelné s tím, co už bylo hotové v tasku 0004
  (`NotificationPermissionBanner`) — nová menší feature (manifest + banner +
  detekce standalone), ne přestavba architektury. Hlavní riziko/neznámá:
  reálné testování na fyzickém iPhonu (nejde ověřit v sandboxu/simulátoru),
  Safari má historicky drobné verze-specifické bugy a service worker se na
  iOS uspává agresivněji než na desktopu.
- Plný kontext rešerše (včetně zvažovaných knihoven a Android dopadů) je
  v konverzaci k tasku 0004 — shrnuto zde jen to podstatné pro implementaci.
