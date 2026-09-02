export type RecoverableRecording = {
  projectId: string;
  book: string;
  chapter: number;
  verse: number;
};

export type RecoverableTemplate = {
  id: string;
  title: string;
  duration: number;
  scope: string;
  tasks: string[];
  custom?: boolean;
};

export type RecoverableBook = { code: string; name: string };

export type RecoveredProject = {
  id: string;
  title: string;
  duration: number;
  scope: string;
  tasks: string[];
  kind: 'guided' | 'free';
  passage?: { code: string; name: string; chapter: number; startVerse: number; endVerse: number };
  startedOn: string;
  readingDay?: number;
  readingDayDate?: string;
};

export function recoverJourneyProjects(
  recordings: readonly RecoverableRecording[],
  templates: readonly RecoverableTemplate[],
  books: readonly RecoverableBook[],
  today: string,
) {
  const recovered = new Map<string, RecoveredProject>();
  recordings.forEach((recording) => {
    const template = templates.find((item) => item.id === recording.projectId && !item.custom);
    if (template && !recovered.has(template.id)) {
      recovered.set(template.id, {
        id: template.id,
        title: template.title,
        duration: template.duration,
        scope: template.scope,
        tasks: template.tasks,
        kind: 'guided',
        startedOn: today,
        readingDay: 1,
        readingDayDate: today,
      });
      return;
    }
    if (recording.projectId !== 'free-recording' && !recording.projectId.startsWith('free-')) return;
    const book = books.find((item) => item.name === recording.book);
    const id = `free-${book?.code ?? recording.book}`;
    const existing = recovered.get(id);
    if (existing?.passage) {
      existing.passage.endVerse = Math.max(existing.passage.endVerse, recording.verse);
      if (!existing.tasks.includes(`${recording.book} ${recording.chapter}장`)) existing.tasks.push(`${recording.book} ${recording.chapter}장`);
      return;
    }
    recovered.set(id, {
      id,
      title: `${recording.book} 녹음`,
      duration: 0,
      scope: `${recording.book} 자유 녹음`,
      tasks: [`${recording.book} ${recording.chapter}장`],
      kind: 'free',
      passage: { code: book?.code ?? recording.book, name: recording.book, chapter: recording.chapter, startVerse: 1, endVerse: recording.verse },
      startedOn: today,
    });
  });
  return [...recovered.values()];
}
