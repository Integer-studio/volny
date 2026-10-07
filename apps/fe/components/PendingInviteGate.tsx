import React, { useCallback, useEffect, useState } from 'react';
import { api, ApiError, GroupPreview } from '../lib/api';
import { getPendingInvite, clearPendingInvite, onPendingInviteSet } from '../lib/pending-invite';
import { isOnboardingStep } from '../lib/tour';
import { useTour } from './tour/TourProvider';
import { useToast } from './Toast';
import GroupInviteSheet from './GroupInviteSheet';

type Invite = { code: string; preview: GroupPreview };

/**
 * Mounted alongside PushGate in the authenticated tree. Picks up a group
 * invite code stashed by app/join/[code].tsx - either just now by a
 * signed-in user opening the link (that screen stashes and goes home), or
 * before a logged-out visitor was routed to sign-in/register (survives the
 * register->login round trip, a page reload on web, or an app relaunch).
 *
 * Instead of joining automatically, it shows a bottom sheet over the main
 * screen with accept/decline and the group sharing toggle (task 0021,
 * GroupInviteSheet), so
 * the user decides about sharing their free status and contact before
 * they're in. Closing the sheet any other way counts as declining.
 *
 * Waits out part A of the post-registration tour (task 0019): someone who
 * registered via an invite sees the sheet after the intro/contact screens,
 * when their phone/IG is already filled in, and the tour hints continue once
 * the sheet is gone.
 */
export default function PendingInviteGate() {
  const { show } = useToast();
  const tour = useTour();
  const blockedByTour = !tour.ready || isOnboardingStep(tour.step);

  const [checkTick, setCheckTick] = useState(0);
  const [invite, setInvite] = useState<Invite | null>(null);

  useEffect(() => onPendingInviteSet(() => setCheckTick(t => t + 1)), []);

  useEffect(() => {
    if (blockedByTour) return;
    let cancelled = false;
    getPendingInvite().then(async code => {
      if (cancelled || !code) return;
      try {
        const preview = await api.previewInvite(code);
        if (cancelled) return;
        if (preview.alreadyMember) {
          await clearPendingInvite();
          show(`Ve skupině ${preview.name} už jsi.`);
          return;
        }
        setInvite({ code, preview });
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) {
          // A dead code (group deleted, invite regenerated) can never
          // succeed, and a stored one would otherwise reopen this on every
          // app load.
          await clearPendingInvite();
          show('Pozvánka do skupiny už neplatí.', 'error');
        } else {
          // Síťová chyba nebo studený backend - kód nechat, zkusí se při
          // dalším spuštění.
          show('Pozvánku do skupiny se nepodařilo načíst.', 'error');
        }
      }
    });
    return () => { cancelled = true; };
  }, [blockedByTour, checkTick, show]);

  const close = useCallback(async () => {
    setInvite(null);
    await clearPendingInvite();
  }, []);

  return (
    <GroupInviteSheet
      code={invite?.code ?? null}
      preview={invite?.preview ?? null}
      onDecline={close}
      onJoined={close}
    />
  );
}
