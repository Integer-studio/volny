export function validatePhone(v: string): string | null {
  if (v.length === 0) return null; // empty clears the field, allowed
  if (!/^[0-9+ ]+$/.test(v) || v.length > 32) return 'Jen číslice, mezery a +, max. 32 znaků.';
  return null;
}

export function validateInstagram(v: string): string | null {
  if (v.length === 0) return null;
  if (!/^[a-zA-Z0-9._]+$/.test(v) || v.length > 64) return 'Jen písmena, čísla, tečka a podtržítko, bez @.';
  return null;
}
