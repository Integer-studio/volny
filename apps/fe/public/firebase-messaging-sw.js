/**
 * Firebase Cloud Messaging service worker (task 0004 — web push).
 *
 * This file is copied verbatim into the web build output root by Expo's web
 * export (everything under apps/fe/public/ ends up at the site root), and is
 * never processed by Metro - it cannot import app code or read
 * process.env.EXPO_PUBLIC_*. The Firebase config below MUST be kept in sync
 * by hand with apps/fe/lib/firebaseWebConfig.ts (same non-secret values).
 *
 * Uses the "compat" build because this is a classic (non-module) service
 * worker - no bundler runs over this file, so there's no import resolution
 * for the modular SDK here.
 */
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

// Keep in sync with apps/fe/lib/firebaseWebConfig.ts (FIREBASE_WEB_CONFIG).
firebase.initializeApp({
  apiKey: 'REPLACE_WITH_FIREBASE_WEB_API_KEY',
  authDomain: 'volny-zaporatstvo.firebaseapp.com',
  projectId: 'volny-zaporatstvo',
  storageBucket: 'volny-zaporatstvo.appspot.com',
  messagingSenderId: 'REPLACE_WITH_FIREBASE_SENDER_ID',
  appId: 'REPLACE_WITH_FIREBASE_WEB_APP_ID',
});

const messaging = firebase.messaging();

// Fires when a push arrives while no tab has focus (or none is open at all) -
// the case a plain browser tab can never handle on its own.
messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || 'Volný', {
    body: body || '',
    icon: '/assets/images/volny.png',
    data: payload.data || {},
  });
});

// Tapping the system notification: focus an existing app tab if there is
// one, otherwise open a new one, and relay the notification's `data` payload
// to the page so PushGateWeb (lib/push.ts's routeForPushPayload) can route
// exactly like the native tap handler does.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const payload = event.notification.data || {};

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'push-notification-click', payload });
          return client.focus();
        }
      }
      return self.clients.openWindow('/');
    })
  );
});
