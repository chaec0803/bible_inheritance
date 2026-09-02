export type ReadingSchedule = {
  duration: number;
  readingDay?: number;
  readingDayDate?: string;
};

export function normalizeReadingDay(schedule: ReadingSchedule) {
  if (schedule.duration < 1) return 1;
  return Math.min(schedule.duration, Math.max(1, schedule.readingDay ?? 1));
}

export function canAdvanceReadingSchedule(
  schedule: ReadingSchedule,
  today: string,
  stateReady: boolean,
  recordingsLoading: boolean,
  completedOn?: string,
) {
  return stateReady
    && !recordingsLoading
    && (schedule.readingDayDate !== today || Boolean(completedOn && completedOn < today));
}

export function advanceReadingSchedule(
  schedule: ReadingSchedule,
  completedTaskIndexes: ReadonlySet<number>,
  today: string,
) {
  const currentDay = normalizeReadingDay(schedule);
  if (schedule.readingDayDate === today) return { readingDay: currentDay, readingDayDate: today };
  const readingDay = completedTaskIndexes.has(currentDay - 1)
    ? Math.min(schedule.duration, currentDay + 1)
    : currentDay;
  return { readingDay, readingDayDate: today };
}
