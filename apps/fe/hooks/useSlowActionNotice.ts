import { useEffect } from 'react';
import { useDeferredPending } from './useDeferredPending';
import { useToast } from '../components/Toast';

/** Shared with BootSplash's own >4s copy, so the two surfaces can't drift apart. */
export const COLD_START_MESSAGE = 'Server se probouzí, chvilku to potrvá…';

/**
 * The mirror image of useDeferredPending's "no spinner if it's fast": a tap
 * needs to acknowledge instantly (that's the caller's own disabled/spinner
 * button state), but if the request is still running after 4s - a cold
 * Container App, not a bug - show a sticky toast explaining why, and clear
 * it the moment `pending` goes false.
 */
export function useSlowActionNotice(pending: boolean): void {
  const { show, hide } = useToast();
  const showNotice = useDeferredPending(pending, 4000);

  useEffect(() => {
    if (showNotice) {
      show(COLD_START_MESSAGE, 'success', null);
    } else {
      // Only dismiss if our own message is still the one showing - a result
      // toast the caller fired in the same tick this action settled must win.
      hide(COLD_START_MESSAGE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNotice]);
}
