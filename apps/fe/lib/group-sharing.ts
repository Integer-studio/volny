/**
 * Popisek pod přepínačem "Sdílet volno a kontakt se skupinou" (task 0021) -
 * sdílený detailem skupiny a sheetem s pozvánkou, aby oba mluvily stejně.
 * Krátce, ve stylu průvodce (app/onboarding.tsx).
 */
export function groupSharingHint(on: boolean): string {
  return on
    ? 'Členové skupiny uvidí, kdy máš volno, a tvůj telefon a Instagram.'
    : 'Členové skupiny neuvidí, kdy máš volno, ani tvůj kontakt.';
}
