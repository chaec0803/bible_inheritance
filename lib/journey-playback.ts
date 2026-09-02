import { getRequiredJourneyReferences } from './journey-policy';

type PlaybackRecording = {
  book: string;
  chapter: number;
  verse: number;
};

function recordingReference(recording: PlaybackRecording) {
  return `${recording.book}-${recording.chapter}-${recording.verse}`;
}

export function orderJourneyRecordings<T extends PlaybackRecording>(
  recordings: readonly T[],
  tasks: readonly string[],
  chapterCounts: Readonly<Record<string, readonly number[]>>,
) {
  const latestByReference = new Map<string, T>();
  recordings.forEach((recording) => {
    const reference = recordingReference(recording);
    if (!latestByReference.has(reference)) latestByReference.set(reference, recording);
  });

  const journeyOrder = new Map(
    [...getRequiredJourneyReferences(tasks, chapterCounts)].map((reference, index) => [reference, index]),
  );

  return [...latestByReference.values()].sort((left, right) => {
    const leftOrder = journeyOrder.get(recordingReference(left));
    const rightOrder = journeyOrder.get(recordingReference(right));
    if (leftOrder !== undefined || rightOrder !== undefined) {
      return (leftOrder ?? Number.MAX_SAFE_INTEGER) - (rightOrder ?? Number.MAX_SAFE_INTEGER);
    }
    return 0;
  });
}
