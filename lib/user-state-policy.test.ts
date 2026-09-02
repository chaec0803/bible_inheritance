import { describe, expect, it } from 'vitest';
import { recoverJourneyProjects } from './user-state-policy';

const faith = { id: 'theme-믿음-7', title: '믿음을 따라 걷는 1주', duration: 7, scope: '믿음', tasks: ['창세기 15장 1–6절'] };

describe('계정 여정 복구 정책', () => {
  it('상태 행이 사라져도 녹음 메타데이터로 진행 중인 일일 여정을 복구한다', () => {
    const recordings = Array.from({ length: 6 }, (_, index) => ({ projectId: faith.id, book: '창세기', chapter: 15, verse: index + 1 }));
    expect(recoverJourneyProjects(recordings, [faith], [], '2026-09-03')).toEqual([{
      id: faith.id,
      title: faith.title,
      duration: 7,
      scope: faith.scope,
      tasks: faith.tasks,
      kind: 'guided',
      startedOn: '2026-09-03',
      readingDay: 1,
      readingDayDate: '2026-09-03',
    }]);
  });

  it('여러 절이 있어도 같은 여정을 중복 생성하지 않는다', () => {
    const recordings = [1, 2, 3].map((verse) => ({ projectId: faith.id, book: '창세기', chapter: 15, verse }));
    expect(recoverJourneyProjects(recordings, [faith], [], '2026-09-03')).toHaveLength(1);
  });

  it('자유 녹음도 성경별 하나의 여정으로 복구한다', () => {
    const recordings = [1, 4].map((verse) => ({ projectId: 'free-시', book: '시편', chapter: 23, verse }));
    const [project] = recoverJourneyProjects(recordings, [], [{ code: '시', name: '시편' }], '2026-09-03');
    expect(project).toMatchObject({ id: 'free-시', title: '시편 녹음', kind: 'free', passage: { endVerse: 4 } });
  });

  it('알 수 없는 프로젝트 녹음은 임의의 일일 여정으로 만들지 않는다', () => {
    expect(recoverJourneyProjects([{ projectId: 'unknown', book: '창세기', chapter: 1, verse: 1 }], [faith], [], '2026-09-03')).toEqual([]);
  });
});
