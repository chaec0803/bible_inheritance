export type WordCardAward = {
  key: string;
  cardId: string;
  completionSignature?: string;
  presented: boolean;
  collected: boolean;
  claimed?: boolean;
};

type DailyAwardInput = {
  projectId: string;
  day: number;
  completionSignature: string;
  cardIds: readonly string[];
};

export function createDailyAward(
  awards: readonly WordCardAward[],
  input: DailyAwardInput,
  random: () => number = Math.random,
) {
  const key = `${input.projectId}:day-${input.day}`;
  const existing = awards.find((award) => award.key === key);
  if (existing || input.cardIds.length === 0) return { awards: [...awards], award: existing ?? null, created: false };

  const ownedIds = new Set(awards.map((award) => award.cardId));
  const unseenIds = input.cardIds.filter((cardId) => !ownedIds.has(cardId));
  const pool = unseenIds.length ? unseenIds : [...input.cardIds];
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)));
  const award: WordCardAward = {
    key,
    cardId: pool[index],
    completionSignature: input.completionSignature,
    presented: true,
    collected: false,
  };
  return { awards: [...awards, award], award, created: true };
}

export function collectWordCardAward(awards: readonly WordCardAward[], awardKey: string, cardId: string) {
  return awards.map((award) => award.key === awardKey && award.cardId === cardId
    ? { ...award, presented: true, collected: true }
    : award);
}
