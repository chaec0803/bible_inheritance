import { describe, expect, it } from 'vitest';
import { getJourneyRecordingIds, removeJourney, restoreJourney } from './journey-policy';

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
});
