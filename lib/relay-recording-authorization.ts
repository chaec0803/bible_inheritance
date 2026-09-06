import type { ReadingPlanPassage } from './custom-reading-plan';
import { isVerseInRelayPassages } from './relay-recording-completeness';

export type RelayRecordingAuthorizationState = {
  projectStatus: string;
  currentTurnIndex: number | null;
  participant: boolean;
  turnIndex: number;
  turnMemberKey: string;
  turnCompletedAt: number | null;
  passages: readonly ReadingPlanPassage[];
};

export function canMutateRelayRecording(
  state: RelayRecordingAuthorizationState,
  userKey: string,
  target: { book: string; chapter: number; verse: number },
) {
  return state.participant
    && state.projectStatus === 'in_progress'
    && state.currentTurnIndex === state.turnIndex
    && state.turnMemberKey === userKey
    && state.turnCompletedAt === null
    && isVerseInRelayPassages(state.passages, target);
}
