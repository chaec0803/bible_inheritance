'use client';

import { useEffect, useRef, useState } from 'react';
import { CircleStop, Download, Gift, Headphones, List, LoaderCircle, Music2, Pause, Play, Trash2, X } from 'lucide-react';
import { GIFT_BGM_CATALOG, type GiftBgmId } from '@/lib/gift-policy';

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
  recordings: GiftRecording[];
};

function formatGiftDate(timestamp: number) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(timestamp));
}

export function GiftsPanel() {
  const [gifts, setGifts] = useState<ReceivedGift[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [activeGiftId, setActiveGiftId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [openLists, setOpenLists] = useState<string[]>([]);
  const [confirmDeleteGift, setConfirmDeleteGift] = useState<ReceivedGift | null>(null);
  const [deletingGiftId, setDeletingGiftId] = useState<string | null>(null);
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);

  const refresh = async () => {
    const response = await fetch('/api/gifts');
    const payload = await response.json() as { gifts?: ReceivedGift[]; error?: string };
    if (!response.ok) throw new Error(payload.error ?? '선물함을 불러오지 못했어요.');
    setGifts(payload.gifts ?? []);
  };

  useEffect(() => {
    let active = true;
    const voice = voiceRef.current;
    const bgmAudio = bgmRef.current;
    void fetch('/api/gifts')
      .then(async (response) => {
        const payload = await response.json() as { gifts?: ReceivedGift[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? '선물함을 불러오지 못했어요.');
        if (active) setGifts(payload.gifts ?? []);
      })
      .catch((error: Error) => active && setMessage(error.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      voice?.pause();
      bgmAudio?.pause();
    };
  }, []);

  const activeGift = gifts.find((gift) => gift.id === activeGiftId) ?? null;
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
    if (bgmAudio && bgm.audioSrc && restartBgm) {
      bgmAudio.src = bgm.audioSrc;
      bgmAudio.loop = true;
      bgmAudio.volume = gift.bgmVolume / 100;
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

  return (
    <section className="gifts-section" aria-labelledby="gifts-title">
      <div className="gifts-heading"><div><p className="eyebrow">마음을 담아 도착한 말씀</p><h2 id="gifts-title">선물함</h2><p className="muted">친구가 보낸 목소리를 선택한 BGM과 함께 들어보세요.</p></div><span><Gift size={16} /> {gifts.length}개</span></div>
      {message && <output className="gift-message gift-page-message" aria-live="polite">{message}</output>}
      {loading ? <div className="gift-empty"><LoaderCircle className="spin" size={29} /><strong>받은 선물을 불러오고 있어요</strong></div> : gifts.length === 0 ? <div className="gift-empty"><Gift size={32} /><strong>아직 도착한 선물이 없어요</strong><p>친구가 말씀 녹음을 보내면 이곳에 차곡차곡 모여요.</p></div> : (
        <div className="gift-cards">
          {gifts.map((gift) => {
            const isActive = gift.id === activeGiftId;
            const giftBgm = GIFT_BGM_CATALOG[gift.bgmId] ?? GIFT_BGM_CATALOG.none;
            const listOpen = openLists.includes(gift.id);
            return <article className={`gift-card ${isActive ? 'playing' : ''}`} key={gift.id}>
              <div className="gift-card-header"><span><Gift size={21} /></span><div><small>{gift.senderNickname}님이 보낸 말씀 · {formatGiftDate(gift.createdAt)}</small><h3>{gift.title}</h3></div></div>
              <div className="gift-card-tags"><span><Headphones size={13} /> {gift.recordingCount}개 녹음</span><span><Music2 size={13} /> {giftBgm.name} · {gift.bgmVolume}%</span></div>
              {isActive && activeRecording && <div className="gift-now-playing"><small>NOW PLAYING · {activeIndex + 1}/{gift.recordings.length}</small><strong>{activeRecording.verseText}</strong><span>{activeRecording.book} {activeRecording.chapter}{activeRecording.book === '시편' ? '편' : '장'} {activeRecording.verse}절</span></div>}
              <div className="gift-primary-actions">
                {!isActive ? <button type="button" onClick={() => startPlayback(gift)}><Play size={17} /> 이어듣기</button> : <><button type="button" onClick={paused ? resumePlayback : pausePlayback}>{paused ? <Play size={17} /> : <Pause size={17} />}{paused ? '계속 듣기' : '일시정지'}</button><button className="secondary" type="button" onClick={stopPlayback}><CircleStop size={17} /> 종료</button></>}
              </div>
              <button className="gift-list-toggle" type="button" onClick={() => setOpenLists((current) => current.includes(gift.id) ? current.filter((id) => id !== gift.id) : [...current, gift.id])} aria-expanded={listOpen}><List size={16} /> 녹음 목록 {listOpen ? '접기' : '보기'}</button>
              {listOpen && <div className="gift-recording-list">{gift.recordings.map((recording, index) => <button className={isActive && index === activeIndex ? 'playing' : ''} type="button" onClick={() => playPosition(gift, index, !isActive)} key={recording.id}><span>{recording.book} {recording.chapter}{recording.book === '시편' ? '편' : '장'} · {recording.verse}절</span><small>{isActive && index === activeIndex ? '재생 중' : '여기부터 듣기'}</small></button>)}</div>}
              <div className="gift-secondary-actions"><a href={`/api/gifts/${gift.id}/download`} download><Download size={15} /> 다운로드</a><button type="button" onClick={() => setConfirmDeleteGift(gift)}><Trash2 size={15} /> 삭제</button></div>
            </article>;
          })}
        </div>
      )}

      {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- 사용자가 직접 녹음한 음성에는 별도 자막 파일이 없습니다. */}
      <audio ref={voiceRef} onEnded={handleEnded} />
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- 배경음악은 음성 콘텐츠가 아닙니다. */}
      <audio ref={bgmRef} />

      {confirmDeleteGift && <div className="gift-dialog-backdrop" role="presentation"><dialog className="gift-delete-dialog" open aria-labelledby="gift-delete-title"><button type="button" onClick={() => setConfirmDeleteGift(null)} disabled={Boolean(deletingGiftId)} aria-label="삭제 확인 닫기"><X size={20} /></button><span><Trash2 size={25} /></span><h2 id="gift-delete-title">‘{confirmDeleteGift.title}’ 선물을 삭제할까요?</h2><p>삭제하면 선물함과 다운로드 파일에서 모두 사라지고 복구할 수 없어요.</p><div><button type="button" onClick={() => setConfirmDeleteGift(null)} disabled={Boolean(deletingGiftId)}>돌아가기</button><button className="delete" type="button" onClick={() => void deleteGift()} disabled={Boolean(deletingGiftId)}>{deletingGiftId ? <LoaderCircle className="spin" size={17} /> : <Trash2 size={17} />}{deletingGiftId ? '삭제 중' : '선물 삭제'}</button></div></dialog></div>}
    </section>
  );
}
