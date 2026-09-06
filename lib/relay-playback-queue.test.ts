import { describe, expect, it } from 'vitest';
import { buildRelayPlaybackQueue, type RelayPlaybackRow } from './relay-playback-queue';

const passages = (startVerse: number, endVerse = startVerse) => JSON.stringify([
  { name: '창세기', chapter: 1, startVerse, endVerse },
]);

const row = (id: string, turnIndex: number, ownerNickname: string, verse: number, overrides: Partial<RelayPlaybackRow> = {}): RelayPlaybackRow => ({
  id,
  turnIndex,
  ownerNickname,
  book: '창세기',
  chapter: 1,
  verse,
  verseText: `${verse}절`,
  bgmId: 'none',
  durationSeconds: 2,
  passagesJson: passages(verse),
  ...overrides,
});

describe('이어읽기 progress playback queue', () => {
  it('여러 참여자의 완료 turn을 turn 순서와 각 turn의 말씀 순서로 섞는다', () => {
    const queue = buildRelayPlaybackQueue({ status: 'in_progress', currentTurnIndex: 2, rows: [
      row('b2', 1, 'B', 4, { passagesJson: passages(3, 4) }),
      row('a2', 0, 'A', 2, { passagesJson: passages(1, 2) }),
      row('b1', 1, 'B', 3, { passagesJson: passages(3, 4) }),
      row('a1', 0, 'A', 1, { passagesJson: passages(1, 2) }),
    ] });
    expect(queue.map((item) => item.id)).toEqual(['a1', 'a2', 'b1', 'b2']);
    expect(queue.map((item) => item.ownerNickname)).toEqual(['A', 'A', 'B', 'B']);
  });

  it('현재 진행 turn의 저장된 절만 포함하고 아직 없는 절은 만들지 않는다', () => {
    const queue = buildRelayPlaybackQueue({ status: 'in_progress', currentTurnIndex: 1, rows: [
      row('a1', 0, 'A', 1),
      row('b1', 1, 'B', 2, { passagesJson: passages(2, 3) }),
    ] });
    expect(queue.map((item) => item.id)).toEqual(['a1', 'b1']);
  });

  it('future turn과 배정 범위 밖 녹음은 제외한다', () => {
    const queue = buildRelayPlaybackQueue({ status: 'in_progress', currentTurnIndex: 1, rows: [
      row('current', 1, 'B', 2),
      row('future', 2, 'C', 3),
      row('invalid', 1, 'B', 99, { passagesJson: passages(2, 3) }),
    ] });
    expect(queue.map((item) => item.id)).toEqual(['current']);
  });

  it('COMPLETED 프로젝트도 같은 queue 규칙으로 전체 turn을 반환한다', () => {
    const queue = buildRelayPlaybackQueue({ status: 'completed', currentTurnIndex: null, rows: [
      row('last', 2, 'A', 3), row('first', 0, 'A', 1), row('middle', 1, 'B', 2),
    ] });
    expect(queue.map((item) => item.id)).toEqual(['first', 'middle', 'last']);
  });
});
