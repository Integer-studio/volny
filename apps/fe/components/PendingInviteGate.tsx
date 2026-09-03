import { useEffect } from 'react';
import { router } from 'expo-router';
import { api, ApiError } from '../lib/api';
import { getPendingInvite, clearPendingInvite } from '../lib/pending-invite';
import { useToast } from './Toast';

/**
 * Mounted alongside PushGate in the authenticated tree. Joins a group whose
 * invite code was stashed by app/join/[code].tsx before a logged-out visitor
 * was routed to sign-in/register - survives the register->login round trip,
 * a page reload on web, or an app relaunch, all of which happen between
 * "opened the link" and "is authenticated". Joins automatically (rather than
 * bouncing to /join/CODE for a second confirmation) so a fresh login or
 * registration via an invite link always lands on the main screen, already a
 * member - the invite link itself was the confirmation.
 */
export default function PendingInviteGate() {
  const { show } = useToast();

  useEffect(() => {
    let cancelled = false;
    getPendingInvite().then(async code => {
      if (cancelled || !code) return;
      try {
        const detail = await api.joinGroup(code);
        if (cancelled) return;
        await clearPendingInvite();
        show(`Připojeno do skupiny ${detail.name}.`);
        router.replace('/');
      } catch (e) {
        if (cancelled) return;
        await clearPendingInvite();
        if (!(e instanceof ApiError && e.status === 404)) {
          show('Připojení do skupiny se nezdařilo.', 'error');
        }
        router.replace('/');
      }
    });
    return () => { cancelled = true; };
  }, [show]);

  return null;
}
