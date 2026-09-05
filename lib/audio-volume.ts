export function toAudibleBgmGain(percent: number) {
  const normalized = Math.max(0, Math.min(100, percent)) / 100;
  return Math.sqrt(normalized);
}
