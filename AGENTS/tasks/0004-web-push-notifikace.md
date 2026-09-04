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
      systémové notifikace v prohlížeči. **Blokováno na BE service account
      JSON, viz Poznámky.**
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

Zbývá jen samotné **nasazení + end-to-end ověření** — kód je zatím jen na
branchi `claude/task-04-planning-dyqm50`, produkční `volny-be`/web běží se
starým kódem, který `Fcm:ServiceAccountJson` vůbec nečte. Až se branch
dostane na `main` (PR + merge → oba deploy workflow se spustí automaticky
podle `paths:`), proveď end-to-end test (dva prohlížeče, friend_request,
systémová notifikace, tap routing) a zaškrtni poslední kritérium.

Implementační detaily: BE nový `FcmWebPushNotificationService` (FirebaseAdmin
SDK) + `NotificationServiceDispatcher` (routing podle formátu tokenu, beze
změny `NotificationBackgroundService`), `UserDevice.TokenType` sloupec +
migrace. FE `PushGateWeb` (`components/PushGate.tsx`), `getFcmWebTokenAsync`
+ `routeForPushPayload` (`lib/push.ts`, sdílené s native tap routingem).
