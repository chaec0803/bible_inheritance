export type GiftArrival = {
  id: string;
  senderNickname: string;
  createdAt: number;
};

export function mergeGiftArrivals(current: GiftArrival[], incoming: GiftArrival[]) {
  const byId = new Map(current.map((gift) => [gift.id, gift]));
  incoming.forEach((gift) => byId.set(gift.id, gift));
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
}

export function describeGiftArrivals(arrivals: GiftArrival[]) {
  const senders = [...new Set(arrivals.map((gift) => gift.senderNickname))];
  if (arrivals.length === 1) return `${senders[0]}님이 목소리로 담은 말씀을 보냈어요.`;
  if (senders.length === 1) return `${senders[0]}님에게 새로운 말씀 선물 ${arrivals.length}개가 도착했어요.`;
  return `${senders[0]}님 외 ${senders.length - 1}명에게 말씀 선물 ${arrivals.length}개가 도착했어요.`;
}

export function canShowGiftArrival(arrivals: GiftArrival[], blocked: boolean) {
  return arrivals.length > 0 && !blocked;
}
