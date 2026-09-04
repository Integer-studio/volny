# 0004 — Web push notifikace

- **Stav:** in progress
- **Datum vytvoření:** 2026-09-04

## Popis / kontext

Navazuje na [task 0002](./0002-stav-oznameni.md), který zjistil, že push
notifikace fungují pouze na Androidu (přes Expo Push Service), zatímco web
i iOS je mají v kódu explicitně vypnuté (`isPushSupported` v
`apps/fe/lib/push.ts`) — Expo Push Service web nepodporuje. Web notifikace
byly vyhodnoceny jako potřebné.

Navržená architektura (viz Poznámky v tasku 0002): web push půjde mimo
Expo, přímo přes Firebase Cloud Messaging pro web, ve stávajícím Firebase
projektu, který už drží `google-services.json` pro Android.

## Kritéria splnění

- [x] Ve Firebase projektu přidaná Web app a vygenerovaný VAPID klíč
      (Cloud Messaging → Web configuration).
- [x] FE (web): `firebase-messaging-sw.js` service worker + získání FCM
      web tokenu přes Firebase JS SDK, registrace tokenu na BE.
- [x] BE: `UserDevice` rozlišuje typ tokenu (`expo` vs. `fcm_web`);
      `NotificationQueue`/worker odesílá FCM web tokeny přímo přes FCM
      HTTP v1 API (Expo tokeny beze změny přes `ExpoPushNotificationService`).
- [ ] Funkční end-to-end test pro alespoň jeden typ oznámení (např.
      `friend_request`) na webu — od vzniku události po zobrazení
      systémové notifikace v prohlížeči. **Dva bugy nalezené a opravené
      při prvním pokusu, viz Poznámky — čeká na re-test po nasazení.**
- [x] Opravená zastaralá dokumentace (`apps/be/SemFre/FE_PUSH_INSTRUCTIONS.md`,
      sekce "Push notifikace" v `API_DOCS.md`), ať odpovídá skutečné
      implementaci.

## Poznámky

Zdrojová analýza a rozhodnutí o architektuře jsou zapsané v
[tasku 0002](./0002-stav-oznameni.md#poznámky).

### Stav implementace (2026-09-04)

Kód je hotový na BE i FE a ověřený reálným buildem (`dotnet build`,
`dotnet ef database update` na testovací SQLite DB, `tsc --noEmit`,
`npx expo export -p web` — service worker se skutečně kopíruje do
`dist/`). `apps/fe/lib/firebaseWebConfig.ts` a
`apps/fe/public/firebase-messaging-sw.js` mají doplněné reálné hodnoty
(Web app config + VAPID klíč z Firebase Console, projekt
`volny-zaporatstvo`).

`Fcm__ServiceAccountJson` je nastavený jako secret na Container App
`volny-be` (resource group `volny`). Všechny manuální kroky mimo repo jsou
tím hotové.

Implementační detaily: BE nový `FcmWebPushNotificationService` (FirebaseAdmin
SDK) + `NotificationServiceDispatcher` (routing podle formátu tokenu, beze
změny `NotificationBackgroundService`), `UserDevice.TokenType` sloupec +
migrace. FE `PushGateWeb` (`components/PushGate.tsx`), `getFcmWebTokenAsync`
+ `routeForPushPayload` (`lib/push.ts`, sdílené s native tap routingem).

### První ruční E2E test (2026-09-04) — 2 bugy nalezeny a opravené

Po prvním nasazení (PR integer-studio/volny#3, mergnuto) ruční test se
dvěma účty ve Firefoxu odhalil dva samostatné bugy:

1. **Permission prompt se nezobrazil u druhého účtu** — Firefox tiše
   odmítne `Notification.requestPermission()`, pokud neběží přímo uvnitř
   user-gesta (kliku). Kód ho volal automaticky v `useEffect` při mountu
   `PushGateWeb`. Oprava: nová `apps/fe/components/NotificationPermissionBanner.tsx`
   (vzor `OfflineBanner`), mountovaná v `app/_layout.tsx` vedle `PushGate`;
   `Notification.requestPermission()` (přes `api.registerPushToken()`) se
   teď volá jen z `onPress` banneru. `PushGateWeb` si nechává jen tichý
   token-refresh pro uživatele s už uděleným oprávněním (`needsWebNotificationPrompt`
   guard v `lib/push.ts`).
2. **Notifikace nedorazila ani účtu s platným tokenem a uděleným oprávněním**
   — BE log potvrdil úspěšné odeslání (`FCM web push ...: 1 ok`), ale nic
   se nezobrazilo. Příčina: zprávy nesly top-level `notification` payload,
   který Firebase Web SDK při **fokusovaném tabu** doručí do `onMessage()`
   na stránce místo do service workeru — a `onMessage` nebyl vůbec
   implementovaný. Oprava: zprávy jsou teď plně data-only
   (`FcmWebPushNotificationService.cs` — `title`/`body` v `Data` slovníku,
   žádný top-level `Notification`/`Webpush.Notification`), nová
   `listenForForegroundFcmMessages()` v `lib/push.ts` (volaná z
   `PushGateWeb`) ručně zobrazí `new Notification(...)` pro fokusovaný tab,
   `firebase-messaging-sw.js`'s `onBackgroundMessage` čte `payload.data`
   místo `payload.notification` pro nefokusovaný/zavřený tab.

Ověřeno `dotnet build`, `tsc --noEmit`, `npx expo export -p web` (service
worker v `dist/` identický se zdrojem). Čeká na nasazení (nový PR) a
opakovaný ruční E2E test — pak zaškrtnout poslední kritérium.

### Druhý ruční test (2026-09-04) — 4 další zjištění po nasazení opravy č. 1

Po mergi opravy z předchozí sekce (PR integer-studio/volny#4) další kolo
testování odhalilo:

1. **`friend_imfree` chodil úplně všem spojením**, i těm, co zrovna volno
   nemají — opraveno v `FreeTimesController.NotifyConnectionsImFreeAsync`:
   nový filtr na aktuálně aktivní `FreeTime` (stejný dotazový vzor jako
   `ConnectionsController.Free`, `GET /api/connections/free`), notifikace
   teď jde jen spojením, co jsou taky právě volná.
2. **Android push nedorazí** — v kódu (Expo cesta) nenalezena žádná
   regrese z předchozích dvou PR. Zůstává otevřené, čeká na diagnostiku z
   BE logu při příštím reálném testu (stejný postup jako u FCM — najít
   řádky `ExpoPushNotificationService` kolem času odeslání) a ověření, že
   nainstalovaná appka má nejnovější EAS Update.
3. **Web, fokusovaný tab: notifikace ukázala jen "Volný" (fallback text),
   bez title/body.** Nefokusovaný tab chvíli fungoval správně, pak přestal.
   U jednoho účtu se navíc vůbec neobjevil banner z opravy č. 1, přestože
   `Notification.permission` byl `default` (banner se zobrazit měl).
4. **Kořenová příčina bodu 3 (obojí)**: zastaralý cachovaný service worker
   / JS bundle v testovacím prohlížečovém profilu. `firebase-messaging-sw.js`
   byl natvrdo připnutý na Firebase SDK `11.0.0` (CDN), zatímco
   `package.json` (`"firebase": "^11.0.0"`) reálně nainstaloval `11.10.0` —
   SW a stránka běžely na different verzích SDK. SW navíc neměl
   `skipWaiting()`/`clients.claim()`, takže při opakovaných nasazeních
   během testování mohla stará verze SW běžet mnohem déle, než by měla.
   Opraveno: `firebase-messaging-sw.js` teď má `self.skipWaiting()` +
   `clients.claim()` na `activate`, CDN verze sjednocená na `11.10.0`
   (stejně jako `package.json`, teď přesně připnuté, ne `^11.0.0`), a
   `staticwebapp.config.json` má `Cache-Control: no-cache` route pro
   `/firebase-messaging-sw.js`, ať prohlížeč vždy zkontroluje nejnovější
   verzi.

Ověřeno `dotnet build`, `tsc --noEmit`, `npx expo export -p web`. Bod 2
(Android) zůstává neopravený — nejde jen o kód, potřeba dat z BE logu z
reálného testu. Čeká na nasazení (nový PR) a další kolo ručního testu,
tentokrát v čistém prohlížečovém profilu (bez starého SW).
