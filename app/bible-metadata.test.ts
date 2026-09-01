import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bibleBooks } from './bible-metadata';

describe('Bible data catalog', () => {
  it('contains all 66 Bible books', () => {
    expect(bibleBooks).toHaveLength(66);
    expect(new Set(bibleBooks.map((book) => book.code)).size).toBe(66);
  });

  it('has one non-empty data file whose chapter and verse counts match metadata for every book', async () => {
    for (const book of bibleBooks) {
      const raw = await readFile(resolve('public/data/bible', `${book.code}.json`), 'utf8');
      const chapters = JSON.parse(raw) as string[][];
      expect(chapters, book.name).toHaveLength(book.chapters.length);
      chapters.forEach((verses, chapterIndex) => {
        expect(verses, `${book.name} ${chapterIndex + 1}장`).toHaveLength(book.chapters[chapterIndex]);
        verses.forEach((verse) => expect(verse.trim().length).toBeGreaterThan(0));
      });
    }
  });
});
