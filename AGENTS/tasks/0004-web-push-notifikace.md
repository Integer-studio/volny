# 0004 — Web push notifikace

- **Stav:** todo
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

- [ ] Ve Firebase projektu přidaná Web app a vygenerovaný VAPID klíč
      (Cloud Messaging → Web configuration).
- [ ] FE (web): `firebase-messaging-sw.js` service worker + získání FCM
      web tokenu přes Firebase JS SDK, registrace tokenu na BE.
- [ ] BE: `UserDevice` rozlišuje typ tokenu (`expo` vs. `fcm_web`);
      `NotificationQueue`/worker odesílá FCM web tokeny přímo přes FCM
      HTTP v1 API (Expo tokeny beze změny přes `ExpoPushNotificationService`).
- [ ] Funkční end-to-end test pro alespoň jeden typ oznámení (např.
      `friend_request`) na webu — od vzniku události po zobrazení
      systémové notifikace v prohlížeči.
- [ ] Opravená zastaralá dokumentace (`apps/be/SemFre/FE_PUSH_INSTRUCTIONS.md`,
      sekce "Push notifikace" v `API_DOCS.md`), ať odpovídá skutečné
      implementaci.

## Poznámky

Zdrojová analýza a rozhodnutí o architektuře jsou zapsané v
[tasku 0002](./0002-stav-oznameni.md#poznámky).
