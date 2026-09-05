export const GIFT_BGM_CATALOG = [
  { id: 'still-waters', name: 'Aeternum' },
  { id: 'peaceful-morning', name: 'Unto Thee' },
  { id: 'word-breath', name: "The King's Return" },
  { id: 'none', name: '음악 없음' },
] as const;

export const MAX_GIFT_DRAFT_VERSES = 500;

export type GiftDraftScope =
  | {
      kind: 'range';
      start: { bookCode: string; chapter: number; verse: number };
      end: { bookCode: string; chapter: number; verse: number };
    }
  | {
      kind: 'verses';
      bookCode: string;
      chapter: number;
      startVerse: number;
      endVerse: number;
    }
  | { kind: 'chapter'; bookCode: string; chapter: number }
  | {
      kind: 'chapters';
      bookCode: string;
      startChapter: number;
      endChapter: number;
    }
  | { kind: 'books'; bookCodes: string[] }
  | { kind: 'journey'; projectId: string };

type Book = { code: string; name: string; chapters: number[] };
type Journey = {
  projectId: string;
  title: string;
  recordings: Array<{
    id: string;
    book: string;
    chapter: number;
    verse: number;
    verseText: string;
    mimeType: string;
    sizeBytes: number;
    durationSeconds: number;
  }>;
};

export function normalizeGiftDraftScope(value: unknown): GiftDraftScope | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const positive = (key: string) =>
    Number.isInteger(input[key]) && Number(input[key]) > 0
      ? Number(input[key])
      : null;
  const bookCode =
    typeof input.bookCode === 'string' ? input.bookCode.trim() : '';
  if (input.kind === 'chapter' && bookCode && positive('chapter'))
    return { kind: 'chapter', bookCode, chapter: positive('chapter')! };
  if (input.kind === 'range') {
    const start = input.start as Record<string, unknown> | undefined;
    const end = input.end as Record<string, unknown> | undefined;
    if (
      start &&
      end &&
      typeof start.bookCode === 'string' &&
      typeof end.bookCode === 'string'
    )
      return {
        kind: 'range',
        start: {
          bookCode: start.bookCode,
          chapter: Number(start.chapter),
          verse: Number(start.verse),
        },
        end: {
          bookCode: end.bookCode,
          chapter: Number(end.chapter),
          verse: Number(end.verse),
        },
      };
  }
  if (
    input.kind === 'verses' &&
    bookCode &&
    positive('chapter') &&
    positive('startVerse') &&
    positive('endVerse') &&
    Number(input.startVerse) <= Number(input.endVerse)
  )
    return {
      kind: 'verses',
      bookCode,
      chapter: positive('chapter')!,
      startVerse: positive('startVerse')!,
      endVerse: positive('endVerse')!,
    };
  if (
    input.kind === 'chapters' &&
    bookCode &&
    positive('startChapter') &&
    positive('endChapter') &&
    Number(input.startChapter) <= Number(input.endChapter)
  )
    return {
      kind: 'chapters',
      bookCode,
      startChapter: positive('startChapter')!,
      endChapter: positive('endChapter')!,
    };
  if (input.kind === 'books' && Array.isArray(input.bookCodes)) {
    const bookCodes = [
      ...new Set(
        input.bookCodes
          .filter(
            (code): code is string =>
              typeof code === 'string' && Boolean(code.trim()),
          )
          .map((code) => code.trim()),
      ),
    ];
    return bookCodes.length ? { kind: 'books', bookCodes } : null;
  }
  const projectId =
    typeof input.projectId === 'string' ? input.projectId.trim() : '';
  return input.kind === 'journey' && projectId
    ? { kind: 'journey', projectId }
    : null;
}

export function buildGiftDraftPlan({
  scope,
  books,
  journey,
}: {
  scope: GiftDraftScope;
  books: Book[];
  journey?: Journey;
}) {
  const items: Array<{
    position: number;
    book: string;
    chapter: number;
    verse: number;
    verseText: string;
    sourceRecordingId: string | null;
    mimeType: string;
    sizeBytes: number;
    durationSeconds: number;
  }> = [];
  let title = '';
  const addChapter = (
    book: Book,
    chapter: number,
    from = 1,
    to = book.chapters[chapter - 1],
  ) => {
    if (!to || from < 1 || to > book.chapters[chapter - 1]) return false;
    for (let verse = from; verse <= to; verse++)
      items.push({
        position: items.length,
        book: book.name,
        chapter,
        verse,
        verseText: '',
        sourceRecordingId: null,
        mimeType: '',
        sizeBytes: 0,
        durationSeconds: 0,
      });
    return true;
  };
  if (scope.kind === 'journey') {
    if (
      !journey ||
      journey.projectId !== scope.projectId ||
      !journey.recordings.length
    )
      return {
        ok: false as const,
        reason: '녹음한 말씀이 있는 여정을 선택해 주세요.',
      };
    for (const recording of [...journey.recordings].sort(
      (a, b) => a.chapter - b.chapter || a.verse - b.verse,
    ))
      items.push({
        position: items.length,
        book: recording.book,
        chapter: recording.chapter,
        verse: recording.verse,
        verseText: recording.verseText,
        sourceRecordingId: recording.id,
        mimeType: recording.mimeType,
        sizeBytes: recording.sizeBytes,
        durationSeconds: recording.durationSeconds,
      });
    title = `${journey.title} 녹음`;
  } else if (scope.kind === 'range') {
    const startIndex = books.findIndex(
      (book) => book.code === scope.start.bookCode,
    );
    const endIndex = books.findIndex(
      (book) => book.code === scope.end.bookCode,
    );
    if (startIndex < 0 || endIndex < startIndex)
      return { ok: false as const, reason: '말씀 범위를 다시 확인해 주세요.' };
    const selected = books.slice(startIndex, endIndex + 1);
    for (const book of selected)
      for (
        let chapter =
          book.code === scope.start.bookCode ? scope.start.chapter : 1;
        chapter <=
        (book.code === scope.end.bookCode
          ? scope.end.chapter
          : book.chapters.length);
        chapter++
      ) {
        const from =
          book.code === scope.start.bookCode && chapter === scope.start.chapter
            ? scope.start.verse
            : 1;
        const to =
          book.code === scope.end.bookCode && chapter === scope.end.chapter
            ? scope.end.verse
            : book.chapters[chapter - 1];
        if (!addChapter(book, chapter, from, to))
          return {
            ok: false as const,
            reason: '말씀 범위를 다시 확인해 주세요.',
          };
      }
    const first = selected[0];
    const last = selected.at(-1)!;
    title = `${first.name} ${scope.start.chapter}:${scope.start.verse}–${last.name} ${scope.end.chapter}:${scope.end.verse}`;
  } else if (scope.kind === 'books') {
    const selected = books.filter((book) =>
      scope.bookCodes.includes(book.code),
    );
    if (selected.length !== scope.bookCodes.length)
      return {
        ok: false as const,
        reason: '성경책 범위를 다시 확인해 주세요.',
      };
    for (const book of selected)
      for (let chapter = 1; chapter <= book.chapters.length; chapter++)
        addChapter(book, chapter);
    title = `${selected.map((book) => book.name).join(' · ')} 전체`;
  } else {
    const book = books.find((candidate) => candidate.code === scope.bookCode);
    if (!book)
      return { ok: false as const, reason: '성경책을 찾을 수 없습니다.' };
    if (scope.kind === 'chapter') {
      if (!addChapter(book, scope.chapter))
        return { ok: false as const, reason: '장을 다시 확인해 주세요.' };
      title = `${book.name} ${scope.chapter}${book.name === '시편' ? '편' : '장'}`;
    } else if (scope.kind === 'verses') {
      if (!addChapter(book, scope.chapter, scope.startVerse, scope.endVerse))
        return { ok: false as const, reason: '구절을 다시 확인해 주세요.' };
      title = `${book.name} ${scope.chapter}${book.name === '시편' ? '편' : '장'} ${scope.startVerse}–${scope.endVerse}절`;
    } else {
      for (
        let chapter = scope.startChapter;
        chapter <= scope.endChapter;
        chapter++
      )
        if (!addChapter(book, chapter))
          return {
            ok: false as const,
            reason: '장 범위를 다시 확인해 주세요.',
          };
      title = `${book.name} ${scope.startChapter}–${scope.endChapter}장`;
    }
  }
  if (items.length > MAX_GIFT_DRAFT_VERSES)
    return {
      ok: false as const,
      reason: `한 선물에는 최대 ${MAX_GIFT_DRAFT_VERSES}절까지 담을 수 있어요. 범위를 줄여 주세요.`,
    };
  return { ok: true as const, title, items };
}

export function getGiftDraftProgress(
  items: Array<{
    objectKey?: string | null;
    sourceRecordingId?: string | null;
    recorded?: boolean;
  }>,
) {
  const hasRecording = (item: {
    objectKey?: string | null;
    sourceRecordingId?: string | null;
    recorded?: boolean;
  }) => Boolean(item.recorded || item.objectKey || item.sourceRecordingId);
  const recorded = items.filter(hasRecording).length;
  const nextPosition = items.findIndex((item) => !hasRecording(item));
  return {
    total: items.length,
    recorded,
    nextPosition: nextPosition < 0 ? null : nextPosition,
  };
}

export function isGiftDraftSendable(
  items: Array<{
    objectKey?: string | null;
    sourceRecordingId?: string | null;
    recorded?: boolean;
  }>,
) {
  return (
    items.length > 0 && getGiftDraftProgress(items).recorded === items.length
  );
}

export function normalizeGiftDraftSettings(value: unknown) {
  const input =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  const allowed = new Set<string>(GIFT_BGM_CATALOG.map((item) => item.id));
  const bgmId =
    typeof input.bgmId === 'string' && allowed.has(input.bgmId)
      ? input.bgmId
      : 'none';
  const rawVolume =
    typeof input.bgmVolume === 'number' && Number.isFinite(input.bgmVolume)
      ? input.bgmVolume
      : 12;
  return {
    bgmId,
    bgmVolume: Math.max(0, Math.min(100, Math.round(rawVolume))),
  };
}
