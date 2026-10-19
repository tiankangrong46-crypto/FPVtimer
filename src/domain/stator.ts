export type StatorReading = { kind: 'value'; value: string } | { kind: 'missing' | 'unknown' | 'invalid' };
// A size code is a string, never a continuous variable or a motor identity.
export function parseStator(raw: string): StatorReading {
  const s = raw.trim();
  if (!s) return { kind: 'missing' };
  if (['未知', '不清楚', 'unknown'].includes(s.toLowerCase())) return { kind: 'unknown' };
  const match = /^(\d{2})(\d{2}(?:\.\d)?)$/.exec(s);
  if (!match || Number(match[1]) <= 0 || Number(match[2]) <= 0 || s.length > 20) return { kind: 'invalid' };
  const height = Number(match[2]);
  return { kind: 'value', value: `${match[1]}${height < 10 ? '0' : ''}${height}` };
}
