# Push notifikace — instrukce pro frontend

Aplikace (`apps/fe`, Expo/React Native) posílá push notifikace přes dva
oddělené kanály, podle platformy:

- **Android** — Expo Push Service. Frontend získá Expo push token
  (`expo-notifications`, `ExponentPushToken[...]`) a zaregistruje ho na
  backendu. Backend odesílá přes `https://exp.host/--/api/v2/push/send`.
- **Web** (prohlížeč) — Firebase Cloud Messaging (FCM) HTTP v1, přímo, mimo
  Expo (Expo Push Service web nepodporuje). Frontend získá FCM web token
  přes Firebase JS SDK a zaregistruje ho na stejném backend endpointu.
- **iOS** — zatím nepodporováno (mimo rozsah).

Backend rozliší typ tokenu automaticky podle jeho formátu při registraci
(`POST /api/devices`) a uloží ho do `UserDevice.TokenType`
(`"expo"` | `"fcm_web"`) — frontend nemusí typ posílat explicitně, stačí
poslat `platform` (informativní) a samotný token.

## 1) Registrace zařízení — společný endpoint pro obě platformy

```
POST /api/devices
Authorization: Bearer <jwt>
Content-Type: application/json

{ "deviceToken": "<token>", "platform": "android" | "web" }
```

- Upsertuje podle `deviceToken` (unique). Idempotentní — bezpečné volat při
  každém startu appky.
- Success: `201 Created` (nový) nebo `200 OK` (update) → `DeviceDto`
  (obsahuje i `tokenType`).
- Odregistrace: `DELETE /api/devices/{id}`.

Skutečná implementace na FE: `apps/fe/lib/api.ts` (`registerPushToken`),
`apps/fe/lib/push.ts` (získání tokenu), `apps/fe/components/PushGate.tsx`
(lifecycle — kdy se registrace spouští a jak se řeší tap na notifikaci).

## 2) Android (Expo)

- `expo-notifications` (`getExpoPushTokenAsync`), token formátu
  `ExponentPushToken[...]`.
- Kanál: `channelId: "default"` — cross-repo kontrakt, backend ho musí
  posílat v každé Expo zprávě (viz `apps/fe/lib/push.ts`).
- Tap na notifikaci: `Notifications.useLastNotificationResponse()` v
  `PushGateNative` (`apps/fe/components/PushGate.tsx`).

## 3) Web (Firebase Cloud Messaging)

Předpoklad: ve Firebase projektu, který už drží `google-services.json` pro
Android, je přidaná **Web app** a vygenerovaný **VAPID klíč**
(Firebase Console → Project settings → Cloud Messaging → Web configuration).

- FE má vlastní `apps/fe/public/firebase-messaging-sw.js` — service worker,
  který přijímá zprávy na pozadí (`onBackgroundMessage` →
  `self.registration.showNotification(...)`) a řeší klik na notifikaci
  (`notificationclick` → fokus/otevření okna + `postMessage` do appky).
- Web config (API key, project ID, sender ID, app ID, VAPID klíč) je v
  `EXPO_PUBLIC_FIREBASE_*` proměnných prostředí (viz `apps/fe/lib/config.ts`)
  — **není to secret**, jde o veřejný web config, který se běžně commituje
  i přímo do klientského kódu/service workeru.
- Token se získává přes `getToken()` z Firebase JS SDK
  (`apps/fe/lib/push.ts`, `getFcmWebTokenAsync`), zaregistrovaný service
  worker se předává jako `serviceWorkerRegistration`.
- Tap na notifikaci se řeší **mimo React strom**, protože service worker
  běží nezávisle na stránce — `PushGateWeb`
  (`apps/fe/components/PushGate.tsx`) poslouchá zprávy ze service workeru
  přes `navigator.serviceWorker.addEventListener('message', ...)`.

## 4) Backend — provider config

```json
{
  "Expo": { "Enabled": true, "AccessToken": "<optional, enhanced security>", "ChannelId": "default" },
  "Fcm": { "ServiceAccountJson": "<celý obsah service account JSON jako string>" }
}
```

- `Expo:Enabled=false` nebo chybějící `Fcm:ServiceAccountJson` → daný kanál
  běží jako No-op (loguje, nic neposílá) — **druhý kanál tím není ovlivněný**
  (`NotificationServiceDispatcher` v `apps/be/SemFre/Services/`).
- `Fcm:ServiceAccountJson` je celý JSON service account klíč z Firebase
  Console (Project settings → Service accounts → Generate new private key),
  jako jedna konfigurační hodnota/env var (`Fcm__ServiceAccountJson` v Azure
  Container Apps) — ne cesta k souboru.

## 5) Testování

- Rychlý curl test registrace zařízení (Android/Expo token):
  ```
  curl -X POST http://localhost:5135/api/devices \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"deviceToken":"ExponentPushToken[xxxxxxxx]","platform":"android"}'
  ```
- End-to-end na webu: přihlásit se ve dvou prohlížečích/profilech, povolit
  notifikace, poslat friend request z jednoho účtu druhému a ověřit, že se
  zobrazí systémová notifikace prohlížeče (i se zavřenou/pozadí kartou) a
  klik na ni naviguje do appky.
