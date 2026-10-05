import { Platform } from 'react-native';
import { isStandalone } from './platform-web';

/**
 * Přenos přihlášení ze Safari do aplikace na ploše iOS (task 0019).
 *
 * Aplikace přidaná na plochu má na iOS vlastní localStorage, takže token ze
 * Safari nevidí. iOS 17.2+ ale při "Přidat na plochu" zkopíruje cookies -
 * krok s návodem proto uloží do cookie jednorázový kód z
 * `POST /auth/handoff` a aplikace z plochy ho při prvním spuštění vymění za
 * vlastní tokeny. Když cookie chybí nebo kód propadl, uživatel uvidí
 * obyčejné přihlášení.
 */
const COOKIE = 'volny_handoff';
/** Stejně jako platnost kódu na backendu (AuthController.HandoffLifetime). */
const MAX_AGE_S = 600;

const hasDocument = Platform.OS === 'web' && typeof document !== 'undefined';

export function writeHandoffCookie(code: string): void {
  if (!hasDocument) return;
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE}=${encodeURIComponent(code)}; Max-Age=${MAX_AGE_S}; Path=/; SameSite=Lax${secure}`;
}

export function readHandoffCookie(): string | null {
  if (!hasDocument) return null;
  const hit = document.cookie.split('; ').find(c => c.startsWith(`${COOKIE}=`));
  return hit ? decodeURIComponent(hit.slice(COOKIE.length + 1)) || null : null;
}

export function clearHandoffCookie(): void {
  if (!hasDocument) return;
  document.cookie = `${COOKIE}=; Max-Age=0; Path=/`;
}

/** Jen aplikace z plochy si kód bere - v Safari by se jím jen přihlásil ten samý uživatel podruhé. */
export function pendingHandoffCode(): string | null {
  return isStandalone() ? readHandoffCookie() : null;
}
