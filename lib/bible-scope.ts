export type BiblePoint = { bookCode: string; chapter: number; verse: number };
export type BibleRange = { start: BiblePoint; end: BiblePoint };
type Book = { code: string; name: string; chapters: number[] };

export function changeRangeBook(
  current: BibleRange | undefined,
  edge: 'start' | 'end',
  bookCode: string,
  books: Book[],
): BibleRange {
  const book = books.find((item) => item.code === bookCode) ?? books[0];
  const first = { bookCode: book.code, chapter: 1, verse: 1 };
  const last = {
    bookCode: book.code,
    chapter: book.chapters.length,
    verse: book.chapters.at(-1) ?? 1,
  };
  const fallback = current ?? { start: first, end: last };
  return edge === 'start'
    ? { ...fallback, start: first }
    : { ...fallback, end: last };
}

export function normalizeBibleRange(
  value: unknown,
  books: Book[],
): BibleRange | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Partial<BibleRange>;
  const valid = (point?: BiblePoint) => {
    const book = books.find((item) => item.code === point?.bookCode);
    return (
      book &&
      Number.isInteger(point?.chapter) &&
      Number.isInteger(point?.verse) &&
      point!.chapter > 0 &&
      point!.chapter <= book.chapters.length &&
      point!.verse > 0 &&
      point!.verse <= book.chapters[point!.chapter - 1]
    );
  };
  if (!valid(input.start) || !valid(input.end)) return null;
  const startBook = books.findIndex(
    (book) => book.code === input.start!.bookCode,
  );
  const endBook = books.findIndex((book) => book.code === input.end!.bookCode);
  const ordered =
    startBook < endBook ||
    (startBook === endBook &&
      (input.start!.chapter < input.end!.chapter ||
        (input.start!.chapter === input.end!.chapter &&
          input.start!.verse <= input.end!.verse)));
  return ordered ? { start: input.start!, end: input.end! } : null;
}
