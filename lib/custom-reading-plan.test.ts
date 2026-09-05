import { describe, expect, it } from 'vitest';
import { bibleBooks } from '@/app/bible-metadata';
import {
  buildCustomReadingPlan,
  findFirstIncompletePassageIndex,
} from './custom-reading-plan';

describe('나만의 읽기 계획 계산', () => {
  it('한 장 읽기는 선택한 장의 처음부터 끝까지 담는다', () => {
    const plan = buildCustomReadingPlan({
      books: bibleBooks,
      mode: 'chapter',
      range: {
        start: { bookCode: '시', chapter: 23, verse: 1 },
        end: { bookCode: '시', chapter: 23, verse: 6 },
      },
      durationDays: 1,
    });
    expect(plan.totalVerses).toBe(6);
    expect(plan.scope).toBe('시편 23편 1절부터 시편 23편 6절까지');
  });

  it('범위 지정은 서로 다른 성경책 사이도 성경 순서대로 담는다', () => {
    const plan = buildCustomReadingPlan({
      books: bibleBooks,
      mode: 'range',
      range: {
        start: { bookCode: '말', chapter: 4, verse: 6 },
        end: { bookCode: '마', chapter: 1, verse: 2 },
      },
      durationDays: 1,
    });
    expect(plan.totalVerses).toBe(3);
    expect(plan.days[0].passages.map((item) => item.code)).toEqual([
      '말',
      '마',
    ]);
  });
  it('한 권 읽기는 선택한 장 범위만 기간에 맞춰 고르게 나눈다', () => {
    const plan = buildCustomReadingPlan({
      books: bibleBooks,
      mode: 'single',
      singleBookId: '창',
      startChapter: 1,
      endChapter: 3,
      durationDays: 7,
    });
    expect(plan.bookNames).toEqual(['창세기']);
    expect(plan.totalChapters).toBe(3);
    expect(plan.totalVerses).toBe(31 + 25 + 24);
    expect(plan.days).toHaveLength(7);
    expect(
      Math.max(...plan.days.map((day) => day.verseCount)) -
        Math.min(...plan.days.map((day) => day.verseCount)),
    ).toBeLessThanOrEqual(1);
    expect(
      plan.days
        .flatMap((day) => day.passages)
        .every((passage) => passage.name === '창세기'),
    ).toBe(true);
  });

  it('한 권 읽기는 같은 장 안의 시작 절과 마지막 절만 포함한다', () => {
    const plan = buildCustomReadingPlan({
      books: bibleBooks,
      mode: 'single',
      singleBookId: '창',
      startChapter: 1,
      startVerse: 1,
      endChapter: 1,
      endVerse: 4,
      durationDays: 2,
    });
    expect(plan.totalChapters).toBe(1);
    expect(plan.totalVerses).toBe(4);
    expect(plan.scope).toBe('창세기 1장 1절부터 1장 4절');
    expect(plan.days.flatMap((day) => day.passages)).toEqual([
      { code: '창', name: '창세기', chapter: 1, startVerse: 1, endVerse: 2 },
      { code: '창', name: '창세기', chapter: 1, startVerse: 3, endVerse: 4 },
    ]);
  });

  it('한 권의 절 범위가 여러 장을 건너뛰면 첫 장과 마지막 장의 선택 범위만 포함한다', () => {
    const plan = buildCustomReadingPlan({
      books: bibleBooks,
      mode: 'single',
      singleBookId: '창',
      startChapter: 1,
      startVerse: 30,
      endChapter: 2,
      endVerse: 3,
      durationDays: 1,
    });
    expect(plan.totalVerses).toBe(2 + 3);
    expect(plan.days[0].passages).toEqual([
      { code: '창', name: '창세기', chapter: 1, startVerse: 30, endVerse: 31 },
      { code: '창', name: '창세기', chapter: 2, startVerse: 1, endVerse: 3 },
    ]);
  });

  it('시편 한 권 범위에는 장 대신 편 단위를 표시한다', () => {
    const plan = buildCustomReadingPlan({
      books: bibleBooks,
      mode: 'single',
      singleBookId: '시',
      startChapter: 23,
      endChapter: 24,
      durationDays: 2,
    });
    expect(plan.scope).toBe('시편 23편부터 24편');
  });

  it('여러 권 읽기는 고른 책의 모든 장을 성경 순서대로 포함한다', () => {
    const plan = buildCustomReadingPlan({
      books: bibleBooks,
      mode: 'multiple',
      selectedBookIds: ['요', '창'],
      durationDays: 30,
    });
    expect(plan.bookNames).toEqual(['창세기', '요한복음']);
    expect(plan.totalChapters).toBe(50 + 21);
    expect(plan.days[0].passages[0]).toMatchObject({
      code: '창',
      chapter: 1,
      startVerse: 1,
    });
    expect(plan.days.at(-1)?.passages.at(-1)).toMatchObject({
      code: '요',
      chapter: 21,
    });
  });

  it('구약·신약·성경 통독 범위를 정확히 계산한다', () => {
    const oldPlan = buildCustomReadingPlan({
      books: bibleBooks,
      mode: 'old',
      durationDays: 365,
    });
    const newPlan = buildCustomReadingPlan({
      books: bibleBooks,
      mode: 'new',
      durationDays: 180,
    });
    const wholePlan = buildCustomReadingPlan({
      books: bibleBooks,
      mode: 'whole',
      durationDays: 365,
    });
    expect(oldPlan.bookNames).toHaveLength(39);
    expect(newPlan.bookNames).toHaveLength(27);
    expect(wholePlan.bookNames).toHaveLength(66);
    expect(wholePlan.totalChapters).toBe(1189);
    expect(wholePlan.totalVerses).toBe(
      oldPlan.totalVerses + newPlan.totalVerses,
    );
  });

  it('모든 절을 빠짐없이 한 번씩 배정하고 지나치게 긴 기간은 절 수에 맞춘다', () => {
    const plan = buildCustomReadingPlan({
      books: bibleBooks,
      mode: 'single',
      singleBookId: '옵',
      startChapter: 1,
      endChapter: 1,
      durationDays: 365,
    });
    expect(plan.days).toHaveLength(plan.totalVerses);
    expect(plan.days.every((day) => day.verseCount === 1)).toBe(true);
    expect(plan.days.reduce((sum, day) => sum + day.verseCount, 0)).toBe(
      plan.totalVerses,
    );
  });

  it('하루 분량에 여러 장이 있으면 먼저 끝내지 않은 장으로 이동한다', () => {
    const passages = [
      { code: '창', name: '창세기', chapter: 1, startVerse: 1, endVerse: 2 },
      { code: '창', name: '창세기', chapter: 2, startVerse: 1, endVerse: 2 },
    ];
    expect(
      findFirstIncompletePassageIndex(
        passages,
        new Set(['창세기-1-1', '창세기-1-2']),
      ),
    ).toBe(1);
    expect(
      findFirstIncompletePassageIndex(
        passages,
        new Set(['창세기-1-1', '창세기-1-2', '창세기-2-1', '창세기-2-2']),
      ),
    ).toBe(1);
  });
});
