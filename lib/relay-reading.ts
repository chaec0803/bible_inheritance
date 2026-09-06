import type { BibleRange } from './bible-scope';
import {
  buildCustomReadingPlan,
  type ReadingPlanBook,
  type ReadingPlanPassage,
} from './custom-reading-plan';

export type RelayProjectStatus =
  | 'pending_invites'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type RelayInviteStatus = 'pending' | 'accepted' | 'declined';

export type RelayParticipant = {
  memberKey: string;
  position: number;
  inviteStatus: RelayInviteStatus;
  respondedAt: number | null;
};

export type RelayTurnAllocation = {
  turnIndex: number;
  memberKey: string;
  verseCount: number;
  passages: ReadingPlanPassage[];
};

type BuildRelayTurnsInput = {
  books: readonly ReadingPlanBook[];
  range: BibleRange;
  memberKeys: readonly string[];
  rotation: number;
};

export function buildRelayTurns(input: BuildRelayTurnsInput): RelayTurnAllocation[] {
  const memberKeys = input.memberKeys.map((key) => key.trim()).filter(Boolean);
  if (memberKeys.length < 2) throw new Error('이어읽기에는 두 명 이상이 필요해요.');
  if (new Set(memberKeys).size !== memberKeys.length) throw new Error('참여자가 중복되었어요.');
  if (!Number.isInteger(input.rotation) || input.rotation < 1) throw new Error('rotation이 올바르지 않아요.');

  const totalTurns = memberKeys.length * input.rotation;
  const plan = buildCustomReadingPlan({
    books: input.books,
    mode: 'range',
    range: input.range,
    durationDays: totalTurns,
  });
  if (plan.totalVerses < totalTurns) throw new Error('전체 turn 수보다 말씀 절 수가 적어요.');
  if (plan.days.length !== totalTurns) throw new Error('말씀을 모든 turn에 배분하지 못했어요.');

  return plan.days.map((allocation, turnIndex) => ({
    turnIndex,
    memberKey: memberKeys[turnIndex % memberKeys.length],
    verseCount: allocation.verseCount,
    passages: allocation.passages,
  }));
}

type RespondToRelayInviteInput = {
  projectStatus: RelayProjectStatus;
  participants: readonly RelayParticipant[];
  memberKey: string;
  response: Exclude<RelayInviteStatus, 'pending'>;
  now: number;
};

export function respondToRelayInvite(input: RespondToRelayInviteInput) {
  if (input.projectStatus !== 'pending_invites') throw new Error('응답할 수 없는 이어읽기예요.');
  const participant = input.participants.find((item) => item.memberKey === input.memberKey);
  if (!participant) throw new Error('이어읽기 참여자가 아니에요.');
  if (participant.inviteStatus !== 'pending') throw new Error('이미 응답한 초대예요.');

  const participants = input.participants.map((item) => item.memberKey === input.memberKey
    ? { ...item, inviteStatus: input.response, respondedAt: input.now }
    : item);
  if (input.response === 'declined') {
    return { projectStatus: 'cancelled' as const, currentTurnIndex: null, participants };
  }
  const allAccepted = participants.every((item) => item.inviteStatus === 'accepted');
  return {
    projectStatus: allAccepted ? 'in_progress' as const : 'pending_invites' as const,
    currentTurnIndex: allAccepted ? 0 : null,
    participants,
  };
}

type RelayTurn = { turnIndex: number; memberKey: string; completedAt: number | null };
type RelayProjectProgress = { status: RelayProjectStatus; currentTurnIndex: number | null };

export function getRelayTurnState(
  project: RelayProjectProgress,
  turns: readonly RelayTurn[],
  memberKey: string,
) {
  if (project.status === 'pending_invites') return { kind: 'invites_pending' as const };
  if (project.status === 'cancelled') return { kind: 'cancelled' as const };
  if (project.status === 'completed') return { kind: 'completed' as const };

  const currentTurn = turns.find((turn) => turn.turnIndex === project.currentTurnIndex);
  if (!currentTurn) return { kind: 'unavailable' as const };
  if (currentTurn.memberKey === memberKey && currentTurn.completedAt === null) {
    return { kind: 'recordable' as const, turnIndex: currentTurn.turnIndex };
  }
  const nextOwnTurn = turns.find((turn) => turn.turnIndex > currentTurn.turnIndex && turn.memberKey === memberKey);
  return {
    kind: 'waiting' as const,
    currentMemberKey: currentTurn.memberKey,
    currentTurnIndex: currentTurn.turnIndex,
    nextOwnTurnIndex: nextOwnTurn?.turnIndex ?? null,
  };
}
