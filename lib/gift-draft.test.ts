import { describe, expect, it } from 'vitest';
import { bibleBooks } from '@/app/bible-metadata';
import {
  MAX_GIFT_DRAFT_VERSES,
  buildGiftDraftPlan,
  getGiftDraftProgress,
  isGiftDraftSendable,
  normalizeGiftDraftScope,
  normalizeGiftDraftSettings,
} from './gift-draft';

const books = bibleBooks.map((book) => ({ code: book.code, name: book.name, chapters: book.chapters }));

function plan(scope: unknown, extra?: Parameters<typeof buildGiftDraftPlan>[0]['journey']) {
  const normalized = normalizeGiftDraftScope(scope);
  expect(normalized).not.toBeNull();
  return buildGiftDraftPlan({ scope: normalized!, books, journey: extra });
}

describe('선물할 말씀 범위 선택', () => {
  it('특정 구절만 골라 선물 목록을 만든다', () => {
    const result = plan({ kind: 'verses', bookCode: '시', chapter: 23, startVerse: 2, endVerse: 4 });
    expect(result).toMatchObject({ ok: true, title: '시편 23편 2–4절' });
    if (!result.ok) return;
    expect(result.items.map((item) => `${item.book}-${item.chapter}-${item.verse}`)).toEqual(['시편-23-2', '시편-23-3', '시편-23-4']);
    expect(result.items.every((item) => item.sourceRecordingId === null)).toBe(true);
  });

  it('한 장 전체를 절 순서대로 담는다', () => {
    const result = plan({ kind: 'chapter', bookCode: '옵', chapter: 1 });
    expect(result).toMatchObject({ ok: true, title: '오바댜 1장' });
    if (!result.ok) return;
    expect(result.items).toHaveLength(21);
    expect(result.items[0].verse).toBe(1);
    expect(result.items.at(-1)?.verse).toBe(21);
  });

  it('여러 장은 장·절 순서대로 이어 담는다', () => {
    const result = plan({ kind: 'chapters', bookCode: '창', startChapter: 1, endChapter: 2 });
    expect(result).toMatchObject({ ok: true, title: '창세기 1–2장' });
    if (!result.ok) return;
    expect(result.items).toHaveLength(31 + 25);
    expect(result.items[30]).toMatchObject({ chapter: 1, verse: 31 });
    expect(result.items[31]).toMatchObject({ chapter: 2, verse: 1 });
  });

  it('여러 성경책은 고른 순서가 아니라 성경 순서대로 담는다', () => {
    const result = plan({ kind: 'books', bookCodes: ['몬', '옵'] });
    expect(result).toMatchObject({ ok: true, title: '오바댜 · 빌레몬서 전체' });
    if (!result.ok) return;
    expect(result.items[0].book).toBe('오바댜');
    expect(result.items.at(-1)?.book).toBe('빌레몬서');
    expect(result.items).toHaveLength(21 + 25);
  });

  it('진행 중인 말씀 여정을 고르면 이미 녹음한 음원을 그대로 참조한다', () => {
    const result = plan({ kind: 'journey', projectId: 'daily-1' }, {
      projectId: 'daily-1',
      title: '시편 묵상',
      recordings: [
        { id: 'r-2', book: '시편', chapter: 23, verse: 2, verseText: '둘째 절', durationSeconds: 4, mimeType: 'audio/wav', sizeBytes: 20 },
        { id: 'r-1', book: '시편', chapter: 23, verse: 1, verseText: '첫 절', durationSeconds: 3, mimeType: 'audio/wav', sizeBytes: 10 },
      ],
    });
    expect(result).toMatchObject({ ok: true, title: '시편 묵상 녹음' });
    if (!result.ok) return;
    expect(result.items.map((item) => item.sourceRecordingId)).toEqual(['r-1', 'r-2']);
    expect(result.items[0].verseText).toBe('첫 절');
  });

  it('녹음이 없는 말씀 여정은 선물 초안을 만들지 않는다', () => {
    const result = plan({ kind: 'journey', projectId: 'daily-1' }, { projectId: 'daily-1', title: '시편 묵상', recordings: [] });
    expect(result.ok).toBe(false);
  });

  it('한 선물에 담을 수 있는 절 수를 넘으면 범위를 줄이도록 안내한다', () => {
    const result = plan({ kind: 'books', bookCodes: ['시'] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain(`${MAX_GIFT_DRAFT_VERSES}`);
  });

  it('잘못된 범위 입력은 받지 않는다', () => {
    expect(normalizeGiftDraftScope(null)).toBeNull();
    expect(normalizeGiftDraftScope({ kind: 'chapter', bookCode: '없는책', chapter: 1 })).not.toBeNull();
    expect(normalizeGiftDraftScope({ kind: 'verses', bookCode: '시', chapter: 23, startVerse: 5, endVerse: 2 })).toBeNull();
    expect(normalizeGiftDraftScope({ kind: 'chapters', bookCode: '창', startChapter: 4, endChapter: 2 })).toBeNull();
    expect(normalizeGiftDraftScope({ kind: 'books', bookCodes: [] })).toBeNull();
    expect(normalizeGiftDraftScope({ kind: 'journey', projectId: '  ' })).toBeNull();
    expect(normalizeGiftDraftScope({ kind: 'everything' })).toBeNull();
    expect(buildGiftDraftPlan({ scope: { kind: 'chapter', bookCode: '없는책', chapter: 1 }, books }).ok).toBe(false);
  });
});

describe('선물 초안 진행 상태', () => {
  const items = [
    { position: 0, book: '시편', chapter: 23, verse: 1, objectKey: 'own/0', sourceRecordingId: null },
    { position: 1, book: '시편', chapter: 23, verse: 2, objectKey: null, sourceRecordingId: 'r-2' },
    { position: 2, book: '시편', chapter: 23, verse: 3, objectKey: null, sourceRecordingId: null },
  ];

  it('다음에 녹음할 절을 선택한 순서대로 알려준다', () => {
    expect(getGiftDraftProgress(items)).toEqual({ total: 3, recorded: 2, nextPosition: 2 });
    expect(getGiftDraftProgress([items[0], items[1]])).toEqual({ total: 2, recorded: 2, nextPosition: null });
  });

  it('모든 절을 녹음하기 전에는 선물을 보낼 수 없다', () => {
    expect(isGiftDraftSendable(items)).toBe(false);
    expect(isGiftDraftSendable([items[0], items[1]])).toBe(true);
    expect(isGiftDraftSendable([])).toBe(false);
  });
});

describe('선물 초안 BGM 설정', () => {
  it('알 수 없는 BGM과 범위를 벗어난 음량을 안전한 값으로 바꾼다', () => {
    expect(normalizeGiftDraftSettings({ bgmId: 'still-waters', bgmVolume: 34 })).toEqual({ bgmId: 'still-waters', bgmVolume: 34 });
    expect(normalizeGiftDraftSettings({ bgmId: 'unknown', bgmVolume: 250 })).toEqual({ bgmId: 'none', bgmVolume: 100 });
    expect(normalizeGiftDraftSettings({})).toEqual({ bgmId: 'none', bgmVolume: 12 });
    expect(normalizeGiftDraftSettings({ bgmVolume: -5 })).toEqual({ bgmId: 'none', bgmVolume: 0 });
  });
});
