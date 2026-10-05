import type { FreeEntry, UserProfile } from '../../lib/api';

/**
 * Ukázkový volný přítel pro poslední krok průvodce (task 0019). Existuje jen
 * na frontendu - nikdy se neposílá na API, takže ho nikdo jiný neuvidí.
 * Kontakty jsou smyšlené; ProfileSheet místo vytáčení ukáže toast.
 */
export const TOUR_DUMMY_ID = 'tour-dummy';

const user = { id: TOUR_DUMMY_ID, username: 'pepa', name: 'Pepa Volný' };

/** Čerstvé časy při každém zobrazení - konstanta z načtení modulu by po čase ukazovala "Do" v minulosti. */
export function makeTourDummyEntry(now: Date = new Date()): FreeEntry {
  return {
    user,
    freeSince: now,
    freeUntil: new Date(now.getTime() + 2 * 60 * 60_000),
    via: [{ kind: 'friend' }],
  };
}

export const TOUR_DUMMY_PROFILE: UserProfile = {
  ...user,
  isFriend: true,
  hasOutgoingRequest: false,
  hasIncomingRequest: false,
  sharedGroups: [],
  phone: '+420 777 123 456',
  instagram: 'volny.pepa',
};
