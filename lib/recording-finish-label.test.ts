import { describe, expect, it } from 'vitest';
import { getRecordingFinishLabel } from './recording-finish-label';

describe('이어 녹음 종료 버튼 문구', () => {
  it('읽는 범위의 중간 절에서는 여기까지 녹음으로 표시한다', () => {
    expect(getRecordingFinishLabel({ isLastVerse: false, isDailyJourney: true, book: '창세기', chapter: 1 })).toBe('여기까지 녹음');
  });

  it('매일 말씀 읽기의 마지막 절에서는 오늘 말씀 완료로 표시한다', () => {
    expect(getRecordingFinishLabel({ isLastVerse: true, isDailyJourney: true, book: '창세기', chapter: 1 })).toBe('오늘 말씀 완료');
  });

  it('하루에 여러 장을 읽을 때 중간 장의 끝은 해당 장 완료로 표시한다', () => {
    expect(getRecordingFinishLabel({ isLastVerse: true, isDailyJourney: true, isLastDailyPassage: false, book: '창세기', chapter: 1 })).toBe('창세기 1장 완료');
  });

  it('자유 읽기의 마지막 절에서는 해당 장 완료로 표시한다', () => {
    expect(getRecordingFinishLabel({ isLastVerse: true, isDailyJourney: false, book: '창세기', chapter: 1 })).toBe('창세기 1장 완료');
    expect(getRecordingFinishLabel({ isLastVerse: true, isDailyJourney: false, book: '시편', chapter: 23 })).toBe('시편 23편 완료');
  });
});
