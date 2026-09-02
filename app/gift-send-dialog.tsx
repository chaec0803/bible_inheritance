'use client';

import { useEffect, useState } from 'react';
import { Check, Gift, LoaderCircle, Music2, Send, Users, X } from 'lucide-react';

type FriendPerson = { userId: string; nickname: string; emailHint: string };
type FriendsPayload = { friends: FriendPerson[]; error?: string };

type GiftSendDialogProps = {
  title: string;
  recordingIds: string[];
  bgmId: string;
  bgmName: string;
  bgmVolume: number;
  onClose: () => void;
  onSent: (nickname: string) => void;
};

export function GiftSendDialog({ title, recordingIds, bgmId, bgmName, bgmVolume, onClose, onSent }: GiftSendDialogProps) {
  const [friends, setFriends] = useState<FriendPerson[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

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

  const selectedFriend = friends.find((friend) => friend.userId === selectedUserId) ?? null;

  const sendGift = async () => {
    if (!selectedFriend || sending) return;
    setSending(true);
    setMessage('');
    try {
      const response = await fetch('/api/gifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientUserId: selectedFriend.userId, recordingIds, title, bgmId, bgmVolume }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? '선물을 보내지 못했어요.');
      onSent(selectedFriend.nickname);
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
        <div className="gift-dialog-summary">
          <strong>{title}</strong>
          <span>{recordingIds.length}개 녹음</span>
          <span><Music2 size={13} /> {bgmName} · {bgmVolume}%</span>
        </div>

        {loading ? <div className="gift-friend-state"><LoaderCircle className="spin" size={25} /><strong>친구를 불러오고 있어요</strong></div> : friends.length ? (
          <div className="gift-friend-list" aria-label="선물을 받을 친구">
            {friends.map((friend) => {
              const selected = friend.userId === selectedUserId;
              return <button className={selected ? 'selected' : ''} type="button" aria-pressed={selected} disabled={sending} onClick={() => setSelectedUserId(friend.userId)} key={friend.userId}><span>{friend.nickname.slice(0, 1)}</span><div><strong>{friend.nickname}</strong><small>{friend.emailHint}</small></div>{selected && <Check size={18} />}</button>;
            })}
          </div>
        ) : <div className="gift-friend-state"><Users size={27} /><strong>선물할 친구가 아직 없어요</strong><p>친구 탭에서 먼저 친구 요청을 주고받아 주세요.</p></div>}

        {message && <output className="gift-message" aria-live="polite">{message}</output>}
        <button className="gift-send-confirm" type="button" disabled={!selectedFriend || sending} onClick={() => void sendGift()}>{sending ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}{sending ? '선물 포장 중' : selectedFriend ? `${selectedFriend.nickname}님에게 보내기` : '친구를 선택해 주세요'}</button>
      </dialog>
    </div>
  );
}
