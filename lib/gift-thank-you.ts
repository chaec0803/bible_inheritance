export const THANK_YOU_TEMPLATES = [
  '말씀 선물 고마워요. 잘 간직할게요.',
  '목소리로 말씀을 들으니 큰 힘이 되었어요.',
  '따뜻한 마음 감사해요. 함께 기억할게요.',
] as const;

export function normalizeThankYouNote(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized || normalized.length > 300) return null;
  return normalized;
}
