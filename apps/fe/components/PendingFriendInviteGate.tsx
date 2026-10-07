import React, { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'expo-router';
import { api, ApiError, FriendInvitePreview } from '../lib/api';
import { getPendingFriendInvite, clearPendingFriendInvite } from '../lib/pending-friend-invite';
import { isOnboardingStep } from '../lib/tour';
import { useTour } from './tour/TourProvider';
import { useToast } from './Toast';
import FriendInviteSheet from './FriendInviteSheet';

type Invite = { code: string; preview: FriendInvitePreview };

/**
 * Mounted alongside PendingInviteGate in the authenticated tree. Picks up a
 * friend invite code stashed by app/add-friend/[code].tsx before a
 * logged-out visitor was routed to sign-in/register - survives the
 * register->login round trip, a page reload on web, or an app relaunch, all
 * of which happen between "opened the link" and "is authenticated".
 *
 * Nepřidává automaticky: ukáže FriendInviteSheet s přijmout/odmítnout
 * (task 0030), jako PendingInviteGate u skupin. Neplatný odkaz (404) už
 * nezahodí potichu, ale řekne to.
 */
export default function PendingFriendInviteGate() {
  const { show } = useToast();
  const tour = useTour();
  const blockedByTour = !tour.ready || isOnboardingStep(tour.step);
  // Na obrazovce pozvánky (app/add-friend/[code].tsx) má uživatel vlastní
  // tlačítko - sheet by ji jen zdvojil. Po odchodu z ní se kód zkusí znovu.
  const onInviteScreen = usePathname().startsWith('/add-friend');
  const [invite, setInvite] = useState<Invite | null>(null);

  useEffect(() => {
    if (blockedByTour || onInviteScreen) return;
    let cancelled = false;
    getPendingFriendInvite().then(async code => {
      if (cancelled || !code) return;
      try {
        const preview = await api.previewFriendInvite(code);
        if (cancelled) return;
        if (preview.alreadyFriend) {
          await clearPendingFriendInvite();
          show(`S ${preview.name} už jste přátelé.`);
          return;
        }
        setInvite({ code, preview });
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) {
          await clearPendingFriendInvite();
          show('Pozvánka do přátel už neplatí.', 'error');
        } else {
          // Síťová chyba nebo studený backend - kód nechat, zkusí se při
          // dalším spuštění.
          show('Pozvánku do přátel se nepodařilo načíst.', 'error');
        }
      }
    });
    return () => { cancelled = true; };
  }, [blockedByTour, onInviteScreen, show]);

  const close = useCallback(async () => {
    setInvite(null);
    await clearPendingFriendInvite();
  }, []);

  return (
    <FriendInviteSheet
      code={invite?.code ?? null}
      preview={invite?.preview ?? null}
      onDecline={close}
      onAccepted={close}
    />
  );
}
