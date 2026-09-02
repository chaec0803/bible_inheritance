import { describe, expect, it } from 'vitest';
import { repairDailyReadingState } from './reading-state-repair';

const project = {
  id: 'theme-믿음-7',
  duration: 7,
  kind: 'guided' as const,
  tasks: ['창세기 15장 1–2절', '출애굽기 14장 13–14절'],
  readingDay: 1,
  readingDayDate: '2026-09-03',
};
const chapterCounts = { 창세기: [31, ...Array(14).fill(0), 21], 출애굽기: [22, ...Array(12).fill(0), 31] };
const atKst = (iso: string) => new Date(iso).getTime();

describe('server-side daily reading repair', () => {
  it('repairs the exact 11:58 PM completion that was incorrectly stamped after midnight', () => {
    const recordings = [1, 2].map((verse, index) => ({
      projectId: project.id,
      book: '창세기',
      chapter: 15,
      verse,
      createdAt: atKst(`2026-09-02T14:58:2${index}Z`),
    }));
    const result = repairDailyReadingState({ activeProjects: [project] }, recordings, chapterCounts, '2026-09-03');
    expect(result.changed).toBe(true);
    expect(result.state.activeProjects?.[0]).toMatchObject({ readingDay: 2, readingDayDate: '2026-09-03' });
  });

  it('does not advance a reading completed today', () => {
    const recordings = [1, 2].map((verse) => ({
      projectId: project.id,
      book: '창세기',
      chapter: 15,
      verse,
      createdAt: atKst('2026-09-02T15:10:00Z'),
    }));
    const result = repairDailyReadingState({ activeProjects: [project] }, recordings, chapterCounts, '2026-09-03');
    expect(result.changed).toBe(false);
    expect(result.state.activeProjects?.[0]).toMatchObject({ readingDay: 1 });
  });

  it('moves a missed reading to today without skipping it', () => {
    const missed = { ...project, readingDayDate: '2026-09-02' };
    const result = repairDailyReadingState({ activeProjects: [missed] }, [], chapterCounts, '2026-09-03');
    expect(result.state.activeProjects?.[0]).toMatchObject({ readingDay: 1, readingDayDate: '2026-09-03' });
  });

  it('does not use recordings from another journey', () => {
    const recordings = [1, 2].map((verse) => ({
      projectId: 'different-project',
      book: '창세기',
      chapter: 15,
      verse,
      createdAt: atKst('2026-09-02T14:58:00Z'),
    }));
    const result = repairDailyReadingState({ activeProjects: [project] }, recordings, chapterCounts, '2026-09-03');
    expect(result.changed).toBe(false);
  });
});
