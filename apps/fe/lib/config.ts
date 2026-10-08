/**
 * Produkce je fallback schválně: build bez EXPO_PUBLIC_API_URL nesmí tiše
 * mířit na localhost - přesně tak vznikl "APK přihlášení fail" (release APK
 * mělo zapečené http://localhost:5135/api, protože eas.json nenastavoval
 * žádnou env). Lokální vývoj proti localhostu se nastavuje v .env.local
 * (viz .env.local.example).
 */
const CONFIGURED_API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  'https://volny-be.ashysky-0141c791.germanywestcentral.azurecontainerapps.io/api';

/**
 * Dev web otevřený z jiného zařízení v síti (http://192.168.x.y:8081): tam
 * "localhost" z .env.local míří na to zařízení, ne na vývojový stroj. Host se
 * proto nahradí tím, odkud se stránka načetla - funguje pro jakoukoli IP
 * (Wi-Fi, dok, Tailscale) bez přepisování .env.local. Jen v dev buildu na
 * webu; produkce ani nativ se nemění.
 */
function resolveApiUrl(url: string): string {
  if (!__DEV__ || typeof window === 'undefined' || !window.location) return url;
  const pageHost = window.location.hostname;
  if (!pageHost || pageHost === 'localhost' || pageHost === '127.0.0.1') return url;
  return url.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1)(?=[:/])/, `$1${pageHost}`);
}

export const API_URL = resolveApiUrl(CONFIGURED_API_URL);

/** SignalR hub for realtime refetch signals (task 0001), next to /api on the same host. */
export const HUB_URL = API_URL.replace(/\/api\/?$/, '') + '/hubs/realtime';
