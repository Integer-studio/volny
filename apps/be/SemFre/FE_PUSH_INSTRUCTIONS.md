# Push notifikace — instrukce pro frontend

Cíl: rychlá a bezpečná integrace push‑notifikací na frontend (web + mobil) s použitím Firebase Cloud Messaging (FCM). Backend poskytuje endpointy pro registraci tokenu (`POST /api/devices`), správu tokenů a monitoring (`GET /api/notifications/stats`, `GET /api/notifications/dlq`).

Krátký přehled kroků
- Vytvořit Firebase projekt (konfigurace web + mobil).
- Na frontendu získat device token a poslat ho na backend přes `POST /api/devices` s Authorize header.
- Implementovat foreground handler (in‑app) a service worker (background) pro web.
- Na mobilech použít nativní balíky (`@react-native-firebase/messaging` nebo `firebase_messaging` ve Flutteru).

1) Požadavky / proměnné prostředí
- `REACT_APP_FIREBASE_CONFIG` — JSON objekt s Firebase web config (kopírovat z Firebase Console).
- `REACT_APP_VAPID_KEY` — VAPID key pro web push (Firebase Console → Cloud Messaging).

Příklad `env` (create‑react‑app / Vite):
```
REACT_APP_FIREBASE_CONFIG={"apiKey":"...","authDomain":"...","projectId":"...","messagingSenderId":"...","appId":"...","measurementId":"..."}
REACT_APP_VAPID_KEY=BNc...yourVAPID...
```

2) Web (React) — soubory a implementace

- Instalace
```
npm install firebase
```

- `src/services/pushService.ts` (stručně):
  - Inicializuje Firebase App a Messaging (modular v9).
  - `requestPermission()` — vyžádá Notification permission.
  - `getAndRegisterToken(authToken)` — získá `fcmToken` a pošle ho na backend:
    ```js
    await fetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ deviceToken: fcmToken, platform: 'web' })
    });
    ```
  - `onMessage()` — poslouchá foreground zprávy a volá callback pro in‑app notifikaci.
  - Token refresh: při `onTokenRefresh` získat nový token a poslat na backend.

- `public/firebase-messaging-sw.js` (service worker)
  - Registrovat handler `messaging.onBackgroundMessage(payload => { self.registration.showNotification(...); })`.
  - Service worker je nasazen v `public/` a registrován v app (default CRA/Vite chování).

- `src/components/PushPermission.tsx`
  - UI komponenta: vysvětlení proč a tlačítko `Enable notifications` → volá `requestPermission()` a `getAndRegisterToken()` po úspěchu.

Bezpečnostní poznámky (web)
- Vždy posílejte token na backend přes HTTPS a s `Authorization: Bearer <jwt>`.
- Neukládejte serverKey nebo jiné tajné klíče na klienta.

3) Mobil (React Native / Flutter)

- React Native (Android/iOS):
  - Použít `@react-native-firebase/messaging`.
  - Žádat o povolení (iOS explicitně), získat token `messaging().getToken()`, poslat na backend s `platform: 'android'|'ios'`.
  - iOS: nakonfigurovat APNs a propojit s Firebase.

- Flutter: použít `firebase_messaging` obdobně.

4) Testování a ověření
- Nejjednodušší test: Firebase Console → Cloud Messaging → vybrat „Send to token“ → vložit token.
- Integrační test: UX flow — uživatel A pošle request (friend suggestion), uživatel B přijme → backend enqueues notifikaci → ověřit příjem na zařízeních uživatele A.

5) UX doporučení
- Před vyžádáním permission zobrazit krátké vysvětlení (modal, tooltip) proč notifikace potřebujeme.
- Dát uživateli možnost odregistrovat zařízení (volání `DELETE /api/devices/{id}` v nastavení účtu).

6) Debugging a logs
- Pro první troubleshooting:
  - Zkontrolujte, že backend obdrží `POST /api/devices` (autorizace, body).
  - Z Firebase Console ověřte, zda token existuje a zda jsou poslány zprávy (response z FCM).
  - Pokud používáte No‑op backend (bez `Fcm:ServerKey`), server pouze loguje—nastavte `Fcm:ServerKey` v `appsettings.json` pro reálné odesílání.

7) Hotový prompt pro AI‑agenta (zkopírovat a poslat agentovi)
```
Vytvoř React TypeScript modul pro Firebase push-notifikace.
- Vygeneruj `src/services/pushService.ts`, `public/firebase-messaging-sw.js`, `src/components/PushPermission.tsx`.
- Použij `REACT_APP_FIREBASE_CONFIG` (JSON) a `REACT_APP_VAPID_KEY`.
- Implementuj: request permission, getToken, send token na `POST /api/devices` s `Authorization: Bearer <token>`, onMessage foreground handler, token refresh handling, retry při POST (3 pokusy), a krátký README s kroky pro integraci a testování přes Firebase Console.
Kód piš bezpečně (try/catch, neukládej serverKey na klienta) a použij TypeScript.
```

8) Příklady rychlého curl testu (backend musí být spuštěn a mít platný JWT):
```
curl -X POST http://localhost:5135/api/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deviceToken":"<FCM_TOKEN>","platform":"web"}'
```

9) Co vám můžu vygenerovat teď
- Pokud chcete, vygeneruji přímo hotové soubory pro React (TypeScript) podle výše uvedeného promptu. Napište `ano` a já přidám soubory.

---
Soubor vytvořen automaticky — upravte `VAPID` a `Firebase` hodnoty dle svého projektu.
