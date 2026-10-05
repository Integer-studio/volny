import { Platform } from 'react-native';

/**
 * Detekce prostředí webové verze pro krok "přidej si appku na plochu"
 * (task 0019). Na nativu vrací všechno false - APK si oznámení řeší přes
 * PushGate a na plochu se nepřidává.
 */
const isWeb = Platform.OS === 'web' && typeof window !== 'undefined' && typeof navigator !== 'undefined';

/** Běží jako aplikace z plochy (iOS "Přidat na plochu", nainstalovaná PWA na Androidu/desktopu). */
export function isStandalone(): boolean {
  if (!isWeb) return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/** iPhone/iPad. iPadOS se od verze 13 hlásí jako Mac, pozná se podle dotyku. */
export function isIOS(): boolean {
  if (!isWeb) return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function isAndroidWeb(): boolean {
  return isWeb && /Android/.test(navigator.userAgent);
}

/** Událost `beforeinstallprompt` (Chromium). V lib.dom typech zatím není. */
export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

declare global {
  interface Window {
    /** Odchycené v app/+html.tsx ještě před startem Reactu - událost chodí brzy a jen jednou. */
    __volnyInstallPrompt?: InstallPromptEvent | null;
  }
}

export function getInstallPrompt(): InstallPromptEvent | null {
  return isWeb ? (window.__volnyInstallPrompt ?? null) : null;
}

export function clearInstallPrompt(): void {
  if (isWeb) window.__volnyInstallPrompt = null;
}
