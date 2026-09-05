import { describe, expect, it } from 'vitest';
import { bibleBooks } from '@/app/bible-metadata';
import {
  evaluateGiftSelection,
  getCompletedFreeChapterKeys,
  isRecordingScopeLocked,
  type GiftPolicyProject,
  type GiftPolicyRecording,
} from './gift-eligibility';

const chapterCounts = Object.fromEntries(bibleBooks.map((book) => [book.name, book.chapters]));

function chapterRecordings(book: string, chapter: number, verseCount: number, projectId = 'free-창') {
  return Array.from({ length: verseCount }, (_, index) => ({
    id: `${book}-${chapter}-${index + 1}`,
    projectId,
    book,
    chapter,
    verse: index + 1,
  }));
}

describe('완료된 말씀 선물 정책', () => {
  it('완료된 말씀 여정은 절이 아니라 완성된 말씀 묶음 전체로 선물한다', () => {
    const projects: GiftPolicyProject[] = [{ id: 'daily-1', kind: 'guided', tasks: ['시편 23편 1–2절'], completedAt: 100 }];
    const recordings: GiftPolicyRecording[] = [
      { id: 'r1', projectId: 'daily-1', book: '시편', chapter: 23, verse: 1 },
      { id: 'r2', projectId: 'daily-1', book: '시편', chapter: 23, verse: 2 },
    ];

    expect(evaluateGiftSelection({ recordings, projects, selectedRecordingIds: ['r1'], chapterCounts })).toMatchObject({ eligible: false });
    expect(evaluateGiftSelection({ recordings, projects, selectedRecordingIds: ['r2', 'r1'], chapterCounts })).toMatchObject({
      eligible: true,
      kind: 'journey',
      orderedRecordingIds: ['r1', 'r2'],
    });
  });

  it('완료된 말씀 묶음을 둘 이상 골라 하나의 선물로 보낸다', () => {
    const recordings: GiftPolicyRecording[] = [
      { id: 'r1', projectId: 'daily-1', book: '시편', chapter: 23, verse: 1 },
      { id: 'r2', projectId: 'daily-2', book: '요한복음', chapter: 3, verse: 16 },
    ];
    const projects: GiftPolicyProject[] = [
      { id: 'daily-1', kind: 'guided', tasks: ['시편 23편 1절'], completedAt: 100 },
      { id: 'daily-2', kind: 'guided', tasks: ['요한복음 3장 16절'], completedAt: 200 },
    ];
    expect(evaluateGiftSelection({ recordings, projects, selectedRecordingIds: ['r1', 'r2'], chapterCounts })).toMatchObject({ eligible: true, orderedRecordingIds: ['r1', 'r2'] });
  });

  it('여정 자체가 완료되지 않았다면 녹음 일부를 선물할 수 없다', () => {
    const projects: GiftPolicyProject[] = [{ id: 'daily-1', kind: 'guided', tasks: ['시편 23편 1–2절'] }];
    const recordings: GiftPolicyRecording[] = [{ id: 'r1', projectId: 'daily-1', book: '시편', chapter: 23, verse: 1 }];
    expect(evaluateGiftSelection({ recordings, projects, selectedRecordingIds: ['r1'], chapterCounts })).toMatchObject({ eligible: false });
  });

  it('성경 읽기는 완성된 장만 기본 단위로 선물한다', () => {
    const complete = chapterRecordings('오바댜', 1, 21, 'free-옵');
    const incomplete = chapterRecordings('창세기', 1, 30);
    expect(getCompletedFreeChapterKeys([...complete, ...incomplete], chapterCounts)).toEqual(new Set(['오바댜-1']));
    expect(evaluateGiftSelection({ recordings: incomplete, projects: [], selectedRecordingIds: incomplete.map((item) => item.id), chapterCounts }).eligible).toBe(false);
  });

  it('같은 책의 완성된 여러 장은 장·절 순서로 묶어 선물한다', () => {
    const first = chapterRecordings('창세기', 1, 31);
    const second = chapterRecordings('창세기', 2, 25);
    const recordings = [...second.slice().reverse(), ...first.slice().reverse()];
    const result = evaluateGiftSelection({
      recordings,
      projects: [],
      selectedRecordingIds: recordings.map((item) => item.id),
      chapterCounts,
    });
    expect(result).toMatchObject({ eligible: true, kind: 'chapters', title: '창세기 1–2장' });
    if (result.eligible) {
      expect(result.orderedRecordingIds[0]).toBe('창세기-1-1');
      expect(result.orderedRecordingIds.at(-1)).toBe('창세기-2-25');
    }
  });

  it('서로 다른 책은 한 선물로 섞지 않는다', () => {
    const recordings = [...chapterRecordings('오바댜', 1, 21, 'free-옵'), ...chapterRecordings('빌레몬서', 1, 25, 'free-몬')];
    expect(evaluateGiftSelection({ recordings, projects: [], selectedRecordingIds: recordings.map((item) => item.id), chapterCounts }).eligible).toBe(false);
  });

  it('녹음을 모두 마쳐도 완료 확정 전에는 수정할 수 있고 확정 후에만 잠근다', () => {
    const guided: GiftPolicyRecording[] = [
      { id: 'r1', projectId: 'daily-1', book: '시편', chapter: 23, verse: 1 },
      { id: 'r2', projectId: 'daily-1', book: '시편', chapter: 23, verse: 2 },
    ];
    const projects: GiftPolicyProject[] = [{ id: 'daily-1', kind: 'guided', tasks: ['시편 23편 1–2절'] }];
    expect(isRecordingScopeLocked(guided[0], guided, projects, chapterCounts)).toBe(false);
    expect(isRecordingScopeLocked(guided[0], guided, [{ ...projects[0], completedAt: 100 }], chapterCounts)).toBe(true);

    const free = chapterRecordings('오바댜', 1, 21, 'free-옵');
    expect(isRecordingScopeLocked(free[0], free, [], chapterCounts)).toBe(false);
    expect(isRecordingScopeLocked(free[0], free, [{ id: 'free-옵', kind: 'free', completedAt: 100 }], chapterCounts)).toBe(true);
    expect(isRecordingScopeLocked(free[0], free.slice(0, 20), [], chapterCounts)).toBe(false);
  });
});
