/** "1 člen", "3 členové", "5 členů" - české skloňování podle počtu. */
export function memberCountLabel(n: number): string {
  if (n === 1) return '1 člen';
  if (n >= 2 && n <= 4) return `${n} členové`;
  return `${n} členů`;
}
