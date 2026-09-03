/**
 * Produkce je fallback schválně: build bez EXPO_PUBLIC_API_URL nesmí tiše
 * mířit na localhost - přesně tak vznikl "APK přihlášení fail" (release APK
 * mělo zapečené http://localhost:5135/api, protože eas.json nenastavoval
 * žádnou env). Lokální vývoj proti localhostu se nastavuje v .env.local
 * (viz .env.local.example).
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  'https://volny-be.ashysky-0141c791.germanywestcentral.azurecontainerapps.io/api';
