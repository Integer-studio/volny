import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Kroky průvodce po registraci (task 0019), v pořadí, v jakém jdou za sebou.
 *
 * Část A (`intro`, `contact`, `install`, `notify`) běží na celoobrazovkové
 * route `app/onboarding.tsx`. Část B jsou nápovědy přímo nad skutečným UI
 * (`components/tour/TourOverlay.tsx`). `notify` je jen pro aplikaci na ploše
 * iOS, do které se uživatel dostal přes handoff z Safari (viz lib/handoff.ts)
 * - v řadě se normálně přeskakuje.
 */
export const TOUR_STEPS = [
  'intro',
  'contact',
  'install',
  'notify',
  'ring',
  'button',
  'friendsIcon',
  'friendsQr',
  'groupsIcon',
  'groupsCreate',
  'dummy',
  'dummyContact',
  'done',
] as const;

export type TourStep = (typeof TOUR_STEPS)[number];

const PART_A: readonly TourStep[] = ['intro', 'contact', 'install', 'notify'];

export function isOnboardingStep(step: TourStep | null): boolean {
  return step != null && PART_A.includes(step);
}

/** Další krok v řadě. `notify` se běžně přeskakuje - viz komentář nahoře. */
export function nextStep(step: TourStep): TourStep {
  if (step === 'install') return 'ring';
  const i = TOUR_STEPS.indexOf(step);
  return TOUR_STEPS[Math.min(i + 1, TOUR_STEPS.length - 1)];
}

/**
 * Kapitoly pro tečky průběhu v kartě nápovědy. Tečky tak znamenají "kde v
 * aplikaci jsem", ne osm drobných kroků, které by uživatele jen strašily.
 */
export const TOUR_CHAPTERS: readonly (readonly TourStep[])[] = [
  ['ring', 'button'],
  ['friendsIcon', 'friendsQr'],
  ['groupsIcon', 'groupsCreate'],
  ['dummy', 'dummyContact'],
];

export function chapterOf(step: TourStep): number {
  return TOUR_CHAPTERS.findIndex(c => c.includes(step));
}

// Schválně mimo prefix `fc:v1:` z lib/cache.ts: tamní záznamy po 14 dnech
// vyprší a odhlášení je maže celé - rozpracovaný průvodce by tím buď zmizel,
// nebo by se po vypršení zobrazil znovu.
const key = (userId: string) => `volny:tour:${userId}`;

// Zrcadlo v paměti, aby `app/index.tsx` věděl o právě začatém průvodci už
// při prvním renderu po registraci (jinak by na okamžik problikl).
const mem = new Map<string, TourStep | null>();

function isTourStep(v: unknown): v is TourStep {
  return typeof v === 'string' && (TOUR_STEPS as readonly string[]).includes(v);
}

export function readTourStepSync(userId: string): TourStep | null | undefined {
  return mem.has(userId) ? mem.get(userId) : undefined;
}

/** `null` = průvodce se tomuhle uživateli na tomhle zařízení nikdy nespustil. */
export async function readTourStep(userId: string): Promise<TourStep | null> {
  const cached = mem.get(userId);
  if (cached !== undefined) return cached;
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    const step = isTourStep(raw) ? raw : null;
    mem.set(userId, step);
    return step;
  } catch {
    return null;
  }
}

export async function writeTourStep(userId: string, step: TourStep): Promise<void> {
  mem.set(userId, step);
  try {
    await AsyncStorage.setItem(key(userId), step);
  } catch {
    // best-effort - v paměti stav zůstává, jen se nepřenese přes reload
  }
}
