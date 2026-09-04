import { getRequiredTaskReferences } from './journey-policy';
import { normalizeReadingDay } from './reading-policy';
import { getPlanPassageReferences, type ReadingPlanPassage } from './custom-reading-plan';

type DailyProject = {
  id: string;
  duration?: number;
  kind?: 'guided' | 'free';
  tasks?: string[];
  readingDay?: number;
  readingDayDate?: string;
  dailySchedule?: ReadingPlanPassage[][];
};

export type ReadingState = {
  activeProjects?: DailyProject[];
  [key: string]: unknown;
};

type ReadingRecording = {
  projectId: string;
  book: string;
  chapter: number;
  verse: number;
  createdAt: number;
};

export function getKstDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function repairDailyReadingState(
  state: ReadingState,
  recordings: readonly ReadingRecording[],
  chapterCounts: Readonly<Record<string, readonly number[]>>,
  today: string,
) {
  let changed = false;
  const activeProjects = (state.activeProjects ?? []).map((project) => {
    if (project.kind === 'free' || !project.duration || project.duration < 1 || !Array.isArray(project.tasks)) return project;

    const readingDay = normalizeReadingDay({
      duration: project.duration,
      readingDay: project.readingDay,
      readingDayDate: project.readingDayDate,
    });
    const task = project.tasks[readingDay - 1];
    const scheduledPassages = project.dailySchedule?.[readingDay - 1];
    const required = scheduledPassages?.length
      ? getPlanPassageReferences(scheduledPassages)
      : task ? getRequiredTaskReferences(task, chapterCounts) : new Set<string>();
    const timestamps = new Map<string, number>();
    recordings.forEach((recording) => {
      if (recording.projectId !== project.id) return;
      const reference = `${recording.book}-${recording.chapter}-${recording.verse}`;
      if (!required.has(reference)) return;
      timestamps.set(reference, Math.max(timestamps.get(reference) ?? 0, recording.createdAt));
    });

    const complete = required.size > 0 && [...required].every((reference) => timestamps.has(reference));
    const completedOn = complete
      ? getKstDateKey(new Date(Math.max(...timestamps.values())))
      : undefined;

    if (completedOn && completedOn < today && readingDay < project.duration) {
      changed = true;
      return { ...project, readingDay: readingDay + 1, readingDayDate: today };
    }
    if (project.readingDayDate !== today) {
      changed = true;
      return { ...project, readingDay, readingDayDate: today };
    }
    return project;
  });

  return { state: changed ? { ...state, activeProjects } : state, changed };
}
