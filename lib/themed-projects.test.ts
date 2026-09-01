import { describe, expect, it } from 'vitest';
import { bibleBooks } from '../app/bible-metadata';
import { themedProjects } from './themed-projects';

describe('믿음·소망·사랑 말씀 여정', () => {
  it('1주와 2주에 각각 세 주제만 제공한다', () => {
    for (const duration of [7, 14]) {
      const projects = themedProjects.filter((project) => project.duration === duration);
      expect(projects.map((project) => project.theme)).toEqual(['믿음', '소망', '사랑']);
      expect(projects.every((project) => project.tasks.length === duration)).toBe(true);
    }
  });

  it('각 여정의 본문은 성경 순서대로 정렬되고 실제 존재하는 절 범위다', () => {
    const bookIndex = new Map(bibleBooks.map((book, index) => [book.name, index]));
    for (const project of themedProjects) {
      let previousBookIndex = -1;
      for (const task of project.tasks) {
        const match = task.match(/^(.+?)\s+(\d+)(?:장|편)\s+(\d+)–(\d+)절$/);
        expect(match, task).not.toBeNull();
        const [, bookName, chapterText, startText, endText] = match!;
        const book = bibleBooks.find((item) => item.name === bookName)!;
        const currentBookIndex = bookIndex.get(bookName)!;
        const chapter = Number(chapterText);
        expect(currentBookIndex).toBeGreaterThanOrEqual(previousBookIndex);
        expect(chapter).toBeGreaterThan(0);
        expect(chapter).toBeLessThanOrEqual(book.chapters.length);
        expect(Number(startText)).toBeGreaterThan(0);
        expect(Number(endText)).toBeLessThanOrEqual(book.chapters[chapter - 1]);
        previousBookIndex = currentBookIndex;
      }
    }
  });
});
