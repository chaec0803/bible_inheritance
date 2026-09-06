import { describe, expect, it } from 'vitest';
import { applyRelayTurnCompletion, type RelayCompletionState } from './relay-completion-transition';

function state(lastTurnIndex = 1): RelayCompletionState {
  return { status: 'in_progress', currentTurnIndex: 0, completedAt: null, turns: Array.from({ length: lastTurnIndex + 1 }, (_, turnIndex) => ({ turnIndex, memberKey: turnIndex ? 'b' : 'a', completedAt: null })) };
}

describe('이어읽기 완료 명령 idempotency 저장 상태', () => {
  it('같은 일반 turn 완료를 두 번 적용해도 index가 한 번만 증가한다', () => {
    const once = applyRelayTurnCompletion(state(), { turnIndex: 0, memberKey: 'a', now: 10 });
    const twice = applyRelayTurnCompletion(once.state, { turnIndex: 0, memberKey: 'a', now: 20 });
    expect(twice.idempotent).toBe(true);
    expect(twice.state.currentTurnIndex).toBe(1);
    expect(twice.state.turns).toEqual([{ turnIndex: 0, memberKey: 'a', completedAt: 10 }, { turnIndex: 1, memberKey: 'b', completedAt: null }]);
  });

  it('마지막 turn 완료를 두 번 적용해도 한 번만 COMPLETED가 된다', () => {
    const once = applyRelayTurnCompletion(state(0), { turnIndex: 0, memberKey: 'a', now: 10 });
    const twice = applyRelayTurnCompletion(once.state, { turnIndex: 0, memberKey: 'a', now: 20 });
    expect(twice.state).toMatchObject({ status: 'completed', currentTurnIndex: 0, completedAt: 10 });
    expect(twice.state.turns[0].completedAt).toBe(10);
  });

  it('stale 또는 다른 담당자의 명령은 저장 상태를 바꾸지 않는다', () => {
    const initial = state();
    expect(applyRelayTurnCompletion(initial, { turnIndex: 1, memberKey: 'b', now: 10 }).state).toBe(initial);
    expect(applyRelayTurnCompletion(initial, { turnIndex: 0, memberKey: 'creator', now: 10 }).state).toBe(initial);
  });
});
