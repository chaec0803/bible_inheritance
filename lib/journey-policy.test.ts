import { describe, expect, it } from 'vitest';
import { getJourneyRecordingIds, removeJourney } from './journey-policy';

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
});
