import { describe, expect, it } from 'vitest';
import { bibleBooks } from '@/app/bible-metadata';
import { changeRangeBook, normalizeBibleRange } from './bible-scope';

describe('공용 성경 범위', () => {
  it('시작 성경책을 바꾸면 1장 1절부터 시작한다', () => {
    const range = changeRangeBook(undefined, 'start', '마', bibleBooks);
    expect(range.start).toEqual({ bookCode: '마', chapter: 1, verse: 1 });
  });

  it('끝 성경책을 바꾸면 마지막 장 마지막 절까지로 맞춘다', () => {
    const range = changeRangeBook(undefined, 'end', '요', bibleBooks);
    const john = bibleBooks.find((book) => book.code === '요')!;
    expect(range.end).toEqual({
      bookCode: '요',
      chapter: john.chapters.length,
      verse: john.chapters.at(-1),
    });
  });

  it('역순 범위와 존재하지 않는 장절은 거절한다', () => {
    expect(
      normalizeBibleRange(
        {
          start: { bookCode: '요', chapter: 1, verse: 1 },
          end: { bookCode: '창', chapter: 1, verse: 1 },
        },
        bibleBooks,
      ),
    ).toBeNull();
    expect(
      normalizeBibleRange(
        {
          start: { bookCode: '창', chapter: 99, verse: 1 },
          end: { bookCode: '창', chapter: 99, verse: 2 },
        },
        bibleBooks,
      ),
    ).toBeNull();
  });
});
