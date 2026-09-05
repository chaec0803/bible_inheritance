export const GIFT_LETTER_TEXT_MAX_LENGTH = 500;
export const GIFT_LETTER_AUDIO_MAX_BYTES = 5 * 1024 * 1024;
export const GIFT_LETTER_AUDIO_MAX_SECONDS = 90;

export type GiftLetterInput =
  | { type: 'none' }
  | { type: 'text'; text: string }
  | { type: 'voice'; dataUrl: string; mimeType: string; sizeBytes: number; durationSeconds: number };

export function normalizeGiftLetter(input: unknown): GiftLetterInput | null {
  if (input == null) return { type: 'none' };
  if (!input || typeof input !== 'object') return null;
  const body = input as Record<string, unknown>;
  if (body.type === 'none') return { type: 'none' };
  if (body.type === 'text') {
    if (body.dataUrl != null || body.mimeType != null || body.sizeBytes != null || body.durationSeconds != null) return null;
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    return text && text.length <= GIFT_LETTER_TEXT_MAX_LENGTH ? { type: 'text', text } : null;
  }
  if (body.type === 'voice') {
    if (typeof body.text === 'string' && body.text.trim()) return null;
    const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : '';
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType.toLowerCase() : '';
    const sizeBytes = typeof body.sizeBytes === 'number' ? Math.round(body.sizeBytes) : 0;
    const durationSeconds = typeof body.durationSeconds === 'number' ? Math.round(body.durationSeconds) : 0;
    const allowedMime = /^(audio\/(webm|mp4|mpeg|wav|ogg)|video\/mp4)(;|$)/.test(mimeType);
    const matchesDataUrl = dataUrl.startsWith(`data:${mimeType};base64,`);
    if (!allowedMime || !matchesDataUrl || sizeBytes < 1 || sizeBytes > GIFT_LETTER_AUDIO_MAX_BYTES || durationSeconds < 1 || durationSeconds > GIFT_LETTER_AUDIO_MAX_SECONDS) return null;
    return { type: 'voice', dataUrl, mimeType, sizeBytes, durationSeconds };
  }
  return null;
}

export function decodeGiftLetterAudio(letter: Extract<GiftLetterInput, { type: 'voice' }>) {
  try {
    const encoded = letter.dataUrl.slice(letter.dataUrl.indexOf(',') + 1);
    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    return bytes.byteLength === letter.sizeBytes ? bytes : null;
  } catch {
    return null;
  }
}
