export function toAudibleBgmGain(percent: number) {
  return Math.max(0, Math.min(100, percent)) / 100;
}
