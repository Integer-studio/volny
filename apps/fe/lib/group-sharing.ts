/**
 * Popisek pod přepínačem "Sdílet volno a kontakt se skupinou" (task 0021) -
 * sdílený detailem skupiny a sheetem s pozvánkou, aby oba mluvily stejně.
 */
export function groupSharingHint(on: boolean): string {
  return on
    ? 'Členové skupiny vidí, kdy máš volno, dostávají o tom upozornění a vidí tvůj telefon a Instagram, i když nejste přátelé. Funguje to vzájemně - ty vidíš totéž u členů, kteří sdílení mají zapnuté taky.'
    : 'Členové skupiny nevidí tvoje volno ani kontakt a ty nevidíš jejich (pokud nejste přátelé). Ve skupině ale zůstáváš.';
}
