export function parseByteRange(value: string | null, size: number) {
  if (!value?.startsWith('bytes=') || size <= 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return null;
  const suffixRange = !match[1];
  const start = suffixRange ? Math.max(0, size - Number(match[2])) : Number(match[1]);
  const end = suffixRange || !match[2] ? size - 1 : Number(match[2]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= size || end < start) return null;
  return { start, end: Math.min(end, size - 1) };
}
