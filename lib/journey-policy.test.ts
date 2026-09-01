import { describe, expect, it } from 'vitest';
import { getJourneyRecordingIds, isJourneyVisible, removeJourney } from './journey-policy';

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

  it('녹음본을 모두 지워도 매일 말씀 읽기 여정은 계속 보인다', () => {
    expect(isJourneyVisible({ kind: 'guided' }, false)).toBe(true);
    expect(isJourneyVisible({}, false)).toBe(true);
  });

  it('그만한 여정은 활성 목록에서 빠져 다시 시작할 수 있다', () => {
    const activeJourneys = removeJourney([{ id: 'james' }, { id: 'matthew' }], 'james');
    expect(new Set(activeJourneys.map((journey) => journey.id)).has('james')).toBe(false);
  });

  it('자유 녹음 여정은 녹음본이 없으면 목록에서 정리한다', () => {
    expect(isJourneyVisible({ kind: 'free' }, false)).toBe(false);
    expect(isJourneyVisible({ kind: 'free' }, true)).toBe(true);
  });
});
