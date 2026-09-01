import { describe, expect, it } from 'vitest';
import { collectWordCardAward, createDailyAward, type WordCardAward } from './reward-policy';

const input = { projectId: 'james', day: 1, completionSignature: '약-1-1-5', cardIds: ['david', 'mary', 'peter'] };

describe('말씀카드 보상 정책', () => {
  it('매일 말씀 분량 완료 시 미수령 카드 한 장을 만든다', () => {
    const result = createDailyAward([], input, () => 0);
    expect(result.created).toBe(true);
    expect(result.award).toMatchObject({ key: 'james:day-1', cardId: 'david', presented: true, collected: false });
  });

  it('같은 여정의 같은 일차에는 중복 지급하지 않는다', () => {
    const first = createDailyAward([], input, () => 0);
    const second = createDailyAward(first.awards, input, () => 0.9);
    expect(second.created).toBe(false);
    expect(second.awards).toHaveLength(1);
    expect(second.award?.cardId).toBe('david');
  });

  it('아직 받지 않은 카드를 우선 지급한다', () => {
    const existing: WordCardAward[] = [{ key: 'james:day-1', cardId: 'david', presented: true, collected: true }];
    const result = createDailyAward(existing, { ...input, day: 2 }, () => 0);
    expect(result.award?.cardId).toBe('mary');
  });

  it('모든 카드를 받은 뒤에는 전체 카드 풀을 다시 사용한다', () => {
    const existing: WordCardAward[] = input.cardIds.map((cardId, index) => ({ key: `james:day-${index + 1}`, cardId, presented: true, collected: true }));
    const result = createDailyAward(existing, { ...input, day: 4 }, () => 0);
    expect(result.award?.cardId).toBe('david');
  });

  it('간직하기를 누르면 해당 카드만 수집 상태가 된다', () => {
    const awards: WordCardAward[] = [
      { key: 'james:day-1', cardId: 'david', presented: true, collected: false },
      { key: 'james:day-2', cardId: 'mary', presented: true, collected: false },
    ];
    expect(collectWordCardAward(awards, 'james:day-1', 'david')).toEqual([
      { ...awards[0], collected: true },
      awards[1],
    ]);
  });
});
