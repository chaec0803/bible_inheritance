type RelayUiTurn = { turnIndex: number; memberKey: string; completedAt: number | null; passages: unknown[] };
type RelayUiProject = { status: string; canRecord: boolean; currentTurnIndex: number | null; myPosition: number; turns: RelayUiTurn[] };

export function getRelayProgress({ currentTurnIndex, participantCount, rotation, myPosition }: {
  currentTurnIndex: number | null;
  participantCount: number;
  rotation: number;
  myPosition: number;
}) {
  const safeParticipantCount = Math.max(1, participantCount);
  const currentRound = Math.min(rotation, Math.floor(Math.max(0, currentTurnIndex ?? 0) / safeParticipantCount) + 1);
  return {
    currentRound,
    totalRounds: rotation,
    myTurn: myPosition + 1,
    totalParticipants: participantCount,
  };
}

export function getRelayProjectView(project: RelayUiProject) {
  if (project.status === 'pending_invites') return { kind: 'invites_pending' as const };
  if (project.status === 'cancelled') return { kind: 'cancelled' as const };
  if (project.status === 'completed') return { kind: 'completed' as const };
  if (project.status !== 'in_progress' || project.currentTurnIndex === null) return { kind: 'unavailable' as const };
  const currentTurnIndex = project.currentTurnIndex;
  if (project.canRecord) return { kind: 'recordable' as const, turnIndex: currentTurnIndex };
  const myMemberKey = project.turns.find((turn) => turn.turnIndex % Math.max(1, new Set(project.turns.map((item) => item.memberKey)).size) === project.myPosition)?.memberKey;
  const nextOwnTurn = project.turns.find((turn) => turn.turnIndex > currentTurnIndex && turn.memberKey === myMemberKey && turn.completedAt === null);
  return { kind: 'waiting' as const, nextOwnTurnIndex: nextOwnTurn?.turnIndex ?? null };
}

const relayErrors: Record<string, string> = {
  NOT_CURRENT_TURN: '이미 다음 차례로 넘어갔어요.',
  RECORDINGS_INCOMPLETE: '아직 녹음하지 않은 말씀이 있어요.',
  PROJECT_CANCELLED: '이 이어읽기는 취소되었어요.',
  PROJECT_COMPLETED: '이미 완성된 이어읽기예요.',
};

export function relayErrorMessage(code: string | undefined, fallback = '이어읽기 정보를 새로 불러와 주세요.') {
  return code ? relayErrors[code] ?? fallback : fallback;
}
