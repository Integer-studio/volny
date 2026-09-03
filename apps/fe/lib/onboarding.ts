import { api } from './api';
import { readCacheSync, writeCache } from './cache';

const NAME = 'onboardingDismissed';

// Backed by lib/cache.ts (not raw Storage) so the flag is available
// synchronously on first render via hydrateCache()'s boot-time mirror - a
// SecureStore round-trip here is what made OnboardingCard flash in (hidden
// -> shown once the read resolved -> hidden again once connectionCount
// arrived), since the two gates had opposite polarity and only one was sync.
export function getOnboardingDismissedSync(): boolean {
  const userId = api.getCurrentUserId();
  if (userId == null) return false;
  return readCacheSync<boolean>(String(userId), NAME)?.data === true;
}

export function setOnboardingDismissed(): void {
  const userId = api.getCurrentUserId();
  if (userId == null) return;
  writeCache(String(userId), NAME, true);
}
