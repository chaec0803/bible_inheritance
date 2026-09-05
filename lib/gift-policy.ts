import { normalizeGiftLetter } from './gift-letter';

export const GIFT_BGM_CATALOG = {
  'still-waters': { name: 'Aeternum', audioSrc: '/api/bgm/aeternum?v=3', objectKey: 'bgm/aeternum.mp3' },
  'peaceful-morning': { name: 'Unto Thee', audioSrc: '/api/bgm/unto-thee?v=3', objectKey: 'bgm/unto-thee.mp3' },
  'word-breath': { name: "The King's Return", audioSrc: '/api/bgm/the-kings-return?v=3', objectKey: 'bgm/the-kings-return.mp3' },
  none: { name: '음악 없음', audioSrc: null, objectKey: null },
} as const;

export type GiftBgmId = keyof typeof GIFT_BGM_CATALOG;

export type GiftRequest = {
  recipientUserIds: string[];
  recordingIds: string[];
  title: string;
  bgmId: GiftBgmId;
  bgmVolume: number;
  letter: import('./gift-letter').GiftLetterInput;
};

export function normalizeGiftRequest(input: unknown): GiftRequest | null {
  if (!input || typeof input !== 'object') return null;
  const body = input as Record<string, unknown>;
  const rawRecipients = Array.isArray(body.recipientUserIds)
    ? body.recipientUserIds
    : typeof body.recipientUserId === 'string' ? [body.recipientUserId] : [];
  if (rawRecipients.some((value) => typeof value !== 'string' || !value.trim())) return null;
  const recipientUserIds = [...new Set((rawRecipients as string[]).map((value) => value.trim()))];
  const title = typeof body.title === 'string' ? body.title.trim().replace(/\s+/g, ' ').slice(0, 100) : '';
  const bgmId = typeof body.bgmId === 'string' && body.bgmId in GIFT_BGM_CATALOG ? body.bgmId as GiftBgmId : null;
  const rawIds = Array.isArray(body.recordingIds) ? body.recordingIds : [];
  if (rawIds.some((value) => typeof value !== 'string' || !value.trim())) return null;
  const recordingIds = [...new Set((rawIds as string[]).map((value) => value.trim()))];
  const rawVolume = typeof body.bgmVolume === 'number' && Number.isFinite(body.bgmVolume) ? body.bgmVolume : 12;
  const bgmVolume = Math.max(0, Math.min(100, Math.round(rawVolume)));
  const letter = normalizeGiftLetter(body.letter);

  if (!recipientUserIds.length || recipientUserIds.length > 30 || !title || !bgmId || !letter || recordingIds.length === 0 || recordingIds.length > 40_000) return null;
  return { recipientUserIds, recordingIds, title, bgmId, bgmVolume, letter };
}
