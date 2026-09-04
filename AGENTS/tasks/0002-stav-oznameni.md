# 0002 — Zjistit a definovat stav oznámení (mobil i web)

- **Stav:** done
- **Datum vytvoření:** 2026-09-04

## Popis / kontext

Přesunuto z `apps/fe/README.md` Todos ("zjistit stav oznameni, i na webu").
Úkol je průzkumný/rozhodovací: zjistit, jaké typy oznámení produkt
potřebuje, a ověřit současný stav na mobilu i na webu.

## Kritéria splnění

- [x] Sepsaný seznam typů oznámení, které by aplikace měla podporovat
      (např. friend request, pozvánka do skupiny, někdo se stal "volným" atd.).
- [x] Zjištěno, co z tohoto seznamu aktuálně funguje na mobilu.
- [x] Zjištěno, co z tohoto seznamu aktuálně funguje (nebo nefunguje) na webu.
- [x] Návrh, co je potřeba doplnit/opravit.

## Poznámky

### Typy oznámení (aktuálně generované na BE)

1. `friend_request` — nová žádost o přátelství
   (`FriendSuggestionsController.cs`).
2. `friend_accepted` — přijetí žádosti o přátelství
   (`FriendSuggestionsController.cs`).
3. `friend_added_via_qr` — přidání kamaráda přes QR kód
   (`FriendsController.cs`).
4. `friend_imfree` — uživatel se stal "volným", rozeslané všem
   propojením (přátelé + členové sdílených skupin) přes
   `IConnectionService` (`FreeTimesController.cs`,
   `NotifyConnectionsImFreeAsync`).

### Stav na mobilu (Android)

Funguje end-to-end: `expo-notifications` na FE (`apps/fe/lib/push.ts`,
`PushGate.tsx`) → registrace Expo push tokenu → BE fronta
(`NotificationQueue` + `NotificationBackgroundService`, in-memory, bez
perzistence) → `ExpoPushNotificationService` odesílá přes Expo Push
Service (`https://exp.host/--/api/v2/push/send`) → tap na notifikaci
routuje na `/search` (friend_request/friend_accepted) nebo `/` (friend_imfree).

Žádná in-app reprezentace (seznam, badge, zvonek) neexistuje — jediný
notifikační prvek je systémová push notifikace.

### Stav na webu (a iOS)

Nefunguje vůbec. `isPushSupported = Platform.OS === 'android'`
(`apps/fe/lib/push.ts`) push explicitně vypíná na všech ostatních
platformách. Ověřeno i oficiální dokumentací Expo (docs.expo.dev) —
Expo Push Service staví výhradně na nativní funkcionalitě Androidu a
iOS a web push nepodporuje vůbec (`getExpoPushTokenAsync` na webu
nevrací použitelný token).

Zastaralá dokumentace `apps/be/SemFre/FE_PUSH_INSTRUCTIONS.md` a část
`API_DOCS.md` popisují plán s Firebase Cloud Messaging + web service
workerem, který nikdy nebyl implementován tak, jak je napsáno —
skutečná implementace je Expo-based a web vůbec nepokrývá. Tuto
dokumentaci je potřeba při implementaci webu opravit.

### Rozhodnutí / návrh dalšího postupu

Web notifikace jsou potvrzeně potřeba (rozhodnuto 2026-09-04). Protože
Expo Push web nepodporuje, půjde mimo Expo, přímo přes Firebase Cloud
Messaging pro web — využije se stávající Firebase projekt (ten, co už
drží `google-services.json` pro Android):

1. Firebase Console → do existujícího projektu přidat Web app →
   vygenerovat VAPID klíč (Cloud Messaging → Web configuration).
2. FE (web) → `firebase-messaging-sw.js` service worker + `getToken()`
   z Firebase JS SDK → raw FCM web token (jiný formát než
   `ExponentPushToken[...]`).
3. BE → `UserDevice` rozšířit o typ tokenu (`expo` vs. `fcm_web`),
   `NotificationQueue`/worker rozliší podle typu při odesílání: Expo
   token → stávající `ExpoPushNotificationService`, FCM web token →
   přímé volání FCM HTTP v1 API.
4. Android zůstává beze změny (Expo Push funguje, není důvod migrovat).

In-app UI pro oznámení (seznam/badge) se aktuálně neplánuje — mimo
rozsah.

Samotná implementace vyčleněna do
[tasku 0004](./0004-web-push-notifikace.md).
