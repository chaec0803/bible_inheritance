type JourneyIdentity = { id: string };
type JourneyRecording = { id: string; projectId: string };
type JourneyWithKind = JourneyIdentity & { kind?: 'guided' | 'free' };

export function getJourneyRecordingIds(recordings: readonly JourneyRecording[], journeyId: string) {
  return recordings.filter((recording) => recording.projectId === journeyId).map((recording) => recording.id);
}

export function removeJourney<T extends JourneyIdentity>(journeys: readonly T[], journeyId: string) {
  return journeys.filter((journey) => journey.id !== journeyId);
}

export function restoreJourney<T extends JourneyIdentity>(journeys: readonly T[], journey: T) {
  return journeys.some((item) => item.id === journey.id) ? [...journeys] : [...journeys, journey];
}

export function getRequiredJourneyReferences(tasks: readonly string[], chapterCounts: Readonly<Record<string, readonly number[]>>) {
  const references = new Set<string>();
  tasks.forEach((task) => {
    if (task.includes('전체 확인') || task.includes('밀린 녹음')) return;
    const match = task.match(/^(.+?)\s+(\d+)(?:장|편)\s+(\d+)(?:–(\d+))?절(?:\s*~\s*(\d+)장\s+(\d+)절)?/);
    if (!match) return;
    const book = match[1];
    const startChapter = Number(match[2]);
    const startVerse = Number(match[3]);
    const endChapter = Number(match[5] ?? startChapter);
    const endVerse = Number(match[6] ?? match[4] ?? startVerse);
    for (let chapter = startChapter; chapter <= endChapter; chapter += 1) {
      const firstVerse = chapter === startChapter ? startVerse : 1;
      const lastVerse = chapter === endChapter ? endVerse : chapterCounts[book]?.[chapter - 1] ?? 0;
      for (let verse = firstVerse; verse <= lastVerse; verse += 1) references.add(`${book}-${chapter}-${verse}`);
    }
  });
  return references;
}

export function isJourneyCompleted(requiredReferences: ReadonlySet<string>, recordedReferences: ReadonlySet<string>) {
  return requiredReferences.size > 0 && [...requiredReferences].every((reference) => recordedReferences.has(reference));
}

export function splitOngoingJourneys<T extends JourneyWithKind>(journeys: readonly T[]) {
  return {
    guided: journeys.filter((journey) => journey.kind !== 'free'),
    free: journeys.filter((journey) => journey.kind === 'free'),
  };
}
