export type ReadingPlanMode =
  | 'range'
  | 'chapter'
  | 'old'
  | 'new'
  | 'whole'
  | 'single'
  | 'multiple';

export type ReadingPlanBook = {
  testament: 'old' | 'new';
  code: string;
  name: string;
  chapters: readonly number[];
};

export type ReadingPlanPassage = {
  code: string;
  name: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
};

export type CustomReadingPlan = {
  mode: ReadingPlanMode;
  bookNames: string[];
  totalChapters: number;
  totalVerses: number;
  requestedDays: number;
  days: Array<{
    label: string;
    verseCount: number;
    passages: ReadingPlanPassage[];
  }>;
  scope: string;
};

type BuildReadingPlanInput = {
  books: readonly ReadingPlanBook[];
  mode: ReadingPlanMode;
  singleBookId?: string;
  startChapter?: number;
  startVerse?: number;
  endChapter?: number;
  endVerse?: number;
  selectedBookIds?: readonly string[];
  durationDays: number;
  range?: {
    start: { bookCode: string; chapter: number; verse: number };
    end: { bookCode: string; chapter: number; verse: number };
  };
};

type VerseReference = Omit<ReadingPlanPassage, 'startVerse' | 'endVerse'> & {
  verse: number;
};

function selectBooks(input: BuildReadingPlanInput) {
  if (input.mode === 'single')
    return input.books.filter((book) => book.code === input.singleBookId);
  if (input.mode === 'multiple') {
    const selected = new Set(input.selectedBookIds ?? []);
    return input.books.filter((book) => selected.has(book.code));
  }
  if (input.mode === 'range' || input.mode === 'chapter') {
    const start = input.books.findIndex(
      (book) => book.code === input.range?.start.bookCode,
    );
    const end = input.books.findIndex(
      (book) => book.code === input.range?.end.bookCode,
    );
    return start >= 0 && end >= start ? input.books.slice(start, end + 1) : [];
  }
  if (input.mode === 'old' || input.mode === 'new')
    return input.books.filter((book) => book.testament === input.mode);
  return [...input.books];
}

function formatPassage(passage: ReadingPlanPassage) {
  const unit = passage.name === '시편' ? '편' : '장';
  return `${passage.name} ${passage.chapter}${unit} ${passage.startVerse}–${passage.endVerse}절`;
}

function formatDay(passages: readonly ReadingPlanPassage[]) {
  if (!passages.length) return '';
  if (passages.length === 1) return formatPassage(passages[0]);
  const first = passages[0];
  const last = passages[passages.length - 1];
  if (first.name === last.name) {
    const unit = first.name === '시편' ? '편' : '장';
    return `${first.name} ${first.chapter}${unit} ${first.startVerse}절 ~ ${last.chapter}${unit} ${last.endVerse}절`;
  }
  return `${formatPassage(first)} ~ ${formatPassage(last)}`;
}

function passagesFromVerses(verses: readonly VerseReference[]) {
  const passages: ReadingPlanPassage[] = [];
  verses.forEach((reference) => {
    const previous = passages.at(-1);
    if (
      previous &&
      previous.code === reference.code &&
      previous.chapter === reference.chapter &&
      previous.endVerse + 1 === reference.verse
    ) {
      previous.endVerse = reference.verse;
      return;
    }
    passages.push({
      code: reference.code,
      name: reference.name,
      chapter: reference.chapter,
      startVerse: reference.verse,
      endVerse: reference.verse,
    });
  });
  return passages;
}

export function buildCustomReadingPlan(
  input: BuildReadingPlanInput,
): CustomReadingPlan {
  const selectedBooks = selectBooks(input);
  const verses: VerseReference[] = [];
  let totalChapters = 0;

  selectedBooks.forEach((book) => {
    const isStartBook =
      (input.mode === 'range' || input.mode === 'chapter') &&
      book.code === input.range?.start.bookCode;
    const isEndBook =
      (input.mode === 'range' || input.mode === 'chapter') &&
      book.code === input.range?.end.bookCode;
    const startChapter =
      isStartBook || input.mode === 'single'
        ? Math.max(
            1,
            Math.min(
              Math.trunc(
                isStartBook
                  ? (input.range?.start.chapter ?? 1)
                  : (input.startChapter ?? 1),
              ),
              book.chapters.length,
            ),
          )
        : 1;
    const endChapter =
      isEndBook || input.mode === 'single'
        ? Math.max(
            startChapter,
            Math.min(
              Math.trunc(
                isEndBook
                  ? (input.range?.end.chapter ?? book.chapters.length)
                  : (input.endChapter ?? book.chapters.length),
              ),
              book.chapters.length,
            ),
          )
        : book.chapters.length;
    const startVerse =
      isStartBook || input.mode === 'single'
        ? Math.max(
            1,
            Math.min(
              Math.trunc(
                isStartBook
                  ? (input.range?.start.verse ?? 1)
                  : (input.startVerse ?? 1),
              ),
              book.chapters[startChapter - 1],
            ),
          )
        : 1;
    const requestedEndVerse =
      isEndBook || input.mode === 'single'
        ? Math.max(
            1,
            Math.min(
              Math.trunc(
                isEndBook
                  ? (input.range?.end.verse ?? book.chapters[endChapter - 1])
                  : (input.endVerse ?? book.chapters[endChapter - 1]),
              ),
              book.chapters[endChapter - 1],
            ),
          )
        : book.chapters[endChapter - 1];
    const endVerse =
      startChapter === endChapter
        ? Math.max(startVerse, requestedEndVerse)
        : requestedEndVerse;
    totalChapters += endChapter - startChapter + 1;
    for (let chapter = startChapter; chapter <= endChapter; chapter += 1) {
      const firstVerse = chapter === startChapter ? startVerse : 1;
      const lastVerse =
        chapter === endChapter ? endVerse : book.chapters[chapter - 1];
      for (let verse = firstVerse; verse <= lastVerse; verse += 1) {
        verses.push({ code: book.code, name: book.name, chapter, verse });
      }
    }
  });

  const requestedDays = Math.max(
    1,
    Math.min(1095, Math.trunc(input.durationDays) || 1),
  );
  const dayCount = Math.min(requestedDays, verses.length);
  let cursor = 0;
  const days = Array.from({ length: dayCount }, (_, index) => {
    const verseCount =
      Math.floor(verses.length / dayCount) +
      (index < verses.length % dayCount ? 1 : 0);
    const dayVerses = verses.slice(cursor, cursor + verseCount);
    cursor += verseCount;
    const passages = passagesFromVerses(dayVerses);
    return { label: formatDay(passages), verseCount, passages };
  });

  const bookNames = selectedBooks.map((book) => book.name);
  const singleBookUnit = bookNames[0] === '시편' ? '편' : '장';
  const firstPassage = days[0]?.passages[0];
  const lastPassage = days.at(-1)?.passages.at(-1);
  const hasExplicitVerseRange =
    input.startVerse !== undefined || input.endVerse !== undefined;
  const scope =
    input.mode === 'range' || input.mode === 'chapter'
      ? `${firstPassage?.name ?? '성경'} ${firstPassage?.chapter ?? 1}${firstPassage?.name === '시편' ? '편' : '장'} ${firstPassage?.startVerse ?? 1}절부터 ${lastPassage?.name ?? '성경'} ${lastPassage?.chapter ?? 1}${lastPassage?.name === '시편' ? '편' : '장'} ${lastPassage?.endVerse ?? 1}절까지`
      : input.mode === 'single'
        ? hasExplicitVerseRange
          ? `${bookNames[0] ?? '성경'} ${firstPassage?.chapter ?? 1}${singleBookUnit} ${firstPassage?.startVerse ?? 1}절부터 ${lastPassage?.chapter ?? 1}${singleBookUnit} ${lastPassage?.endVerse ?? 1}절`
          : `${bookNames[0] ?? '성경'} ${firstPassage?.chapter ?? 1}${singleBookUnit}부터 ${lastPassage?.chapter ?? 1}${singleBookUnit}`
        : input.mode === 'multiple'
          ? `${bookNames.join(' · ')} 전체`
          : input.mode === 'old'
            ? '구약 39권 전체'
            : input.mode === 'new'
              ? '신약 27권 전체'
              : '성경 66권 전체';

  return {
    mode: input.mode,
    bookNames,
    totalChapters,
    totalVerses: verses.length,
    requestedDays,
    days,
    scope,
  };
}

export function getPlanPassageReferences(
  passages: readonly ReadingPlanPassage[],
) {
  const references = new Set<string>();
  passages.forEach((passage) => {
    for (
      let verse = passage.startVerse;
      verse <= passage.endVerse;
      verse += 1
    ) {
      references.add(`${passage.name}-${passage.chapter}-${verse}`);
    }
  });
  return references;
}

export function findFirstIncompletePassageIndex(
  passages: readonly ReadingPlanPassage[],
  recordedReferences: ReadonlySet<string>,
) {
  const firstIncomplete = passages.findIndex((passage) =>
    [...getPlanPassageReferences([passage])].some(
      (reference) => !recordedReferences.has(reference),
    ),
  );
  return firstIncomplete >= 0
    ? firstIncomplete
    : Math.max(0, passages.length - 1);
}
