import { describe, expect, it } from 'vitest';
import {
  getRelayRecordingProjectId,
  inspectRelayTurnRecordings,
  parseRelayRecordingProjectId,
  type RelayRecordingRow,
} from './relay-recording-completeness';

const passages = [{ code: '창', name: '창세기', chapter: 1, startVerse: 1, endVerse: 5 }];
const projectId = 'relay-1';
const turnIndex = 2;
const memberKey = 'member-a';
const contextProjectId = 'relay:relay-1:turn:2';

function recording(verse: number, overrides: Partial<RelayRecordingRow> = {}): RelayRecordingRow {
  return {
    ownerKey: memberKey,
    projectId: contextProjectId,
    book: '창세기',
    chapter: 1,
    verse,
    ...overrides,
  };
}

function inspect(rows: RelayRecordingRow[]) {
  return inspectRelayTurnRecordings({ projectId, turnIndex, memberKey, passages, recordings: rows });
}

describe('이어읽기 turn 녹음 완성도', () => {
  it('relay project/turn을 일반 녹음과 충돌하지 않는 고정 context로 만든다', () => {
    expect(getRelayRecordingProjectId(projectId, turnIndex)).toBe(contextProjectId);
  });

  it('정확한 relay context만 project와 turn으로 파싱한다', () => {
    expect(parseRelayRecordingProjectId('relay:project-1:turn:0')).toEqual({ kind: 'relay', projectId: 'project-1', turnIndex: 0 });
    expect(parseRelayRecordingProjectId('free-recording')).toEqual({ kind: 'standard' });
  });

  it.each(['relay:', 'relay:abc', 'relay:abc:turn:', 'relay:abc:turn:-1', 'relay:abc:turn:foo', 'relay:abc:turn:1:extra'])('%s malformed relay context를 일반 녹음으로 fallback하지 않는다', (value) => {
    expect(parseRelayRecordingProjectId(value)).toEqual({ kind: 'malformed' });
  });

  it.each([0, 1, 4])('%i/5절 녹음은 incomplete다', (count) => {
    const result = inspect(Array.from({ length: count }, (_, index) => recording(index + 1)));
    expect(result).toMatchObject({ complete: false, requiredCount: 5, recordedCount: count });
  });

  it('배정된 모든 절이 실제 존재할 때만 complete다', () => {
    expect(inspect([1, 2, 3, 4, 5].map((verse) => recording(verse)))).toEqual({
      complete: true,
      requiredCount: 5,
      recordedCount: 5,
      missingReferences: [],
    });
  });

  it('다른 member의 동일 절 녹음을 인정하지 않는다', () => {
    const rows = [1, 2, 3, 4, 5].map((verse) => recording(verse, { ownerKey: 'member-b' }));
    expect(inspect(rows).complete).toBe(false);
  });

  it('다른 relay project나 다른 turn의 동일 절 녹음을 인정하지 않는다', () => {
    const otherProject = [1, 2, 3, 4, 5].map((verse) => recording(verse, { projectId: 'relay:other:turn:2' }));
    const otherTurn = [1, 2, 3, 4, 5].map((verse) => recording(verse, { projectId: 'relay:relay-1:turn:1' }));
    expect(inspect(otherProject).complete).toBe(false);
    expect(inspect(otherTurn).complete).toBe(false);
  });

  it('배정 외 녹음이 많아도 누락 절이 있으면 incomplete다', () => {
    const rows = [1, 2, 3, 4].map((verse) => recording(verse));
    rows.push(...Array.from({ length: 10 }, (_, index) => recording(20 + index)));
    expect(inspect(rows)).toMatchObject({ complete: false, recordedCount: 4, missingReferences: ['창세기-1-5'] });
  });

  it('같은 절 중복 녹음으로 누락된 다른 절을 대신할 수 없다', () => {
    expect(inspect([recording(1), recording(1), recording(1), recording(2), recording(3), recording(4)])).toMatchObject({
      complete: false,
      recordedCount: 4,
      missingReferences: ['창세기-1-5'],
    });
  });

  it('일반 recording은 동일 말씀이어도 relay 완료에 사용하지 않는다', () => {
    const rows = [1, 2, 3, 4, 5].map((verse) => recording(verse, { projectId: 'free-recording' }));
    expect(inspect(rows).complete).toBe(false);
  });

  it('여러 장에 걸친 배정 범위도 모든 실제 절을 비교한다', () => {
    const result = inspectRelayTurnRecordings({
      projectId,
      turnIndex,
      memberKey,
      passages: [
        { code: '창', name: '창세기', chapter: 1, startVerse: 30, endVerse: 31 },
        { code: '창', name: '창세기', chapter: 2, startVerse: 1, endVerse: 2 },
      ],
      recordings: [
        recording(30), recording(31),
        recording(1, { chapter: 2 }), recording(2, { chapter: 2 }),
      ],
    });
    expect(result.complete).toBe(true);
  });
});
