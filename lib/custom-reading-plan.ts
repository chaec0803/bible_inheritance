export type ReadingPlanMode = 'single' | 'multiple' | 'old' | 'new' | 'whole';

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
  days: Array<{ label: string; verseCount: number; passages: ReadingPlanPassage[] }>;
  scope: string;
};

type BuildReadingPlanInput = {
  books: readonly ReadingPlanBook[];
  mode: ReadingPlanMode;
  singleBookId?: string;
  startChapter?: number;
  endChapter?: number;
  selectedBookIds?: readonly string[];
  durationDays: number;
};

type VerseReference = Omit<ReadingPlanPassage, 'startVerse' | 'endVerse'> & { verse: number };

function selectBooks(input: BuildReadingPlanInput) {
  if (input.mode === 'single') return input.books.filter((book) => book.code === input.singleBookId);
  if (input.mode === 'multiple') {
    const selected = new Set(input.selectedBookIds ?? []);
    return input.books.filter((book) => selected.has(book.code));
  }
  if (input.mode === 'old' || input.mode === 'new') return input.books.filter((book) => book.testament === input.mode);
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
    if (previous && previous.code === reference.code && previous.chapter === reference.chapter && previous.endVerse + 1 === reference.verse) {
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

export function buildCustomReadingPlan(input: BuildReadingPlanInput): CustomReadingPlan {
  const selectedBooks = selectBooks(input);
  const verses: VerseReference[] = [];
  let totalChapters = 0;

  selectedBooks.forEach((book) => {
    const startChapter = input.mode === 'single'
      ? Math.max(1, Math.min(Math.trunc(input.startChapter ?? 1), book.chapters.length))
      : 1;
    const endChapter = input.mode === 'single'
      ? Math.max(startChapter, Math.min(Math.trunc(input.endChapter ?? book.chapters.length), book.chapters.length))
      : book.chapters.length;
    totalChapters += endChapter - startChapter + 1;
    for (let chapter = startChapter; chapter <= endChapter; chapter += 1) {
      for (let verse = 1; verse <= book.chapters[chapter - 1]; verse += 1) {
        verses.push({ code: book.code, name: book.name, chapter, verse });
      }
    }
  });

  const requestedDays = Math.max(1, Math.min(1095, Math.trunc(input.durationDays) || 1));
  const dayCount = Math.min(requestedDays, verses.length);
  let cursor = 0;
  const days = Array.from({ length: dayCount }, (_, index) => {
    const verseCount = Math.floor(verses.length / dayCount) + (index < verses.length % dayCount ? 1 : 0);
    const dayVerses = verses.slice(cursor, cursor + verseCount);
    cursor += verseCount;
    const passages = passagesFromVerses(dayVerses);
    return { label: formatDay(passages), verseCount, passages };
  });

  const bookNames = selectedBooks.map((book) => book.name);
  const singleBookUnit = bookNames[0] === '시편' ? '편' : '장';
  const scope = input.mode === 'single'
    ? `${bookNames[0] ?? '성경'} ${days[0]?.passages[0]?.chapter ?? 1}${singleBookUnit}부터 ${days.at(-1)?.passages.at(-1)?.chapter ?? 1}${singleBookUnit}`
    : input.mode === 'multiple'
      ? `${bookNames.join(' · ')} 전체`
      : input.mode === 'old' ? '구약 39권 전체' : input.mode === 'new' ? '신약 27권 전체' : '성경 66권 전체';

  return { mode: input.mode, bookNames, totalChapters, totalVerses: verses.length, requestedDays, days, scope };
}

export function getPlanPassageReferences(passages: readonly ReadingPlanPassage[]) {
  const references = new Set<string>();
  passages.forEach((passage) => {
    for (let verse = passage.startVerse; verse <= passage.endVerse; verse += 1) {
      references.add(`${passage.name}-${passage.chapter}-${verse}`);
    }
  });
  return references;
}

export function findFirstIncompletePassageIndex(passages: readonly ReadingPlanPassage[], recordedReferences: ReadonlySet<string>) {
  const firstIncomplete = passages.findIndex((passage) => [...getPlanPassageReferences([passage])].some((reference) => !recordedReferences.has(reference)));
  return firstIncomplete >= 0 ? firstIncomplete : Math.max(0, passages.length - 1);
}
