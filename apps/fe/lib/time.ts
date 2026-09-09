export const formatTime = (date: Date): string =>
  date.toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

/**
 * Nejbližší PŘÍŠTÍ celá hodina - v 15:47 vrátí 16:00, ale i přesně v 16:00:00
 * vrátí 17:00, protože "volný do teď" by nedávalo smysl.
 */
export function nextHour(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

/** `nextHour(from)` posunuté o `n` dalších celých hodin (n=0 = nejbližší celá hodina). */
export function hourOffset(n: number, from: Date = new Date()): Date {
  const d = nextHour(from);
  d.setHours(d.getHours() + n);
  return d;
}

export function isTomorrow(date: Date, from: Date = new Date()): boolean {
  return (
    date.getFullYear() !== from.getFullYear() ||
    date.getMonth() !== from.getMonth() ||
    date.getDate() !== from.getDate()
  );
}

/** Minuty od `from` do `date`, zaokrouhleno nahoru (0 už uplynulo). */
export function minutesUntil(date: Date, from: Date = new Date()): number {
  return Math.max(0, Math.ceil((date.getTime() - from.getTime()) / 60_000));
}

/**
 * Délka v minutách jako lidský popisek: "45 min", "2 h", "3 h 15 min".
 * Celé hodiny se píšou bez "0 min", aby se popisek pod tlačítkem zbytečně
 * neroztahoval na nejčastějších hodnotách.
 *
 * Zaokrouhluje se - pod hodinu na pětiminuty, od hodiny na čtvrthodiny. Čas
 * se zadává na nástěnné čtvrthodiny, takže na minutu přesná *délka* je jen
 * důsledek toho, kolik je právě hodin: "ještě 3 h 53 min" je přesné, ale
 * nikomu to nic neřekne. Nenulová délka nikdy nespadne na "0 min".
 */
export function formatDuration(minutes: number): string {
  const raw = Math.max(0, minutes);
  const step = raw < 60 ? 5 : 15;
  const m = raw > 0 ? Math.max(step, Math.round(raw / step) * step) : 0;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  if (rest === 0) return `${h} h`;
  return `${h} h ${rest} min`;
}
