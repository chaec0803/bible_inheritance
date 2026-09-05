'use client';

import { Gift, Play, Trash2 } from 'lucide-react';

export type InProgressGift = {
  id: string;
  title: string;
  recipientNickname?: string;
  nextPosition: number | null;
  items: Array<{ recorded: boolean }>;
};

export function InProgressGifts({ gifts, activeGiftId, onResume, onDelete }: {
  gifts: InProgressGift[];
  activeGiftId: string | null;
  onResume: (gift: InProgressGift) => void;
  onDelete: (gift: InProgressGift) => void;
}) {
  if (!gifts.length) return null;
  return <section className="in-progress-gifts" aria-labelledby="in-progress-gifts-title">
    <div className="in-progress-gifts-heading"><span><Gift size={16} /></span><div><p className="eyebrow">IN PROGRESS</p><h2 id="in-progress-gifts-title">진행 중인 선물</h2></div><strong>{gifts.length}</strong></div>
    <div className="in-progress-gift-list">
      {gifts.map((gift) => {
        const recorded = gift.items.filter((item) => item.recorded).length;
        const active = gift.id === activeGiftId;
        return <article className={active ? 'active' : ''} key={gift.id}>
          <button type="button" onClick={() => onResume(gift)}><span><Play size={14} /></span><div><strong>{gift.title}</strong><small>{gift.recipientNickname ? `${gift.recipientNickname}님에게 · ` : ''}{recorded}/{gift.items.length}절 녹음{active ? ' · 지금 만드는 중' : ' · 이어서 만들기'}</small></div></button>
          <button className="draft-delete" type="button" title="진행 중인 선물 삭제" aria-label={`${gift.title} 진행 중인 선물 삭제`} onClick={() => onDelete(gift)}><Trash2 size={15} /></button>
        </article>;
      })}
    </div>
  </section>;
}
