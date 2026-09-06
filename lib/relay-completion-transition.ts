export type RelayCompletionState = {
  status: 'in_progress' | 'completed';
  currentTurnIndex: number;
  completedAt: number | null;
  turns: Array<{ turnIndex: number; memberKey: string; completedAt: number | null }>;
};

export function applyRelayTurnCompletion(
  state: RelayCompletionState,
  command: { turnIndex: number; memberKey: string; now: number },
) {
  const turn = state.turns.find((item) => item.turnIndex === command.turnIndex);
  if (turn?.completedAt !== null && turn?.memberKey === command.memberKey) return { state, applied: false, idempotent: true };
  if (state.status !== 'in_progress' || state.currentTurnIndex !== command.turnIndex || turn?.memberKey !== command.memberKey) {
    return { state, applied: false, idempotent: false };
  }
  const lastTurnIndex = state.turns.at(-1)?.turnIndex ?? 0;
  const last = command.turnIndex === lastTurnIndex;
  return {
    applied: true,
    idempotent: false,
    state: {
      status: last ? 'completed' as const : 'in_progress' as const,
      currentTurnIndex: last ? state.currentTurnIndex : state.currentTurnIndex + 1,
      completedAt: last ? command.now : state.completedAt,
      turns: state.turns.map((item) => item.turnIndex === command.turnIndex ? { ...item, completedAt: command.now } : item),
    },
  };
}
