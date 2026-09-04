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

- [ ] Ve Firebase projektu přidaná Web app a vygenerovaný VAPID klíč
      (Cloud Messaging → Web configuration). **Manuální krok, neprovedeno —
      viz Poznámky.**
- [x] FE (web): `firebase-messaging-sw.js` service worker + získání FCM
      web tokenu přes Firebase JS SDK, registrace tokenu na BE.
- [x] BE: `UserDevice` rozlišuje typ tokenu (`expo` vs. `fcm_web`);
      `NotificationQueue`/worker odesílá FCM web tokeny přímo přes FCM
      HTTP v1 API (Expo tokeny beze změny přes `ExpoPushNotificationService`).
- [ ] Funkční end-to-end test pro alespoň jeden typ oznámení (např.
      `friend_request`) na webu — od vzniku události po zobrazení
      systémové notifikace v prohlížeči. **Blokováno na prvním bodu výše.**
- [x] Opravená zastaralá dokumentace (`apps/be/SemFre/FE_PUSH_INSTRUCTIONS.md`,
      sekce "Push notifikace" v `API_DOCS.md`), ať odpovídá skutečné
      implementaci.

## Poznámky

Zdrojová analýza a rozhodnutí o architektuře jsou zapsané v
[tasku 0002](./0002-stav-oznameni.md#poznámky).

### Stav implementace (2026-09-04)

Kód je hotový na BE i FE, ale task zůstává `in progress` — dva kroky nejde
dokončit bez zásahu člověka:

1. **Firebase Console** (mimo repo, musí provést člověk s přístupem k
   projektu `volny-zaporatstvo`): Project settings → přidat Web app →
   zkopírovat config (`apiKey`, `messagingSenderId`, `appId`), Cloud
   Messaging → Web configuration → vygenerovat VAPID klíč, Project settings
   → Service accounts → vygenerovat nový privátní klíč (JSON) pro FCM HTTP v1.
2. **Doplnění hodnot do kódu/configu** po kroku 1:
   - `apps/fe/lib/firebaseWebConfig.ts` — nahradit `REPLACE_WITH_*`
     placeholdery reálnými hodnotami.
   - `apps/fe/public/firebase-messaging-sw.js` — nahradit stejné
     placeholdery (service worker se nesbaluje přes Metro, config je tam
     duplikovaný natvrdo — musí zůstat v souladu s `firebaseWebConfig.ts`).
   - BE `Fcm:ServiceAccountJson` (env proměnná/Container App secret) —
     celý obsah service account JSON.
3. Po doplnění hodnot provést end-to-end ověření podle plánu (dva prohlížeče,
   friend_request, systémová notifikace, tap routing) a zaškrtnout zbylá
   kritéria.

Implementační detaily: BE nový `FcmWebPushNotificationService` (FirebaseAdmin
SDK) + `NotificationServiceDispatcher` (routing podle formátu tokenu, beze
změny `NotificationBackgroundService`), `UserDevice.TokenType` sloupec +
migrace. FE `PushGateWeb` (`components/PushGate.tsx`), `getFcmWebTokenAsync`
+ `routeForPushPayload` (`lib/push.ts`, sdílené s native tap routingem).

**Ověření nebylo možné dokončit v tomto sandboxu** — chybí zde .NET SDK
(nelze spustit `dotnet build`/`dotnet ef`) a `firebase` balíček nebyl
nainstalován (offline `npm install`), takže BE build a FE web export je
potřeba ověřit v CI/lokálně před mergem.
