'use client';

import { useEffect, useState } from 'react';
import { Check, Gift, LoaderCircle, Music2, Send, Users, X } from 'lucide-react';
import { GIFT_BGM_CATALOG, type GiftBgmId } from '@/lib/gift-policy';
import type { GiftLetterInput } from '@/lib/gift-letter';
import { GiftLetterComposer } from './gift-letter-composer';

type FriendPerson = { userId: string; nickname: string; emailHint: string };
type FriendsPayload = { friends: FriendPerson[]; error?: string };

type GiftSendDialogProps = {
  title: string;
  recordingIds: string[];
  bgmId: string;
  bgmName: string;
  bgmVolume: number;
  onClose: () => void;
  onSent: (nickname: string, title: string) => void;
};

export function GiftSendDialog({ title, recordingIds, bgmId, bgmVolume, onClose, onSent }: GiftSendDialogProps) {
  const [giftTitle, setGiftTitle] = useState(title);
  const [selectedBgmId, setSelectedBgmId] = useState<GiftBgmId>(
    bgmId in GIFT_BGM_CATALOG ? bgmId as GiftBgmId : 'none',
  );
  const [selectedBgmVolume, setSelectedBgmVolume] = useState(bgmVolume);
  const [friends, setFriends] = useState<FriendPerson[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [letter, setLetter] = useState<GiftLetterInput>({ type: 'none' });

  useEffect(() => {
    let active = true;
    void fetch('/api/friends')
      .then(async (response) => {
        const payload = await response.json() as FriendsPayload;
        if (!response.ok) throw new Error(payload.error ?? '친구 목록을 불러오지 못했어요.');
        if (active) setFriends(payload.friends);
      })
      .catch((error: Error) => active && setMessage(error.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const selectedFriends = selectedUserIds.map((id) => friends.find((friend) => friend.userId === id)).filter((friend): friend is FriendPerson => Boolean(friend));

  const sendGift = async () => {
    if (!selectedFriends.length || sending) return;
    setSending(true);
    setMessage('');
    try {
      const response = await fetch('/api/gifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientUserIds: selectedFriends.map((friend) => friend.userId), recordingIds, title: giftTitle.trim(), bgmId: selectedBgmId, bgmVolume: selectedBgmVolume, letter: letter.type === 'text' && !letter.text.trim() ? { type: 'none' } : letter }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? '선물을 보내지 못했어요.');
      onSent(selectedFriends.length === 1 ? selectedFriends[0].nickname : `${selectedFriends.length}명의 친구`, giftTitle.trim());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '선물을 보내지 못했어요.');
      setSending(false);
    }
  };

  return (
    <div className="gift-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !sending) onClose(); }}>
      <dialog className="gift-dialog" open aria-labelledby="gift-dialog-title">
        <button className="gift-dialog-close" type="button" onClick={onClose} disabled={sending} aria-label="선물하기 닫기"><X size={21} /></button>
        <span className="gift-dialog-icon"><Gift size={27} /></span>
        <p className="eyebrow">GIFT A RECORDING</p>
        <h2 id="gift-dialog-title">누구에게 선물할까요?</h2>
        <label className="gift-title-field">
          <span>선물 이름</span>
          <input value={giftTitle} maxLength={80} onChange={(event) => setGiftTitle(event.currentTarget.value)} placeholder="선물 이름을 지어 주세요" disabled={sending} />
        </label>
        <div className="gift-dialog-summary">
          <span>{recordingIds.length}개 녹음</span>
          <span><Music2 size={13} /> {GIFT_BGM_CATALOG[selectedBgmId].name} · {selectedBgmVolume}%</span>
        </div>
        <label className="gift-title-field">
          <span>선물 BGM</span>
          <select value={selectedBgmId} disabled={sending} onChange={(event) => setSelectedBgmId(event.currentTarget.value as GiftBgmId)}>
            {Object.entries(GIFT_BGM_CATALOG).map(([id, track]) => <option value={id} key={id}>{track.name}</option>)}
          </select>
        </label>
        <div className="gift-dialog-volume">
          <span>BGM 음량 <strong>{selectedBgmVolume}%</strong></span>
          <div>
            <button type="button" aria-label="BGM 음량 낮추기" disabled={sending || selectedBgmVolume === 0} onClick={() => setSelectedBgmVolume((current) => Math.max(0, current - 5))}>−</button>
            <input type="range" min="0" max="100" step="1" value={selectedBgmVolume} disabled={sending} aria-label="선물 BGM 음량" onChange={(event) => setSelectedBgmVolume(Number(event.currentTarget.value))} />
            <button type="button" aria-label="BGM 음량 높이기" disabled={sending || selectedBgmVolume === 100} onClick={() => setSelectedBgmVolume((current) => Math.min(100, current + 5))}>+</button>
          </div>
        </div>

        <GiftLetterComposer value={letter} disabled={sending} onChange={setLetter} />

        {selectedFriends.length > 0 && <div className="gift-selected-friends" aria-label={`선택한 친구 ${selectedFriends.length}명`}><strong>선택 {selectedFriends.length}</strong><div>{selectedFriends.map((friend) => <button type="button" disabled={sending} onClick={() => setSelectedUserIds((current) => current.filter((id) => id !== friend.userId))} key={friend.userId}><span>{friend.nickname.slice(0, 1)}</span>{friend.nickname}<X size={13} /></button>)}</div></div>}

        {loading ? <div className="gift-friend-state"><LoaderCircle className="spin" size={25} /><strong>친구를 불러오고 있어요</strong></div> : friends.length ? (
          <div className="gift-friend-list" aria-label="선물을 받을 친구">
            {friends.map((friend) => {
              const selected = selectedUserIds.includes(friend.userId);
              return <button className={selected ? 'selected' : ''} type="button" aria-pressed={selected} disabled={sending} onClick={() => setSelectedUserIds((current) => selected ? current.filter((id) => id !== friend.userId) : [...current, friend.userId])} key={friend.userId}><span>{friend.nickname.slice(0, 1)}</span><div><strong>{friend.nickname}</strong><small>{friend.emailHint}</small></div>{selected && <Check size={18} />}</button>;
            })}
          </div>
        ) : <div className="gift-friend-state"><Users size={27} /><strong>선물할 친구가 아직 없어요</strong><p>친구 탭에서 먼저 친구 요청을 주고받아 주세요.</p></div>}

        {message && <output className="gift-message" aria-live="polite">{message}</output>}
        <button className="gift-send-confirm" type="button" disabled={!selectedFriends.length || !giftTitle.trim() || sending} onClick={() => void sendGift()}>{sending ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}{sending ? `${selectedFriends.length}개의 선물 포장 중` : selectedFriends.length ? `${selectedFriends.length}명에게 보내기` : '친구를 선택해 주세요'}</button>
      </dialog>
    </div>
  );
}
