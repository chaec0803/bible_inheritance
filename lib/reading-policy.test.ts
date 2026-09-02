import { describe, expect, it } from 'vitest';
import { advanceReadingSchedule, normalizeReadingDay } from './reading-policy';

describe('daily reading schedule policy', () => {
  it('starts on day one', () => {
    expect(normalizeReadingDay({ duration: 7 })).toBe(1);
  });

  it('advances by one on a new date when the current reading is complete', () => {
    expect(advanceReadingSchedule(
      { duration: 7, readingDay: 2, readingDayDate: '2026-09-02' },
      new Set([0, 1]),
      '2026-09-03',
    )).toEqual({ readingDay: 3, readingDayDate: '2026-09-03' });
  });

  it('does not advance when the current reading was missed', () => {
    expect(advanceReadingSchedule(
      { duration: 7, readingDay: 3, readingDayDate: '2026-09-03' },
      new Set([0, 1]),
      '2026-09-04',
    )).toEqual({ readingDay: 3, readingDayDate: '2026-09-04' });
  });

  it('never advances twice after several absent days', () => {
    expect(advanceReadingSchedule(
      { duration: 7, readingDay: 2, readingDayDate: '2026-09-01' },
      new Set([0, 1]),
      '2026-09-05',
    )).toEqual({ readingDay: 3, readingDayDate: '2026-09-05' });
  });

  it('does not advance again on the same date', () => {
    expect(advanceReadingSchedule(
      { duration: 7, readingDay: 3, readingDayDate: '2026-09-04' },
      new Set([0, 1, 2]),
      '2026-09-04',
    )).toEqual({ readingDay: 3, readingDayDate: '2026-09-04' });
  });

  it('stops at the final day', () => {
    expect(advanceReadingSchedule(
      { duration: 7, readingDay: 7, readingDayDate: '2026-09-06' },
      new Set([0, 1, 2, 3, 4, 5, 6]),
      '2026-09-07',
    )).toEqual({ readingDay: 7, readingDayDate: '2026-09-07' });
  });
});
