import { useEffect, useState } from 'react';

/**
 * True only once `pending` has been continuously true for >= delayMs.
 * Falls back to false immediately when `pending` goes false, so a fast
 * request never shows a spinner at all - only a slow one does.
 */
export function useDeferredPending(pending: boolean, delayMs = 600): boolean {
  const [showPending, setShowPending] = useState(false);

  useEffect(() => {
    if (!pending) {
      setShowPending(false);
      return;
    }
    const timer = setTimeout(() => setShowPending(true), delayMs);
    return () => clearTimeout(timer);
  }, [pending, delayMs]);

  return showPending;
}
