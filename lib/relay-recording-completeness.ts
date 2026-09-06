import type { ReadingPlanPassage } from './custom-reading-plan';

export type RelayRecordingRow = {
  ownerKey: string;
  projectId: string;
  book: string;
  chapter: number;
  verse: number;
};

export function getRelayRecordingProjectId(projectId: string, turnIndex: number) {
  return `relay:${projectId}:turn:${turnIndex}`;
}

export type RelayRecordingContext =
  | { kind: 'standard' }
  | { kind: 'malformed' }
  | { kind: 'relay'; projectId: string; turnIndex: number };

export function parseRelayRecordingProjectId(value: string): RelayRecordingContext {
  if (!value.startsWith('relay:')) return { kind: 'standard' };
  const match = /^relay:([^:]+):turn:(0|[1-9]\d*)$/.exec(value);
  if (!match) return { kind: 'malformed' };
  const turnIndex = Number(match[2]);
  if (!Number.isSafeInteger(turnIndex)) return { kind: 'malformed' };
  return { kind: 'relay', projectId: match[1], turnIndex };
}

export function isVerseInRelayPassages(
  passages: readonly ReadingPlanPassage[],
  target: { book: string; chapter: number; verse: number },
) {
  return passages.some((passage) => passage.name === target.book
    && passage.chapter === target.chapter
    && target.verse >= passage.startVerse
    && target.verse <= passage.endVerse);
}

function passageReferences(passages: readonly ReadingPlanPassage[]) {
  const references: string[] = [];
  for (const passage of passages) {
    for (let verse = passage.startVerse; verse <= passage.endVerse; verse += 1) {
      references.push(`${passage.name}-${passage.chapter}-${verse}`);
    }
  }
  return references;
}

export function inspectRelayTurnRecordings(input: {
  projectId: string;
  turnIndex: number;
  memberKey: string;
  passages: readonly ReadingPlanPassage[];
  recordings: readonly RelayRecordingRow[];
}) {
  const required = passageReferences(input.passages);
  const recordingProjectId = getRelayRecordingProjectId(input.projectId, input.turnIndex);
  const recorded = new Set(input.recordings
    .filter((recording) => recording.ownerKey === input.memberKey && recording.projectId === recordingProjectId)
    .map((recording) => `${recording.book}-${recording.chapter}-${recording.verse}`));
  const missingReferences = required.filter((reference) => !recorded.has(reference));
  return {
    complete: required.length > 0 && missingReferences.length === 0,
    requiredCount: required.length,
    recordedCount: required.length - missingReferences.length,
    missingReferences,
  };
}
