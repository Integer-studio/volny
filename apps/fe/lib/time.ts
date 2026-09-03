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
