import type { TourStep } from '../../lib/tour';
import type { TourTargetId } from './TourProvider';

export type TourScreen = 'index' | 'search' | 'groups';

export type CoachStep = {
  screen: TourScreen;
  target: TourTargetId;
  /** Kruhový výřez sedí na prstenec a tlačítko (aplikace je doslova kolečko), jinde zaoblený obdélník. */
  shape: 'circle' | 'rect';
  title: string;
  body?: string;
  /** Tlačítko v kartě. Bez něj krok posouvá samotná akce uživatele (tažení, klepnutí). */
  action?: string;
  /** Po tlačítku v kartě zavřít modální obrazovku a vrátit se na hlavní - další krok je tam. */
  backAfter?: boolean;
  /** Odstup karty od výřezu, když pod cílem leží něco, co má zůstat vidět (popisek "Volný do" pod prstencem). */
  cardGap?: number;
};

/**
 * Kroky části B - nápovědy nad skutečným UI. Krok `dummyContact` tu není:
 * kreslí ho přímo ProfileSheet, protože RN Modal leží nad každým overlayem.
 */
export const COACH_STEPS: Partial<Record<TourStep, CoachStep>> = {
  ring: {
    screen: 'index',
    target: 'ring',
    shape: 'circle',
    title: 'Vítej ve Volném!',
    body: 'Kolečkem si navol, do kdy máš volno.',
    cardGap: 64,
  },
  button: {
    screen: 'index',
    target: 'button',
    shape: 'circle',
    title: 'Tlačítkem svou volbu potvrdíš.',
  },
  friendsIcon: {
    screen: 'index',
    target: 'friendsIcon',
    shape: 'circle',
    title: 'Přátele si přidáš tady.',
  },
  friendsQr: {
    screen: 'search',
    target: 'friendsQr',
    shape: 'rect',
    title: 'Můžeš k tomu použít i QR kód!',
    body: 'Ukaž ho kamarádovi, naskenuje si ho foťákem a jste přátelé.',
    action: 'Rozumím',
    backAfter: true,
  },
  groupsIcon: {
    screen: 'index',
    target: 'groupsIcon',
    shape: 'circle',
    title: 'Tady najdeš skupiny.',
  },
  groupsCreate: {
    screen: 'groups',
    target: 'groupsCreate',
    shape: 'rect',
    title: 'Skupiny jsou hlavně na akce.',
    body: 'Vytvoř skupinu a nech pozvánkový QR kód někde na místě – lidi se připojí a ty nejlepší si pak přidáš do přátel.',
    action: 'Rozumím',
    backAfter: true,
  },
  dummy: {
    screen: 'index',
    target: 'dummy',
    shape: 'rect',
    title: 'Když vidíš, že má někdo volno, klikni na jeho jméno.',
  },
};
