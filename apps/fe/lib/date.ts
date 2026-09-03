// SQLite stores DateTime as TEXT and EF used to materialize it with
// DateTimeKind.Unspecified, so before the backend's UTC value converter
// (AppDbContext, deployed alongside this) System.Text.Json could emit a
// timestamp with no "Z"/offset - `new Date(...)` on that reads as *local*
// time, silently shifting every displayed time by the UTC offset. This is a
// belt-and-suspenders parser for the rollout window where old and new BE
// responses might be mixed; once the BE fix is live everywhere it's a no-op.
export function parseServerDate(iso: string): Date {
  const hasTimezone = /(Z|[+-]\d{2}:?\d{2})$/.test(iso);
  return new Date(hasTimezone ? iso : `${iso}Z`);
}
