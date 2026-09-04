import { useEffect } from 'react';
import { router } from 'expo-router';
import { api, ApiError } from '../lib/api';
import { getPendingFriendInvite, clearPendingFriendInvite } from '../lib/pending-friend-invite';
import { useToast } from './Toast';

/**
 * Mounted alongside PendingInviteGate in the authenticated tree. Adds a
 * friend whose invite code was stashed by app/add-friend/[code].tsx before a
 * logged-out visitor was routed to sign-in/register - survives the
 * register->login round trip, a page reload on web, or an app relaunch, all
 * of which happen between "opened the link" and "is authenticated". Adds
 * automatically (rather than bouncing to /add-friend/CODE for a second
 * confirmation) so a fresh login or registration via an invite link always
 * lands on the main screen, already friends - the invite link itself was the
 * confirmation.
 */
export default function PendingFriendInviteGate() {
  const { show } = useToast();

  useEffect(() => {
    let cancelled = false;
    getPendingFriendInvite().then(async code => {
      if (cancelled || !code) return;
      try {
        const friend = await api.acceptFriendInvite(code);
        if (cancelled) return;
        await clearPendingFriendInvite();
        show(`Přidáno do přátel: ${friend.name}.`);
        router.replace('/');
      } catch (e) {
        if (cancelled) return;
        await clearPendingFriendInvite();
        if (!(e instanceof ApiError && e.status === 404)) {
          show('Přidání do přátel se nezdařilo.', 'error');
        }
        router.replace('/');
      }
    });
    return () => { cancelled = true; };
  }, [show]);

  return null;
}
