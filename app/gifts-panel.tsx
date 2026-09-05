'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, CircleStop, Download, Gift, Headphones, List, LoaderCircle, MessageCircle, Music2, Pause, Play, Send, Trash2, Volume2, X } from 'lucide-react';
import { GIFT_BGM_CATALOG, type GiftBgmId } from '@/lib/gift-policy';
import { THANK_YOU_TEMPLATES } from '@/lib/gift-thank-you';
import { toAudibleBgmGain } from '@/lib/audio-volume';

type GiftRecording = {
  id: string;
  position: number;
  book: string;
  chapter: number;
  verse: number;
  verseText: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number;
};

type ReceivedGift = {
  id: string;
  title: string;
  senderNickname: string;
  bgmId: GiftBgmId;
  bgmVolume: number;
  recordingCount: number;
  totalSizeBytes: number;
  createdAt: number;
  openedAt: number | null;
  thankYouNote: string | null;
  thankedAt: number | null;
  hasLetter: boolean;
  letterType: 'text' | 'voice' | null;
  letterOpenedAt: number | null;
  letterText: string | null;
  letterMimeType: string | null;
  letterDurationSeconds: number | null;
  recordings: GiftRecording[];
};

type SentGift = {
  id: string;
  title: string;
  recipientNickname: string;
  bgmId: GiftBgmId;
  bgmVolume: number;
  recordingCount: number;
  totalSizeBytes: number;
  createdAt: number;
  openedAt: number | null;
  thankYouNote: string | null;
  thankedAt: number | null;
  hasLetter: boolean;
  letterType: 'text' | 'voice' | null;
};

type GiftInboxPayload = {
  gifts?: ReceivedGift[];
  sentGifts?: SentGift[];
  error?: string;
};

function formatGiftDate(timestamp: number) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(timestamp));
}

function formatGiftDateTime(timestamp: number) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp));
}

export function GiftsPanel({
  onBack,
  initialSentGiftId,
  initialReceivedGiftId,
  onInitialReceivedHandled,
}: {
  onBack: () => void;
  initialSentGiftId?: string | null;
  initialReceivedGiftId?: string | null;
  onInitialReceivedHandled?: () => void;
}) {
  const [receivedGifts, setReceivedGifts] = useState<ReceivedGift[]>([]);
  const [sentGifts, setSentGifts] = useState<SentGift[]>([]);
  const [giftBox, setGiftBox] = useState<'received' | 'sent'>(initialSentGiftId ? 'sent' : 'received');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [activeGiftId, setActiveGiftId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [openLists, setOpenLists] = useState<string[]>([]);
  const [confirmDeleteGift, setConfirmDeleteGift] = useState<ReceivedGift | null>(null);
  const [deletingGiftId, setDeletingGiftId] = useState<string | null>(null);
  const [openingGiftId, setOpeningGiftId] = useState<string | null>(null);
  const [downloadingGiftId, setDownloadingGiftId] = useState<string | null>(null);
  const [giftVolumes, setGiftVolumes] = useState<Record<string, number>>({});
  const [thankYouGift, setThankYouGift] = useState<ReceivedGift | null>(null);
  const [thankYouNote, setThankYouNote] = useState('');
  const [detailGiftId, setDetailGiftId] = useState<string | null>(null);
  const [justOpenedGiftId, setJustOpenedGiftId] = useState<string | null>(null);
  const [detailSentGiftId, setDetailSentGiftId] = useState<string | null>(initialSentGiftId ?? null);
  const [sendingThankYou, setSendingThankYou] = useState(false);
  const [openingLetterId, setOpeningLetterId] = useState<string | null>(null);
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const sentGiftsRef = useRef<SentGift[]>([]);

  const refresh = async () => {
    const response = await fetch('/api/gifts');
    const payload = await response.json() as GiftInboxPayload;
    if (!response.ok) throw new Error(payload.error ?? '선물함을 불러오지 못했어요.');
    const nextReceived = payload.gifts ?? [];
    const nextSent = payload.sentGifts ?? [];
    setReceivedGifts(nextReceived);
    setSentGifts(nextSent);
    sentGiftsRef.current = nextSent;
    setGiftVolumes((current) => {
      const next = { ...current };
      nextReceived.forEach((gift) => { next[gift.id] ??= gift.bgmVolume; });
      return next;
    });
  };

  useEffect(() => {
    let active = true;
    const voice = voiceRef.current;
    const bgmAudio = bgmRef.current;
    void fetch('/api/gifts')
      .then(async (response) => {
        const payload = await response.json() as GiftInboxPayload;
        if (!response.ok) throw new Error(payload.error ?? '선물함을 불러오지 못했어요.');
        if (active) {
          const nextReceived = payload.gifts ?? [];
          const nextSent = payload.sentGifts ?? [];
          setReceivedGifts(nextReceived);
          setSentGifts(nextSent);
          sentGiftsRef.current = nextSent;
          setGiftVolumes(Object.fromEntries(nextReceived.map((gift) => [gift.id, gift.bgmVolume])));
          if (initialReceivedGiftId && nextReceived.some((gift) => gift.id === initialReceivedGiftId)) {
            setJustOpenedGiftId(initialReceivedGiftId);
            setDetailGiftId(initialReceivedGiftId);
            setOpenLists([initialReceivedGiftId]);
          }
          if (initialReceivedGiftId) onInitialReceivedHandled?.();
        }
      })
      .catch((error: Error) => active && setMessage(error.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      voice?.pause();
      bgmAudio?.pause();
    };
  }, [initialReceivedGiftId, onInitialReceivedHandled]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(''), 4000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    if (giftBox !== 'sent') return;
    let active = true;
    const pollSentGifts = async () => {
      try {
        const response = await fetch('/api/gifts');
        const payload = await response.json() as GiftInboxPayload;
        if (!response.ok) return;
        const previousById = new Map(sentGiftsRef.current.map((gift) => [gift.id, gift]));
        const nextSent = payload.sentGifts ?? [];
        if (!active) return;
        const newlyOpened = nextSent.find((gift) => gift.openedAt !== null && previousById.get(gift.id)?.openedAt === null);
        const newlyThanked = nextSent.find((gift) => gift.thankYouNote && !previousById.get(gift.id)?.thankYouNote);
        setReceivedGifts(payload.gifts ?? []);
        setSentGifts(nextSent);
        sentGiftsRef.current = nextSent;
        if (newlyThanked) setMessage(`${newlyThanked.recipientNickname}님에게 감사 인사가 도착했어요.`);
        else if (newlyOpened) setMessage(`${newlyOpened.recipientNickname}님이 ‘${newlyOpened.title}’ 선물을 열었어요.`);
      } catch {
        // 다음 주기 또는 창 포커스 시 다시 확인합니다.
      }
    };
    const handleFocus = () => void pollSentGifts();
    const handleVisibility = () => { if (document.visibilityState === 'visible') void pollSentGifts(); };
    void pollSentGifts();
    const interval = window.setInterval(() => void pollSentGifts(), 15_000);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [giftBox]);

  const activeGift = receivedGifts.find((gift) => gift.id === activeGiftId) ?? null;
  const receivedSections = [
    { title: '방금 열어본 선물', gifts: receivedGifts.filter((gift) => gift.id === justOpenedGiftId) },
    { title: '안 열어본 선물', gifts: receivedGifts.filter((gift) => gift.openedAt === null && gift.id !== justOpenedGiftId) },
    { title: '열어본 선물', gifts: receivedGifts.filter((gift) => gift.openedAt !== null && gift.id !== justOpenedGiftId) },
  ].filter((section) => section.gifts.length);
  const activeRecording = activeGift?.recordings[activeIndex] ?? null;

  const stopPlayback = () => {
    voiceRef.current?.pause();
    if (voiceRef.current) voiceRef.current.currentTime = 0;
    bgmRef.current?.pause();
    if (bgmRef.current) bgmRef.current.currentTime = 0;
    setActiveGiftId(null);
    setActiveIndex(0);
    setPaused(false);
  };

  const playPosition = (gift: ReceivedGift, index: number, restartBgm: boolean) => {
    const voice = voiceRef.current;
    const bgmAudio = bgmRef.current;
    const recording = gift.recordings[index];
    if (!voice || !recording) return;
    setActiveGiftId(gift.id);
    setActiveIndex(index);
    setPaused(false);
    voice.src = `/api/gifts/${gift.id}/audio/${recording.position}`;
    voice.load();
    const playRequests: Promise<void>[] = [voice.play()];
    const bgm = GIFT_BGM_CATALOG[gift.bgmId] ?? GIFT_BGM_CATALOG.none;
    const selectedVolume = giftVolumes[gift.id] ?? gift.bgmVolume;
    if (bgmAudio && bgm.audioSrc) bgmAudio.volume = toAudibleBgmGain(selectedVolume);
    if (bgmAudio && bgm.audioSrc && restartBgm) {
      bgmAudio.src = bgm.audioSrc;
      bgmAudio.loop = true;
      bgmAudio.load();
      playRequests.push(bgmAudio.play());
    } else if (bgmAudio && bgm.audioSrc && bgmAudio.paused) {
      playRequests.push(bgmAudio.play());
    }
    void Promise.all(playRequests).catch(() => {
      stopPlayback();
      setMessage('선물 재생을 시작하지 못했어요. 다시 눌러 주세요.');
    });
  };

  const startPlayback = (gift: ReceivedGift) => {
    if (gift.openedAt === null) return;
    stopPlayback();
    if (!gift.recordings.length) return;
    playPosition(gift, 0, true);
  };

  const handleEnded = () => {
    if (!activeGift) return;
    const nextIndex = activeIndex + 1;
    if (!activeGift.recordings[nextIndex]) {
      const title = activeGift.title;
      stopPlayback();
      setMessage(`‘${title}’ 선물을 모두 들었어요.`);
      return;
    }
    playPosition(activeGift, nextIndex, false);
  };

  const pausePlayback = () => {
    voiceRef.current?.pause();
    bgmRef.current?.pause();
    setPaused(true);
  };

  const resumePlayback = () => {
    const requests = [voiceRef.current?.play(), bgmRef.current?.src ? bgmRef.current.play() : undefined].filter((request): request is Promise<void> => Boolean(request));
    void Promise.all(requests).then(() => setPaused(false)).catch(() => setMessage('재생을 계속하지 못했어요.'));
  };

  const openGift = async (gift: ReceivedGift) => {
    if (gift.openedAt !== null || openingGiftId) return;
    setOpeningGiftId(gift.id);
    setMessage('');
    try {
      const response = await fetch(`/api/gifts/${gift.id}/open`, { method: 'PATCH' });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? '선물을 열지 못했어요.');
      await refresh();
      setJustOpenedGiftId(gift.id);
      setDetailGiftId(gift.id);
      setOpenLists((current) => current.includes(gift.id) ? current : [...current, gift.id]);
      setMessage(`${gift.senderNickname}님의 선물을 열었어요.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '선물을 열지 못했어요.');
    } finally {
      setOpeningGiftId(null);
    }
  };

  const deleteGift = async () => {
    if (!confirmDeleteGift || deletingGiftId) return;
    const gift = confirmDeleteGift;
    setDeletingGiftId(gift.id);
    setMessage('');
    try {
      if (activeGiftId === gift.id) stopPlayback();
      const response = await fetch(`/api/gifts/${gift.id}`, { method: 'DELETE' });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? '선물을 삭제하지 못했어요.');
      await refresh();
      setConfirmDeleteGift(null);
      setMessage('선물을 삭제했어요.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '선물을 삭제하지 못했어요.');
    } finally {
      setDeletingGiftId(null);
    }
  };

  const deleteSentGift = async (gift: SentGift) => {
    if (deletingGiftId || !window.confirm(`‘${gift.title}’을(를) 보낸 선물 목록에서 삭제할까요?`)) return;
    setDeletingGiftId(gift.id);
    try {
      const response = await fetch(`/api/gifts/${gift.id}`, { method: 'DELETE' });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? '보낸 선물을 삭제하지 못했어요.');
      await refresh();
      setDetailSentGiftId(null);
      setMessage('보낸 선물 목록에서 삭제했어요. 받는 사람의 선물은 그대로 유지돼요.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '보낸 선물을 삭제하지 못했어요.');
    } finally {
      setDeletingGiftId(null);
    }
  };

  const downloadGift = async (gift: ReceivedGift) => {
    if (downloadingGiftId) return;
    setDownloadingGiftId(gift.id);
    setMessage('목소리와 BGM을 하나의 MP4로 만들고 있어요. 잠시만 기다려 주세요.');
    try {
      const bgm = GIFT_BGM_CATALOG[gift.bgmId] ?? GIFT_BGM_CATALOG.none;
      const { createGiftMp4 } = await import('@/lib/gift-mp3');
      const result = await createGiftMp4({
        title: gift.title,
        voiceUrls: gift.recordings.map((recording) => `/api/gifts/${gift.id}/audio/${recording.position}`),
        bgmUrl: bgm.audioSrc,
        bgmVolume: giftVolumes[gift.id] ?? gift.bgmVolume,
      });
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage('MP4 다운로드를 시작했어요.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'MP4 파일을 만들지 못했어요.');
    } finally {
      setDownloadingGiftId(null);
    }
  };

  const sendThankYou = async () => {
    if (!thankYouGift || !thankYouNote.trim() || sendingThankYou) return;
    setSendingThankYou(true);
    setMessage('감사 인사를 보내고 있어요.');
    try {
      const response = await fetch(`/api/gifts/${thankYouGift.id}/thank-you`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: thankYouNote }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? '감사 인사를 보내지 못했어요.');
      await refresh();
      setThankYouGift(null);
      setThankYouNote('');
      setMessage('감사 인사를 보냈어요.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '감사 인사를 보내지 못했어요.');
    } finally {
      setSendingThankYou(false);
    }
  };

  const openLetter = async (gift: ReceivedGift) => {
    if (!gift.hasLetter || openingLetterId) return;
    setOpeningLetterId(gift.id);
    setMessage('');
    try {
      const response = await fetch(`/api/gifts/${gift.id}/letter/open`, { method: 'PATCH' });
      const payload = await response.json() as { letter?: { type: 'text' | 'voice'; text: string | null; mimeType: string | null; durationSeconds: number | null; openedAt: number }; error?: string };
      if (!response.ok || !payload.letter) throw new Error(payload.error ?? '쪽지를 열지 못했어요.');
      setReceivedGifts((current) => current.map((candidate) => candidate.id === gift.id ? {
        ...candidate,
        letterOpenedAt: payload.letter!.openedAt,
        letterText: payload.letter!.text,
        letterMimeType: payload.letter!.mimeType,
        letterDurationSeconds: payload.letter!.durationSeconds,
      } : candidate));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '쪽지를 열지 못했어요.');
    } finally {
      setOpeningLetterId(null);
    }
  };

  return (
    <section className="gifts-section" aria-labelledby="gifts-title">
      <button className="section-route-back" type="button" onClick={onBack}><ChevronLeft size={17} /> 뒤로가기</button>
      <div className="gifts-heading"><div><p className="eyebrow">마음을 주고받는 말씀</p><h2 id="gifts-title">선물함</h2><p className="muted">받은 목소리를 듣거나, 내가 보낸 선물의 도착 상태를 확인해 보세요.</p></div><span><Gift size={16} /> {giftBox === 'received' ? receivedGifts.length : sentGifts.length}개</span></div>
      <div className="gift-box-tabs" role="tablist" aria-label="선물함 구분">
        <button className={giftBox === 'received' ? 'active' : ''} type="button" role="tab" aria-selected={giftBox === 'received'} onClick={() => setGiftBox('received')}>받은 선물 <span>{receivedGifts.length}</span></button>
        <button className={giftBox === 'sent' ? 'active' : ''} type="button" role="tab" aria-selected={giftBox === 'sent'} onClick={() => { stopPlayback(); setGiftBox('sent'); }}>보낸 선물 <span>{sentGifts.length}</span></button>
      </div>
      {message && <output className="gift-message gift-page-message" aria-live="polite">{message}</output>}
      {loading ? <div className="gift-empty"><LoaderCircle className="spin" size={29} /><strong>선물함을 불러오고 있어요</strong></div> : giftBox === 'received' ? receivedGifts.length === 0 ? <div className="gift-empty"><Gift size={32} /><strong>아직 도착한 선물이 없어요</strong><p>친구가 말씀 녹음을 보내면 이곳에 차곡차곡 모여요.</p></div> : (
        <div className="gift-cards">
          {receivedSections.map((section) => <section className="gift-compact-section" key={section.title}><h3>{section.title}</h3>{section.gifts.map((gift) => {
            const isActive = gift.id === activeGiftId;
            const giftBgm = GIFT_BGM_CATALOG[gift.bgmId] ?? GIFT_BGM_CATALOG.none;
            const giftVolume = giftVolumes[gift.id] ?? gift.bgmVolume;
            const listOpen = openLists.includes(gift.id);
            const unopened = gift.openedAt === null;
            const detailOpen = detailGiftId === gift.id;
            return <article className={`gift-card gift-compact-card ${isActive ? 'playing' : ''} ${unopened ? 'unopened' : ''}`} key={gift.id}>
              <button className="gift-card-header" type="button" onClick={() => unopened ? void openGift(gift) : setDetailGiftId(detailOpen ? null : gift.id)}><span><Gift size={18} /></span><div><small>{gift.senderNickname}님으로부터 · {formatGiftDate(gift.createdAt)}</small><h3>{unopened ? '새로운 말씀 선물' : gift.title}</h3></div></button>
              {unopened ? <div className="gift-unopened">
                <span><Gift size={31} /></span>
                <p>열어보기 전까지 선물 내용은 비밀이에요.</p>
                <button type="button" disabled={Boolean(openingGiftId)} onClick={() => void openGift(gift)}>{openingGiftId === gift.id ? <LoaderCircle className="spin" size={18} /> : <Gift size={18} />}{openingGiftId === gift.id ? '선물 여는 중' : '선물 열기'}</button>
              </div> : detailOpen ? <>
                <div className="gift-card-tags"><span><Headphones size={13} /> {gift.recordingCount}개 녹음</span><span><Music2 size={13} /> {giftBgm.name}</span></div>
                {gift.hasLetter && <section className={`gift-letter-envelope ${gift.letterOpenedAt ? 'opened' : ''}`}>
                  <div><MessageCircle size={20} /><span><strong>함께 온 쪽지가 있어요</strong><small>{gift.letterOpenedAt ? (gift.letterType === 'voice' ? '목소리로 전한 마음' : '글로 전한 마음') : '직접 열어보기 전까지 내용은 비밀이에요.'}</small></span></div>
                  {!gift.letterOpenedAt ? <button type="button" disabled={openingLetterId === gift.id} onClick={() => void openLetter(gift)}>{openingLetterId === gift.id ? <LoaderCircle className="spin" size={16} /> : <Gift size={16} />}{openingLetterId === gift.id ? '쪽지 여는 중' : '쪽지 열어보기'}</button> : gift.letterType === 'text' ? <blockquote>{gift.letterText}</blockquote> : <div className="gift-voice-letter">{/* oxlint-disable-next-line jsx-a11y/media-has-caption -- 사용자가 녹음한 음성 편지에는 별도 자막 파일이 없습니다. */}<audio controls src={`/api/gifts/${gift.id}/letter/audio`} /><small>{gift.letterDurationSeconds ? `${gift.letterDurationSeconds}초 음성 편지` : '음성 편지'}</small></div>}
                </section>}
                {giftBgm.audioSrc && <div className="gift-volume-control">
                  <span><Volume2 size={16} /> 선물 BGM 음량 <strong>{giftVolume}%</strong></span>
                  <div className="gift-volume-input-row">
                  <button type="button" aria-label="받은 선물 BGM 음량 낮추기" disabled={giftVolume === 0} onClick={() => {
                    const nextVolume = Math.max(0, giftVolume - 5);
                    setGiftVolumes((current) => ({ ...current, [gift.id]: nextVolume }));
                    if (activeGiftId === gift.id && bgmRef.current) bgmRef.current.volume = toAudibleBgmGain(nextVolume);
                  }}>−</button>
                  <input type="range" min="0" max="100" step="1" value={giftVolume} aria-label={`${gift.title} BGM 음량`} onChange={(event) => {
                    const nextVolume = Number(event.currentTarget.value);
                    setGiftVolumes((current) => ({ ...current, [gift.id]: nextVolume }));
                    if (activeGiftId === gift.id && bgmRef.current) bgmRef.current.volume = toAudibleBgmGain(nextVolume);
                  }} />
                  <button type="button" aria-label="받은 선물 BGM 음량 높이기" disabled={giftVolume === 100} onClick={() => {
                    const nextVolume = Math.min(100, giftVolume + 5);
                    setGiftVolumes((current) => ({ ...current, [gift.id]: nextVolume }));
                    if (activeGiftId === gift.id && bgmRef.current) bgmRef.current.volume = toAudibleBgmGain(nextVolume);
                  }}>+</button>
                  </div>
                </div>}
                {isActive && activeRecording && <div className="gift-now-playing"><small>NOW PLAYING · {activeIndex + 1}/{gift.recordings.length}</small><strong>{activeRecording.verseText}</strong><span>{activeRecording.book} {activeRecording.chapter}{activeRecording.book === '시편' ? '편' : '장'} {activeRecording.verse}절</span></div>}
                <div className="gift-primary-actions">
                  {!isActive ? <button type="button" onClick={() => startPlayback(gift)}><Play size={17} /> 이어듣기</button> : <><button type="button" onClick={paused ? resumePlayback : pausePlayback}>{paused ? <Play size={17} /> : <Pause size={17} />}{paused ? '계속 듣기' : '일시정지'}</button><button className="secondary" type="button" onClick={stopPlayback}><CircleStop size={17} /> 종료</button></>}
                </div>
                <button className="gift-list-toggle" type="button" onClick={() => setOpenLists((current) => current.includes(gift.id) ? current.filter((id) => id !== gift.id) : [...current, gift.id])} aria-expanded={listOpen}><List size={16} /> 녹음 목록 {listOpen ? '접기' : '보기'}</button>
                {listOpen && <div className="gift-recording-list">{gift.recordings.map((recording, index) => <button className={isActive && index === activeIndex ? 'playing' : ''} type="button" onClick={() => playPosition(gift, index, !isActive)} key={recording.id}><span>{recording.book} {recording.chapter}{recording.book === '시편' ? '편' : '장'} · {recording.verse}절</span><small>{isActive && index === activeIndex ? '재생 중' : '여기부터 듣기'}</small></button>)}</div>}
                <div className="gift-secondary-actions"><button className="download" type="button" disabled={Boolean(downloadingGiftId)} onClick={() => void downloadGift(gift)}>{downloadingGiftId === gift.id ? <LoaderCircle className="spin" size={15} /> : <Download size={15} />}{downloadingGiftId === gift.id ? 'MP4 만드는 중' : 'MP4 다운로드'}</button><button type="button" disabled={Boolean(downloadingGiftId)} onClick={() => setConfirmDeleteGift(gift)}><Trash2 size={15} /> 삭제</button></div>
                {gift.thankYouNote ? <div className="gift-thank-you-sent"><MessageCircle size={17} /><div><strong>감사 인사를 보냈어요</strong><p>{gift.thankYouNote}</p></div></div> : <button className="gift-thank-you-action" type="button" onClick={() => { setThankYouGift(gift); setThankYouNote(''); }}><MessageCircle size={17} /> 감사 인사 보내기</button>}
              </> : null}
            </article>;
          })}</section>)}
        </div>
      ) : sentGifts.length === 0 ? <div className="gift-empty"><Gift size={32} /><strong>아직 보낸 선물이 없어요</strong><p>듣기 화면의 ‘선물하기’에서 친구에게 말씀을 전할 수 있어요.</p></div> : (
        <div className="gift-cards sent-gift-cards">
          {sentGifts.map((gift) => {
            const giftBgm = GIFT_BGM_CATALOG[gift.bgmId] ?? GIFT_BGM_CATALOG.none;
            const opened = gift.openedAt !== null;
            const status = opened ? '열어봄' : '열어보기 전';
            const detailOpen = detailSentGiftId === gift.id;
            return <article className="gift-card gift-compact-card sent-gift-card" key={gift.id}>
              <button className="gift-card-header" type="button" onClick={() => setDetailSentGiftId(detailOpen ? null : gift.id)}><span><Gift size={18} /></span><div><small>{gift.recipientNickname}님에게 · {formatGiftDate(gift.createdAt)}</small><h3>{gift.title}</h3></div></button>
              {detailOpen && <>
              <div className="gift-card-tags"><span><Headphones size={13} /> {gift.recordingCount}개 녹음</span><span><Music2 size={13} /> {giftBgm.name} · {gift.bgmVolume}%</span></div>
              {gift.hasLetter && <div className="sent-gift-letter-tag"><MessageCircle size={15} /> {gift.letterType === 'voice' ? '음성 편지' : '텍스트 편지'}를 함께 보냈어요</div>}
              <div className={`sent-gift-status ${opened ? 'opened' : ''}`}><span>{status}</span><p>{opened && gift.openedAt ? `열어본 시간 · ${formatGiftDateTime(gift.openedAt)}` : `${gift.recipientNickname}님이 열어보기를 기다리고 있어요.`}</p></div>
              {gift.thankYouNote && <div className="sent-thank-you-note"><MessageCircle size={18} /><div><strong>감사 인사가 도착했어요</strong><blockquote>{gift.thankYouNote}</blockquote>{gift.thankedAt && <small>{formatGiftDateTime(gift.thankedAt)}</small>}</div></div>}
              <button className="completed-journey-delete" type="button" disabled={deletingGiftId === gift.id} onClick={() => void deleteSentGift(gift)}><Trash2 size={15} /> {deletingGiftId === gift.id ? '삭제 중' : '보낸 선물 삭제'}</button>
              </>}
            </article>;
          })}
        </div>
      )}

      {activeGift && activeRecording && <div className="continuous-player-backdrop" role="presentation"><dialog className="continuous-player-modal" open aria-labelledby="gift-player-title">
        <button className="continuous-player-close" type="button" onClick={stopPlayback} aria-label="선물 이어듣기 닫기"><X size={22} /></button>
        <p className="eyebrow">GIFT PLAYBACK · {activeGift.senderNickname}님으로부터</p>
        <div className="continuous-player-progress"><span style={{ width: `${((activeIndex + 1) / activeGift.recordings.length) * 100}%` }} /></div>
        <small>{activeIndex + 1} / {activeGift.recordings.length} · {formatGiftDate(activeGift.createdAt)}</small>
        <div className="continuous-player-verse"><span>{activeRecording.verse}</span><h2 id="gift-player-title">{activeRecording.verseText}</h2></div>
        <div className="continuous-player-actions">
          <button className="continuous-player-list-trigger" type="button" onClick={() => setOpenLists((current) => current.includes(activeGift.id) ? current.filter((id) => id !== activeGift.id) : [...current, activeGift.id])}><List size={19} /><span>목록</span></button>
          <button className="continuous-player-stop" type="button" onClick={paused ? resumePlayback : pausePlayback}>{paused ? <Play size={18} /> : <Pause size={18} />}{paused ? '계속 듣기' : '일시정지'}</button>
          <button className="continuous-player-stop" type="button" onClick={stopPlayback}><CircleStop size={18} /> 종료</button>
        </div>
        {openLists.includes(activeGift.id) && <div className="continuous-player-list"><strong>선물 말씀 목록</strong><div>{activeGift.recordings.map((recording, index) => <button className={index === activeIndex ? 'playing' : ''} type="button" onClick={() => playPosition(activeGift, index, false)} key={recording.id}><span>{recording.book} {recording.chapter}{recording.book === '시편' ? '편' : '장'} {recording.verse}절</span><small>{index === activeIndex ? '재생 중' : '여기부터 듣기'}</small></button>)}</div></div>}
      </dialog></div>}

      {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- 사용자가 직접 녹음한 음성에는 별도 자막 파일이 없습니다. */}
      <audio ref={voiceRef} onEnded={handleEnded} />
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- 배경음악은 음성 콘텐츠가 아닙니다. */}
      <audio ref={bgmRef} />

      {confirmDeleteGift && <div className="gift-dialog-backdrop" role="presentation"><dialog className="gift-delete-dialog" open aria-labelledby="gift-delete-title"><button type="button" onClick={() => setConfirmDeleteGift(null)} disabled={Boolean(deletingGiftId)} aria-label="삭제 확인 닫기"><X size={20} /></button><span><Trash2 size={25} /></span><h2 id="gift-delete-title">‘{confirmDeleteGift.title}’ 선물을 삭제할까요?</h2><p>삭제하면 선물함과 다운로드 파일에서 모두 사라지고 복구할 수 없어요.</p><div><button type="button" onClick={() => setConfirmDeleteGift(null)} disabled={Boolean(deletingGiftId)}>돌아가기</button><button className="delete" type="button" onClick={() => void deleteGift()} disabled={Boolean(deletingGiftId)}>{deletingGiftId ? <LoaderCircle className="spin" size={17} /> : <Trash2 size={17} />}{deletingGiftId ? '삭제 중' : '선물 삭제'}</button></div></dialog></div>}
      {thankYouGift && <div className="gift-dialog-backdrop" role="presentation"><dialog className="gift-thank-you-dialog" open aria-labelledby="gift-thank-you-title">
        <button className="gift-dialog-close" type="button" onClick={() => setThankYouGift(null)} disabled={sendingThankYou} aria-label="감사 인사 닫기"><X size={20} /></button>
        <span className="gift-dialog-icon"><MessageCircle size={25} /></span>
        <p className="eyebrow">{thankYouGift.senderNickname}님에게</p>
        <h2 id="gift-thank-you-title">감사 인사를 보내요</h2>
        <p className="muted">마음에 드는 문구를 고르거나 직접 적어 주세요.</p>
        <div className="gift-thank-you-templates">{THANK_YOU_TEMPLATES.map((template) => <button className={thankYouNote === template ? 'selected' : ''} type="button" key={template} onClick={() => setThankYouNote(template)}>{template}</button>)}</div>
        <label className="gift-thank-you-custom"><span>직접 쓰기</span><textarea rows={4} maxLength={300} value={thankYouNote} placeholder="고마운 마음을 전해 보세요." onChange={(event) => setThankYouNote(event.currentTarget.value)} /><small>{thankYouNote.length}/300</small></label>
        <div className="gift-thank-you-dialog-actions"><button type="button" onClick={() => setThankYouGift(null)} disabled={sendingThankYou}>돌아가기</button><button className="send" type="button" onClick={() => void sendThankYou()} disabled={sendingThankYou || !thankYouNote.trim()}>{sendingThankYou ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}{sendingThankYou ? '보내는 중' : '감사 인사 보내기'}</button></div>
      </dialog></div>}
    </section>
  );
}
