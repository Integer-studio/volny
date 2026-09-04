/**
 * Firebase Web app config for FCM web push (task 0004). This is NOT a secret -
 * it identifies the Firebase project to the browser, the same way it ends up
 * embedded in every Firebase web app's bundle. It is duplicated (not imported)
 * into `public/firebase-messaging-sw.js`, because that file is copied verbatim
 * into the web build output and never passes through Metro - keep both in sync
 * by hand whenever this object changes.
 */
export const FIREBASE_WEB_CONFIG = {
  apiKey: 'AIzaSyDBvD9cyXEmXs12HVhuQb5U9esHr7pOyWM',
  authDomain: 'volny-zaporatstvo.firebaseapp.com',
  projectId: 'volny-zaporatstvo',
  storageBucket: 'volny-zaporatstvo.firebasestorage.app',
  messagingSenderId: '666486389110',
  appId: '1:666486389110:web:273a8cb61e7ff99a826257',
};

export const FIREBASE_VAPID_KEY =
  'BOllGprX61brDybxkQZ9QYW-IscU3NX5HUBNVcsDsv-VgVPT0_tLq5I7YCp5xbveEW0wElQKW0Ceo4jtShnRnMY';

/** True once the placeholders above have been filled in with real values. */
export const isFirebaseWebConfigured = !FIREBASE_WEB_CONFIG.apiKey.startsWith('REPLACE_WITH_');
