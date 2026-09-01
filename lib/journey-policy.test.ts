import { describe, expect, it } from 'vitest';
import { getJourneyRecordingIds, getRequiredJourneyReferences, isJourneyCompleted, removeJourney, restoreJourney, splitOngoingJourneys } from './journey-policy';

describe('매일 말씀 읽기 그만하기', () => {
  it('선택한 여정의 녹음만 삭제 대상으로 정한다', () => {
    const recordings = [
      { id: 'a', projectId: 'james' },
      { id: 'b', projectId: 'james' },
      { id: 'c', projectId: 'matthew' },
    ];
    expect(getJourneyRecordingIds(recordings, 'james')).toEqual(['a', 'b']);
  });

  it('선택한 여정만 내 말씀 여정에서 제거한다', () => {
    const journeys = [{ id: 'james', title: '야고보서' }, { id: 'matthew', title: '마태복음' }];
    expect(removeJourney(journeys, 'james')).toEqual([{ id: 'matthew', title: '마태복음' }]);
  });

  it('다른 여정이 있어도 저장된 매일 말씀 읽기 여정을 복원한다', () => {
    const freeJourney = { id: 'free-psa', kind: 'free' };
    const guidedJourney = { id: 'james', kind: 'guided' };
    expect(restoreJourney([freeJourney], guidedJourney)).toEqual([freeJourney, guidedJourney]);
  });

  it('그만한 여정은 활성 목록에서 빠져 다시 시작할 수 있다', () => {
    const activeJourneys = removeJourney([{ id: 'james' }, { id: 'matthew' }], 'james');
    expect(new Set(activeJourneys.map((journey) => journey.id)).has('james')).toBe(false);
  });

  it('이미 복원된 여정은 중복해서 추가하지 않는다', () => {
    const journey = { id: 'james' };
    expect(restoreJourney([journey], journey)).toEqual([journey]);
  });

  it('여정의 모든 녹음 대상 절을 기록했을 때만 완료로 분류한다', () => {
    const required = getRequiredJourneyReferences(
      ['야고보서 1장 1–2절', '야고보서 1장 3–4절', '전체 확인하고 완성하기'],
      { 야고보서: [4] },
    );
    expect(isJourneyCompleted(required, new Set(['야고보서-1-1', '야고보서-1-2', '야고보서-1-3']))).toBe(false);
    expect(isJourneyCompleted(required, new Set(['야고보서-1-1', '야고보서-1-2', '야고보서-1-3', '야고보서-1-4']))).toBe(true);
  });

  it('여러 장에 걸친 하루 분량의 중간 장 전체 절도 완료 대상에 포함한다', () => {
    const required = getRequiredJourneyReferences(['창세기 1장 1절 ~ 3장 2절'], { 창세기: [2, 3, 2] });
    expect([...required]).toEqual([
      '창세기-1-1', '창세기-1-2',
      '창세기-2-1', '창세기-2-2', '창세기-2-3',
      '창세기-3-1', '창세기-3-2',
    ]);
  });

  it('같은 성경책이어도 매일 읽기와 자유 읽기를 서로 다른 여정으로 분리한다', () => {
    const daily = { id: 'daily-matthew', kind: 'guided' as const, book: '마태복음' };
    const free = { id: 'free-MAT', kind: 'free' as const, book: '마태복음' };
    expect(splitOngoingJourneys([daily, free])).toEqual({ guided: [daily], free: [free] });
    expect(getJourneyRecordingIds([
      { id: 'daily-audio', projectId: daily.id },
      { id: 'free-audio', projectId: free.id },
    ], daily.id)).toEqual(['daily-audio']);
  });
});
