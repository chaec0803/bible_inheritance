'use client';

import { Gift, Sparkles, X } from 'lucide-react';
import { describeGiftArrivals, type GiftArrival } from '@/lib/gift-arrival';

export function GiftArrivalModal({
  arrivals,
  acknowledging,
  onDismiss,
  onOpen,
}: {
  arrivals: GiftArrival[];
  acknowledging: boolean;
  onDismiss: () => void;
  onOpen: () => void;
}) {
  const multiple = arrivals.length > 1;
  return (
    <div className="gift-arrival-backdrop" role="presentation">
      <dialog className="gift-arrival-modal" open aria-labelledby="gift-arrival-title">
        <button className="gift-arrival-close" type="button" aria-label="선물 도착 안내 닫기" onClick={onDismiss} disabled={acknowledging}>
          <X size={20} />
        </button>
        <div className="gift-arrival-illustration" aria-hidden="true">
          <span><Gift size={38} /></span>
          <Sparkles className="gift-arrival-sparkle one" size={18} />
          <Sparkles className="gift-arrival-sparkle two" size={14} />
        </div>
        <p className="eyebrow">A VOICE GIFT FOR YOU</p>
        <h2 id="gift-arrival-title">새로운 말씀 선물이 도착했어요</h2>
        <p>{describeGiftArrivals(arrivals)}</p>
        {multiple && <small>선물함에서 하나씩 천천히 열어볼 수 있어요.</small>}
        <button className="gift-arrival-open" type="button" onClick={onOpen} disabled={acknowledging}>
          <Gift size={18} /> {acknowledging ? '선물함 여는 중' : multiple ? '선물함에서 확인하기' : '선물 열어보기'}
        </button>
      </dialog>
    </div>
  );
}
