import { describe, expect, it } from 'vitest';
import { orderJourneyRecordings } from './journey-playback';

const chapterCounts = {
  창세기: [31, 25],
  출애굽기: [22, 25],
};

describe('매일 말씀 여정 전체 이어듣기 순서', () => {
  it('서버 응답 순서와 관계없이 여정의 날짜와 말씀 순서로 정렬한다', () => {
    const recordings = [
      { id: 'day-2-verse-2', book: '출애굽기', chapter: 1, verse: 2 },
      { id: 'day-1-verse-2', book: '창세기', chapter: 1, verse: 2 },
      { id: 'day-2-verse-1', book: '출애굽기', chapter: 1, verse: 1 },
      { id: 'day-1-verse-1', book: '창세기', chapter: 1, verse: 1 },
    ];

    expect(orderJourneyRecordings(recordings, ['창세기 1장 1–2절', '출애굽기 1장 1–2절'], chapterCounts).map((item) => item.id)).toEqual([
      'day-1-verse-1',
      'day-1-verse-2',
      'day-2-verse-1',
      'day-2-verse-2',
    ]);
  });

  it('같은 절에 여러 파일이 있으면 최신순 응답의 첫 파일만 재생한다', () => {
    const recordings = [
      { id: 'newest', book: '창세기', chapter: 1, verse: 1 },
      { id: 'old', book: '창세기', chapter: 1, verse: 1 },
    ];

    expect(orderJourneyRecordings(recordings, ['창세기 1장 1절'], chapterCounts).map((item) => item.id)).toEqual(['newest']);
  });
});
