/**
 * Firebase Web app config for FCM web push (task 0004). This is NOT a secret -
 * it identifies the Firebase project to the browser, the same way it ends up
 * embedded in every Firebase web app's bundle. It is duplicated (not imported)
 * into `public/firebase-messaging-sw.js`, because that file is copied verbatim
 * into the web build output and never passes through Metro - keep both in sync
 * by hand whenever this object changes.
 *
 * TODO(0004): replace with real values from Firebase Console (project
 * `volny-zaporatstvo` - the same project that already has `google-services.json`
 * for Android) -> Project settings -> General -> Add app -> Web, and the VAPID
 * key from Project settings -> Cloud Messaging -> Web configuration.
 */
export const FIREBASE_WEB_CONFIG = {
  apiKey: 'REPLACE_WITH_FIREBASE_WEB_API_KEY',
  authDomain: 'volny-zaporatstvo.firebaseapp.com',
  projectId: 'volny-zaporatstvo',
  storageBucket: 'volny-zaporatstvo.appspot.com',
  messagingSenderId: 'REPLACE_WITH_FIREBASE_SENDER_ID',
  appId: 'REPLACE_WITH_FIREBASE_WEB_APP_ID',
};

export const FIREBASE_VAPID_KEY = 'REPLACE_WITH_FIREBASE_VAPID_KEY';

/** True once the placeholders above have been filled in with real values. */
export const isFirebaseWebConfigured = !FIREBASE_WEB_CONFIG.apiKey.startsWith('REPLACE_WITH_');
