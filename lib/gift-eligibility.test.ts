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
  it('매일 말씀 읽기는 여정 전체가 끝났을 때만 전체를 선물한다', () => {
    const projects: GiftPolicyProject[] = [{ id: 'daily-1', kind: 'guided', tasks: ['시편 23편 1–2절'] }];
    const recordings: GiftPolicyRecording[] = [
      { id: 'r1', projectId: 'daily-1', book: '시편', chapter: 23, verse: 1 },
      { id: 'r2', projectId: 'daily-1', book: '시편', chapter: 23, verse: 2 },
    ];

    expect(evaluateGiftSelection({ recordings, projects, selectedRecordingIds: ['r1'], chapterCounts }).eligible).toBe(false);
    expect(evaluateGiftSelection({ recordings, projects, selectedRecordingIds: ['r2', 'r1'], chapterCounts })).toMatchObject({
      eligible: true,
      kind: 'journey',
      orderedRecordingIds: ['r1', 'r2'],
    });
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

  it('완료된 여정과 자유 읽기 장의 녹음은 수정할 수 없게 잠근다', () => {
    const guided: GiftPolicyRecording[] = [
      { id: 'r1', projectId: 'daily-1', book: '시편', chapter: 23, verse: 1 },
      { id: 'r2', projectId: 'daily-1', book: '시편', chapter: 23, verse: 2 },
    ];
    const projects: GiftPolicyProject[] = [{ id: 'daily-1', kind: 'guided', tasks: ['시편 23편 1–2절'] }];
    expect(isRecordingScopeLocked(guided[0], guided, projects, chapterCounts)).toBe(true);

    const free = chapterRecordings('오바댜', 1, 21, 'free-옵');
    expect(isRecordingScopeLocked(free[0], free, [], chapterCounts)).toBe(true);
    expect(isRecordingScopeLocked(free[0], free.slice(0, 20), [], chapterCounts)).toBe(false);
  });
});
