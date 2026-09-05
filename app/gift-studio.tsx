'use client';
/* oxlint-disable jsx-a11y/media-has-caption -- verse text is displayed beside each spoken recording */
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowRight,
  BookHeart,
  Check,
  ChevronLeft,
  CircleStop,
  Gift,
  LoaderCircle,
  Mic,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  Volume2,
  X,
} from 'lucide-react';
import { bibleBooks } from './bible-metadata';
import { BibleRangePicker } from './bible-range-picker';
import { InProgressGifts, type InProgressGift } from './in-progress-gifts';
import { FriendPickerModal, type FriendPickerPerson } from './friend-picker-modal';
import { GiftLetterComposer } from './gift-letter-composer';
import type { BibleRange } from '@/lib/bible-scope';
import type { GiftLetterInput } from '@/lib/gift-letter';
import { toAudibleBgmGain } from '@/lib/audio-volume';
import {
  GIFT_BGM_CATALOG,
  getGiftDraftProgress,
  isGiftDraftSendable,
  type GiftDraftScope,
} from '@/lib/gift-draft';
import {
  createRecordingAudioGraph,
  getSupportedMimeType,
} from '@/lib/recording-audio';

export const GIFT_STUDIO_STEPS = [
  'friend',
  'scope',
  'record',
  'preview',
  'music',
] as const;
type GiftStudioStep = (typeof GIFT_STUDIO_STEPS)[number];
type DraftItem = {
  position: number;
  book: string;
  chapter: number;
  verse: number;
  verseText: string;
  recorded: boolean;
  objectKey?: string | null;
  sourceRecordingId?: string | null;
};
type Draft = {
  id: string;
  title: string;
  bgmId: string;
  bgmVolume: number;
  nextPosition: number | null;
  recipientNickname?: string;
  recipientUserId?: string;
  recipientUserIds?: string[];
  recipientCount?: number;
  items: DraftItem[];
};
type ApiPayload = {
  drafts?: Draft[];
  draft?: Draft;
  gift?: { id: string; title: string; recordingCount: number };
  error?: string;
};
const readPayload = async (response: Response) =>
  response.json() as Promise<ApiPayload>;
const labels: Record<GiftStudioStep, string> = {
  friend: '받을 친구',
  scope: '말씀 선택',
  record: '목소리 녹음',
  preview: '미리 듣기',
  music: '음악과 전송',
};
const formatTime = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const scopeOptions = [
  ['chapter', '한 장 읽기', '한 장의 말씀을 온전히 담아요'],
  ['range', '범위 지정', '시작 권·장·절부터 끝 권·장·절까지 골라요'],
] as const;

export function GiftStudio({
  initialScope,
  initialFriend,
  onBack,
  onSent,
}: {
  initialScope?: GiftDraftScope | null;
  initialFriend?: FriendPickerPerson | null;
  onBack: () => void;
  onSent: (giftId: string) => void;
}) {
  const [step, setStep] = useState<GiftStudioStep>('friend');
  const [selectedFriend, setSelectedFriend] = useState<FriendPickerPerson | null>(initialFriend ?? null);
  const [selectedFriends, setSelectedFriends] = useState<FriendPickerPerson[]>(initialFriend ? [initialFriend] : []);
  const [friendPickerOpen, setFriendPickerOpen] = useState(false);
  const recipient = selectedFriend?.userId ?? '';
  const [scopeKind, setScopeKind] = useState<GiftDraftScope['kind']>(
    initialScope?.kind ?? 'chapter',
  );
  const [bibleRange, setBibleRange] = useState<BibleRange>(() => ({
    start: { bookCode: '시', chapter: 23, verse: 1 },
    end: { bookCode: '시', chapter: 23, verse: 6 },
  }));
  const [bookCode, setBookCode] = useState(
    initialScope && 'bookCode' in initialScope ? initialScope.bookCode : '시',
  );
  const [chapter, setChapter] = useState(
    initialScope && 'chapter' in initialScope ? initialScope.chapter : 23,
  );
  const [endChapter, setEndChapter] = useState(
    initialScope?.kind === 'chapters' ? initialScope.endChapter : 24,
  );
  const [startVerse, setStartVerse] = useState(1);
  const [endVerse, setEndVerse] = useState(3);
  const [selectedBookCodes, setSelectedBookCodes] = useState<string[]>(
    initialScope?.kind === 'books' ? initialScope.bookCodes : ['시'],
  );
  const [giftBookTestament, setGiftBookTestament] = useState<'old' | 'new'>(
    'old',
  );
  const [giftBookSearch, setGiftBookSearch] = useState('');
  const [giftTitle, setGiftTitle] = useState('');
  const [giftTitleEdited, setGiftTitleEdited] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [letter, setLetter] = useState<GiftLetterInput>({ type: 'none' });
  const [sendSuccessGiftId, setSendSuccessGiftId] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [savingRecording, setSavingRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recordingManageOpen, setRecordingManageOpen] = useState(false);
  const [confirmResetRecordings, setConfirmResetRecordings] = useState(false);
  const [confirmDiscardDraft, setConfirmDiscardDraft] = useState<InProgressGift | null>(null);
  const [recordingMode, setRecordingMode] = useState<'verse' | 'continuous'>(
    'continuous',
  );
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const [bgmPaused, setBgmPaused] = useState(false);
  const [bgmLoading, setBgmLoading] = useState(false);
  const [fullPreviewPlaying, setFullPreviewPlaying] = useState(false);
  const [fullPreviewIndex, setFullPreviewIndex] = useState(0);
  const [bgmPreviewError, setBgmPreviewError] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(0);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const bgmPreviewRef = useRef<HTMLAudioElement | null>(null);
  const fullPreviewVoiceRef = useRef<HTMLAudioElement | null>(null);
  const fullPreviewBgmRef = useRef<HTMLAudioElement | null>(null);
  const autoContinueRef = useRef(false);
  const advancingRef = useRef(false);
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve());
  const continuousBoundariesRef = useRef<number[]>([]);

  const refresh = () =>
    fetch('/api/gift-drafts')
      .then(readPayload)
      .then((payload) => setDrafts(payload.drafts ?? []));
  useEffect(() => {
    void refresh()
      .catch(() => setMessage('선물 준비 정보를 불러오지 못했어요.'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!recording) return;
    const interval = window.setInterval(
      () =>
        setSeconds(
          Math.max(0, Math.floor((Date.now() - startedRef.current) / 1000)),
        ),
      500,
    );
    return () => window.clearInterval(interval);
  }, [recording]);
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(''), 4000);
    return () => window.clearTimeout(timeout);
  }, [message]);
  useEffect(() => () => {
    bgmPreviewRef.current?.pause();
    fullPreviewVoiceRef.current?.pause();
    fullPreviewBgmRef.current?.pause();
  }, []);
  const selectedBook =
    bibleBooks.find((book) => book.code === bookCode) ?? bibleBooks[0];
  const currentIndex = GIFT_STUDIO_STEPS.indexOf(step);
  const progress = draft ? getGiftDraftProgress(draft.items) : null;
  const visibleGiftBooks = bibleBooks.filter(
    (book) =>
      book.testament === giftBookTestament &&
      book.name.includes(giftBookSearch.trim()),
  );

  const hydrateVerseTexts = async (targetDraft: Draft) => {
    const books = [...new Set(targetDraft.items.map((item) => item.book))];
    const chaptersByBook = new Map<string, string[][]>();
    await Promise.all(
      books.map(async (bookName) => {
        const metadata = bibleBooks.find((book) => book.name === bookName);
        if (!metadata) return;
        const response = await fetch(
          `/data/bible/${encodeURIComponent(metadata.code)}.json`,
        );
        if (response.ok)
          chaptersByBook.set(bookName, (await response.json()) as string[][]);
      }),
    );
    return {
      ...targetDraft,
      items: targetDraft.items.map((item) => ({
        ...item,
        verseText:
          item.verseText ||
          chaptersByBook.get(item.book)?.[item.chapter - 1]?.[item.verse - 1] ||
          '',
      })),
    };
  };

  const makeScope = (): GiftDraftScope =>
    initialScope ??
    (scopeKind === 'range'
      ? { kind: 'range', ...bibleRange }
      : scopeKind === 'verses'
        ? { kind: 'verses', bookCode, chapter, startVerse, endVerse }
        : scopeKind === 'chapters'
          ? { kind: 'chapters', bookCode, startChapter: chapter, endChapter }
          : scopeKind === 'books'
            ? { kind: 'books', bookCodes: selectedBookCodes }
            : scopeKind === 'journey'
              ? { kind: 'journey', projectId: '' }
              : { kind: 'chapter', bookCode, chapter });

  const defaultGiftTitle = () => {
    const scope = makeScope();
    if (scope.kind === 'range') {
      const startBook = bibleBooks.find((book) => book.code === scope.start.bookCode)?.name ?? scope.start.bookCode;
      const endBook = bibleBooks.find((book) => book.code === scope.end.bookCode)?.name ?? scope.end.bookCode;
      return `${startBook} ${scope.start.chapter}:${scope.start.verse}–${endBook} ${scope.end.chapter}:${scope.end.verse}`;
    }
    if (scope.kind === 'chapter') {
      const name = bibleBooks.find((book) => book.code === scope.bookCode)?.name ?? scope.bookCode;
      return `${name} ${scope.chapter}${name === '시편' ? '편' : '장'}`;
    }
    if (scope.kind === 'verses') {
      const name = bibleBooks.find((book) => book.code === scope.bookCode)?.name ?? scope.bookCode;
      return `${name} ${scope.chapter}${name === '시편' ? '편' : '장'} ${scope.startVerse}–${scope.endVerse}절`;
    }
    if (scope.kind === 'chapters') {
      const name = bibleBooks.find((book) => book.code === scope.bookCode)?.name ?? scope.bookCode;
      return `${name} ${scope.startChapter}–${scope.endChapter}장`;
    }
    if (scope.kind === 'books') {
      return `${scope.bookCodes.map((code) => bibleBooks.find((book) => book.code === code)?.name ?? code).join(' · ')} 전체`;
    }
    return '말씀 선물';
  };
  const resolvedGiftTitle = giftTitleEdited ? giftTitle.trim() : defaultGiftTitle();

  const createDraft = async () => {
    setLoading(true);
    setMessage('');
    const response = await fetch('/api/gift-drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientUserId: recipient,
        recipientUserIds: selectedFriends.map((friend) => friend.userId),
        scope: makeScope(),
        title: resolvedGiftTitle,
      }),
    });
    const payload = await readPayload(response);
    setLoading(false);
    if (!response.ok)
      return setMessage(payload.error ?? '초안을 만들지 못했어요.');
    if (payload.draft) {
      const created = {
        ...payload.draft,
        bgmId: payload.draft.bgmId ?? 'none',
        bgmVolume: payload.draft.bgmVolume ?? 12,
        nextPosition: payload.draft.nextPosition ?? 0,
      };
      setDraft(await hydrateVerseTexts(created));
    }
    setStep('record');
  };
  async function startRecording(
    targetDraft = draft,
    existingSession?: {
      sourceStream: MediaStream;
      graph: ReturnType<typeof createRecordingAudioGraph>;
    },
  ) {
    if (!targetDraft || targetDraft.nextPosition == null) return;
    const sourceStream = existingSession?.sourceStream ?? await navigator.mediaDevices.getUserMedia({ audio: true });
    const graph = existingSession?.graph ?? createRecordingAudioGraph(sourceStream);
    const recorder = new MediaRecorder(graph.stream, {
      mimeType: getSupportedMimeType() || undefined,
    });
    chunksRef.current = [];
    recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
    recorder.onstop = async () => {
      const shouldContinue = autoContinueRef.current && recordingMode === 'continuous';
      let continuing = false;
      autoContinueRef.current = false;
      const position = targetDraft.nextPosition!;
      const item = targetDraft.items[position];
      const form = new FormData();
      form.append(
        'audio',
        new Blob(chunksRef.current, { type: recorder.mimeType }),
        'verse.webm',
      );
      form.append(
        'verseText',
        item.verseText || `${item.book} ${item.chapter}:${item.verse}`,
      );
      form.append(
        'durationSeconds',
        String(
          Math.max(1, Math.round((Date.now() - startedRef.current) / 1000)),
        ),
      );
      if (shouldContinue && position < targetDraft.items.length - 1) {
        const optimisticDraft: Draft = {
          ...targetDraft,
          nextPosition: position + 1,
          items: targetDraft.items.map((candidate, index) => index === position ? { ...candidate, recorded: true } : candidate),
        };
        continuing = true;
        setDraft(optimisticDraft);
        window.setTimeout(() => void startRecording(optimisticDraft, { sourceStream, graph }), 0);
      }
      try {
        const uploadTask = uploadQueueRef.current.then(async () => {
          const uploadResponse = await fetch(
            `/api/gift-drafts/${targetDraft.id}/items/${position}/audio`,
            { method: 'PUT', body: form },
          );
          if (!uploadResponse.ok) {
            const payload = await readPayload(uploadResponse);
            throw new Error(payload.error ?? '녹음을 저장하지 못했어요.');
          }
        });
        uploadQueueRef.current = uploadTask.catch(() => undefined);
        await uploadTask;
        if (continuing) return;
        const currentResponse = await fetch(`/api/gift-drafts/${targetDraft.id}`);
        if (!currentResponse.ok) throw new Error('다음 말씀을 불러오지 못했어요.');
        const current = await readPayload(currentResponse);
        if (!current.draft) throw new Error('다음 말씀을 불러오지 못했어요.');
        const hydratedDraft = await hydrateVerseTexts(current.draft);
        setDraft(hydratedDraft);
        setDrafts((currentDrafts) => currentDrafts.map((candidate) => candidate.id === hydratedDraft.id ? hydratedDraft : candidate));
        setRecording(false);
        if (hydratedDraft.nextPosition == null) {
          setStep('preview');
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '녹음을 저장하지 못했어요.');
        advancingRef.current = false;
      } finally {
        if (!continuing) {
          setSavingRecording(false);
          graph.close();
          sourceStream.getTracks().forEach((track) => track.stop());
        }
      }
      setRecording(false);
    };
    recorderRef.current = recorder;
    startedRef.current = Date.now();
    setSeconds(0);
    recorder.start();
    advancingRef.current = false;
    setRecording(true);
  }
  const finishCurrentVerseAndContinue = () => {
    if (advancingRef.current || !draft || draft.nextPosition == null) return;
    const position = draft.nextPosition;
    const hasNext = position < draft.items.length - 1;
    continuousBoundariesRef.current.push(Date.now());
    autoContinueRef.current = hasNext;
    advancingRef.current = true;
    if (hasNext) {
      const optimisticDraft: Draft = {
        ...draft,
        nextPosition: position + 1,
        items: draft.items.map((candidate, index) => index === position ? { ...candidate, recorded: true } : candidate),
      };
      flushSync(() => setDraft(optimisticDraft));
    }
    if (!hasNext) setSavingRecording(true);
    recorderRef.current?.stop();
  };
  const bgmSrc = (id: string) =>
    id === 'still-waters'
      ? '/api/bgm/aeternum?v=3'
      : id === 'peaceful-morning'
        ? '/api/bgm/unto-thee?v=3'
        : id === 'word-breath'
          ? '/api/bgm/the-kings-return?v=3'
          : '';
  const stopBgmPreview = () => {
    const audio = bgmPreviewRef.current;
    audio?.pause();
    if (audio) audio.currentTime = 0;
    bgmPreviewRef.current = null;
    setBgmPlaying(false);
    setBgmPaused(false);
    setBgmLoading(false);
  };
  const playBgmPreview = async () => {
    if (!draft || draft.bgmId === 'none') return;
    const audio = bgmPreviewRef.current ?? new Audio(bgmSrc(draft.bgmId));
    bgmPreviewRef.current = audio;
    audio.volume = toAudibleBgmGain(draft.bgmVolume);
    audio.onended = () => {
      setBgmPlaying(false);
      setBgmPaused(false);
    };
    audio.onerror = () => {
      setBgmPlaying(false);
      setBgmPaused(false);
      setBgmLoading(false);
      setBgmPreviewError(true);
    };
    try {
      setBgmPreviewError(false);
      setBgmLoading(true);
      await audio.play();
      setBgmPlaying(true);
      setBgmPaused(false);
    } catch {
      setBgmPlaying(false);
      setBgmPaused(false);
      setBgmPreviewError(true);
    } finally {
      setBgmLoading(false);
    }
  };
  const pauseBgmPreview = () => {
    bgmPreviewRef.current?.pause();
    setBgmPlaying(false);
    setBgmPaused(true);
  };
  const toggleBgmPreview = () =>
    bgmPlaying ? pauseBgmPreview() : playBgmPreview();
  const selectGiftBgm = (bgmId: string) => {
    stopBgmPreview();
    setBgmPreviewError(false);
    if (draft) void saveMusic(bgmId, draft.bgmVolume);
  };
  const stopFullGiftPreview = () => {
    fullPreviewVoiceRef.current?.pause();
    fullPreviewBgmRef.current?.pause();
    if (fullPreviewVoiceRef.current) fullPreviewVoiceRef.current.currentTime = 0;
    if (fullPreviewBgmRef.current) fullPreviewBgmRef.current.currentTime = 0;
    setFullPreviewPlaying(false);
    setFullPreviewIndex(0);
  };
  const playFullGiftPreview = async (index = 0, restartBgm = true) => {
    if (!draft) return;
    if (restartBgm) stopBgmPreview();
    const recordedItems = draft.items.filter((item) => item.recorded);
    const item = recordedItems[index];
    const voice = fullPreviewVoiceRef.current;
    const bgmAudio = fullPreviewBgmRef.current;
    if (!item || !voice) return stopFullGiftPreview();
    setFullPreviewIndex(index);
    voice.src = `/api/gift-drafts/${draft.id}/items/${item.position}/audio`;
    voice.load();
    const requests: Promise<void>[] = [voice.play()];
    const selectedBgmSrc = bgmSrc(draft.bgmId);
    if (bgmAudio && selectedBgmSrc) {
      bgmAudio.volume = toAudibleBgmGain(draft.bgmVolume);
      if (restartBgm) {
        bgmAudio.src = selectedBgmSrc;
        bgmAudio.loop = true;
        bgmAudio.load();
      }
      requests.push(bgmAudio.play());
    }
    try {
      await Promise.all(requests);
      setFullPreviewPlaying(true);
      setStep('preview');
    } catch {
      stopFullGiftPreview();
      setMessage('전체 미리 듣기를 시작하지 못했어요. 다시 눌러 주세요.');
    }
  };
  const handleFullPreviewEnded = () => {
    if (!draft) return stopFullGiftPreview();
    const recordedItems = draft.items.filter((item) => item.recorded);
    const nextIndex = fullPreviewIndex + 1;
    if (nextIndex < recordedItems.length) void playFullGiftPreview(nextIndex, false);
    else stopFullGiftPreview();
  };
  const saveMusic = async (bgmId: string, bgmVolume: number) => {
    if (!draft) return;
    await fetch(`/api/gift-drafts/${draft.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bgmId, bgmVolume }),
    });
    setDraft((current) =>
      current ? { ...current, bgmId, bgmVolume } : current,
    );
  };
  const saveTitle = async (title: string) => {
    if (!draft) return false;
    const normalizedTitle = title.trim().slice(0, 100);
    if (!normalizedTitle) {
      setMessage('선물 이름을 입력해 주세요.');
      return false;
    }
    const response = await fetch(`/api/gift-drafts/${draft.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: normalizedTitle }),
    });
    const payload = await readPayload(response);
    if (!response.ok) {
      setMessage(payload.error ?? '선물 이름을 저장하지 못했어요.');
      return false;
    }
    setDraft((current) =>
      current ? { ...current, title: normalizedTitle } : current,
    );
    setDrafts((currentDrafts) =>
      currentDrafts.map((candidate) =>
        candidate.id === draft.id
          ? { ...candidate, title: normalizedTitle }
          : candidate,
      ),
    );
    return true;
  };
  const resetAllRecordings = async () => {
    if (!draft || recording) return;
    setLoading(true);
    const response = await fetch(`/api/gift-drafts/${draft.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset-recordings' }),
    });
    const payload = await readPayload(response);
    setLoading(false);
    if (!response.ok)
      return setMessage(payload.error ?? '녹음을 초기화하지 못했어요.');
    const resetDraft = await fetch(`/api/gift-drafts/${draft.id}`)
      .then(readPayload)
      .then((result) => result.draft);
    if (resetDraft) setDraft(await hydrateVerseTexts(resetDraft));
    setRecordingMode('continuous');
    setStep('record');
    setMessage('처음부터 다시 녹음할 준비가 됐어요.');
  };
  const discard = async (id: string) => {
    await fetch(`/api/gift-drafts/${id}`, { method: 'DELETE' });
    if (draft?.id === id) {
      setDraft(null);
      setStep('friend');
    }
    await refresh();
  };
  const send = async () => {
    if (!draft || sending || !draft.title.trim() || !isGiftDraftSendable(draft.items))
      return;
    if (!(await saveTitle(draft.title))) return;
    setSendError(null);
    setSending(true);
    stopBgmPreview();
    const response = await fetch(`/api/gift-drafts/${draft.id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ letter: letter.type === 'text' && !letter.text.trim() ? { type: 'none' } : letter, recipientUserIds: selectedFriends.map((friend) => friend.userId) }),
    });
    const payload = await readPayload(response);
    setSending(false);
    if (!response.ok) {
      setSendError(payload.error ?? '선물을 보내지 못했어요.');
      return;
    }
    if (!payload.gift) {
      setSendError('보낸 선물 정보를 확인하지 못했어요.');
      return;
    }
    setSendSuccessGiftId(payload.gift.id);
    setLetter({ type: 'none' });
    setDraft(null);
    setStep('friend');
    await refresh();
  };

  return (
    <div className="gift-studio-shell" data-step={step}>
      <header className="gift-studio-header">
        <button className="onboarding-back" type="button" onClick={onBack}>
          <ChevronLeft size={16} /> 홈으로
        </button>
        <div>
          <span>
            <Gift size={20} />
          </span>
          <div>
            <p className="eyebrow">VOICE GIFT STUDIO</p>
            <h1>말씀 골라 선물하기</h1>
          </div>
        </div>
        <p>
          오늘, 마음에 떠오른 말씀을
          <br />
          소중한 사람에게 목소리로 전해 보세요.
        </p>
      </header>
      <nav className="gift-studio-progress" aria-label="선물 만들기 단계">
        {GIFT_STUDIO_STEPS.map((item, index) => (
          <div
            className={`${index === currentIndex ? 'current' : ''} ${index < currentIndex ? 'complete' : ''}`}
            key={item}
          >
            <span>
              {index < currentIndex ? <Check size={14} /> : index + 1}
            </span>
            <small>{labels[item]}</small>
          </div>
        ))}
      </nav>
      <div className="gift-studio-workspace">
        {step === 'friend' && !draft && (
          <section className="gift-studio-primary">
            <span className="gift-studio-section-icon">
              <UserRound size={22} />
            </span>
            <p className="eyebrow">STEP 1</p>
            <h2>받을 친구를 골라 주세요</h2>
            <p className="gift-studio-description">
              소중한 목소리를 전하고 싶은 친구를 최대 30명까지 선택해 주세요.
            </p>
            <div className="gift-recipient-slot">
              {selectedFriends.length ? (
                <div className="gift-selected-friends"><strong>선택 {selectedFriends.length}/30</strong><div>{selectedFriends.map((friend) => <button type="button" onClick={() => { const next = selectedFriends.filter((candidate) => candidate.userId !== friend.userId); setSelectedFriends(next); setSelectedFriend(next[0] ?? null); }} key={friend.userId}><span>{friend.nickname.slice(0, 1)}</span>{friend.nickname}<X size={13} /></button>)}</div></div>
              ) : (
                <p className="gift-recipient-placeholder">
                  <Users size={16} /> 아직 받을 친구를 고르지 않았어요.
                </p>
              )}
              <button
                className="gift-recipient-pick"
                type="button"
                onClick={() => setFriendPickerOpen(true)}
              >
                {selectedFriends.length ? '친구 더 선택하기' : '친구 선택하기'}
              </button>
            </div>
            <button
              className="gift-studio-continue"
              type="button"
              disabled={!selectedFriends.length}
              onClick={() => setStep('scope')}
            >
              말씀 선택하기 <ArrowRight size={17} />
            </button>
          </section>
        )}
        {step === 'scope' && !draft && (
          <section className="gift-studio-primary">
            <span className="gift-studio-section-icon">
              <BookHeart size={22} />
            </span>
            <p className="eyebrow">STEP 2</p>
            <h2>어떤 말씀을 선물할까요?</h2>
            <p className="gift-studio-description">
              마음에 떠오른 말씀의 범위를 골라 주세요. 최대 500절까지 담을 수
              있어요.
            </p>
            <div className="gift-scope-grid">
              {scopeOptions.map(([id, label, description]) => (
                <button
                  className={scopeKind === id ? 'selected' : ''}
                  type="button"
                  key={id}
                  onClick={() => setScopeKind(id)}
                >
                  <strong>{label}</strong>
                  <small>{description}</small>
                  {scopeKind === id && <Check size={16} />}
                </button>
              ))}
            </div>
            {scopeKind === 'range' && (
              <BibleRangePicker value={bibleRange} onChange={setBibleRange} />
            )}
            {(scopeKind === 'chapter' || scopeKind === 'verses') && (
              <div className="gift-range-fields gift-single-chapter-fields">
                <label>
                  <span>성경책</span>
                  <select
                    value={bookCode}
                    onChange={(event) => {
                      setBookCode(event.target.value);
                      setChapter(1);
                    }}
                  >
                    {bibleBooks.map((book) => (
                      <option value={book.code} key={book.code}>
                        {book.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{selectedBook.name === '시편' ? '편' : '장'}</span>
                  <input
                    type="number"
                    min="1"
                    max={selectedBook.chapters.length}
                    value={chapter}
                    onChange={(event) =>
                      setChapter(Math.max(1, Number(event.target.value)))
                    }
                  />
                </label>
                {scopeKind === 'verses' && (
                  <>
                    <label>
                      <span>시작 절</span>
                      <input
                        type="number"
                        min="1"
                        max={selectedBook.chapters[chapter - 1]}
                        value={startVerse}
                        onChange={(event) =>
                          setStartVerse(Number(event.target.value))
                        }
                      />
                    </label>
                    <label>
                      <span>끝 절</span>
                      <input
                        type="number"
                        min={startVerse}
                        max={selectedBook.chapters[chapter - 1]}
                        value={endVerse}
                        onChange={(event) =>
                          setEndVerse(Number(event.target.value))
                        }
                      />
                    </label>
                  </>
                )}
              </div>
            )}
            {scopeKind === 'chapters' && (
              <div className="gift-range-fields gift-multi-chapter-fields">
                <label>
                  <span>성경책</span>
                  <select
                    value={bookCode}
                    onChange={(event) => {
                      setBookCode(event.target.value);
                      setChapter(1);
                      setEndChapter(2);
                    }}
                  >
                    {bibleBooks.map((book) => (
                      <option value={book.code} key={book.code}>
                        {book.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>시작 장</span>
                  <input
                    type="number"
                    min="1"
                    max={selectedBook.chapters.length}
                    value={chapter}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setChapter(value);
                      setEndChapter((current) => Math.max(current, value));
                    }}
                  />
                </label>
                <label>
                  <span>끝 장</span>
                  <input
                    type="number"
                    min={chapter}
                    max={selectedBook.chapters.length}
                    value={endChapter}
                    onChange={(event) =>
                      setEndChapter(Number(event.target.value))
                    }
                  />
                </label>
                <p>
                  {selectedBook.name} {chapter}장부터 {endChapter}장까지
                </p>
              </div>
            )}
            {scopeKind === 'books' && (
              <div className="gift-book-picker-wrap">
                <div>
                  <strong>성경 권 선택</strong>
                  <span>{selectedBookCodes.length}권 선택됨</span>
                </div>
                <p>
                  여러 권을 눌러 선택해 주세요. 성경 순서대로 선물에 담겨요.
                </p>
                {selectedBookCodes.length > 0 && (
                  <div className="gift-selected-books">
                    {selectedBookCodes.map((code) => {
                      const book = bibleBooks.find(
                        (item) => item.code === code,
                      );
                      return (
                        book && (
                          <button
                            type="button"
                            key={code}
                            onClick={() =>
                              setSelectedBookCodes((current) =>
                                current.filter((item) => item !== code),
                              )
                            }
                          >
                            {book.name}
                            <X size={12} />
                          </button>
                        )
                      );
                    })}
                  </div>
                )}
                <div className="gift-book-tools">
                  <div>
                    <button
                      className={giftBookTestament === 'old' ? 'selected' : ''}
                      type="button"
                      onClick={() => setGiftBookTestament('old')}
                    >
                      구약 39권
                    </button>
                    <button
                      className={giftBookTestament === 'new' ? 'selected' : ''}
                      type="button"
                      onClick={() => setGiftBookTestament('new')}
                    >
                      신약 27권
                    </button>
                  </div>
                  <label>
                    <Search size={14} />
                    <input
                      aria-label="성경 권 검색"
                      placeholder="성경 권 검색"
                      value={giftBookSearch}
                      onChange={(event) =>
                        setGiftBookSearch(event.target.value)
                      }
                    />
                  </label>
                </div>
                <div className="gift-book-multi-picker">
                  {visibleGiftBooks.map((book) => {
                    const selected = selectedBookCodes.includes(book.code);
                    return (
                      <button
                        className={selected ? 'selected' : ''}
                        type="button"
                        key={book.code}
                        onClick={() =>
                          setSelectedBookCodes((current) =>
                            selected
                              ? current.filter((code) => code !== book.code)
                              : [...current, book.code],
                          )
                        }
                      >
                        <span>
                          {book.testament === 'old' ? '구약' : '신약'}
                        </span>
                        <strong>{book.name}</strong>
                        {selected && <Check size={14} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <label className="gift-title-field gift-title-before-recording">
              <span>선물 이름</span>
              <input
                type="text"
                maxLength={100}
                value={giftTitleEdited ? giftTitle : defaultGiftTitle()}
                placeholder="선물 이름을 입력해 주세요"
                onChange={(event) => {
                  setGiftTitleEdited(true);
                  setGiftTitle(event.currentTarget.value);
                }}
              />
              <small>이름을 정한 다음 녹음을 시작해요.</small>
            </label>
            <div className="gift-studio-actions">
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  setStep('friend');
                  setFriendPickerOpen(true);
                }}
              >
                <ChevronLeft size={16} /> 친구 다시 선택
              </button>
              <button
                className="gift-studio-continue"
                type="button"
                disabled={loading || !resolvedGiftTitle ||
                  (scopeKind === 'books' && selectedBookCodes.length === 0)
                }
                onClick={() => void createDraft()}
              >
                {loading ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <Gift size={17} />
                )}{' '}
                이름 저장하고 녹음하기
              </button>
            </div>
          </section>
        )}
        {draft && (
          <section className="recording-card">
            <span className="gift-studio-section-icon">
              <Mic size={22} />
            </span>
            <p className="eyebrow">
              STEP {step === 'record' ? '3' : step === 'preview' ? '4' : '5'}
            </p>
            <h2>{draft.title}</h2>
            <p className="gift-studio-description">
              선택한 순서대로 한 절씩 천천히 읽어 주세요.
            </p>
            <label className="gift-title-field">
              <span>선물 이름</span>
              <input
                type="text"
                maxLength={100}
                value={draft.title}
                placeholder="선물 이름을 입력해 주세요"
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
                onBlur={(event) => void saveTitle(event.target.value)}
              />
            </label>
            {Boolean(progress?.recorded) && (
              <button
                className="recording-manage-trigger"
                type="button"
                onClick={() => setRecordingManageOpen(true)}
              >
                <RotateCcw size={15} /> 녹음 수정하기
              </button>
            )}
            <div className="gift-recording-policy">
              <strong>
                {recordingMode === 'continuous' ? '이어 녹음' : '절별 수정'}
              </strong>
              <small>
                {recordingMode === 'continuous'
                  ? '처음에는 자연스럽게 이어 읽어요. 녹음이 끝난 뒤 원하는 절만 다시 녹음할 수 있어요.'
                  : '선택한 절만 새 목소리로 바꿔요.'}
              </small>
            </div>
            <div className="gift-recording-progress">
              <div>
                <span
                  style={{
                    width: `${progress ? (progress.recorded / Math.max(1, progress.total)) * 100 : 0}%`,
                  }}
                />
              </div>
              <strong>
                {progress?.recorded ?? 0} / {progress?.total ?? 0}절
              </strong>
            </div>
            {step === 'record' && draft.nextPosition != null && (
              <div
                className={`gift-current-verse ${recording ? 'recording' : ''}`}
              >
                <div className="recording-heading">
                  <div>
                    <small>
                      {recordingMode === 'continuous'
                        ? '이어 읽을 말씀'
                        : '다시 녹음할 말씀'}
                    </small>
                    <strong>
                      {draft.items[draft.nextPosition]?.book}{' '}
                      {draft.items[draft.nextPosition]?.chapter}:
                      {draft.items[draft.nextPosition]?.verse}
                    </strong>
                  </div>
                  <span className={`status-pill ${recording ? 'live' : ''}`}>
                    {recording ? '녹음 중' : '녹음 전'}
                  </span>
                </div>
                <article className="verse-paper continuous">
                  <span className="verse-number">
                    {draft.items[draft.nextPosition]?.verse}
                  </span>
                  <div className="continuous-verse-copy">
                    <p>
                      {draft.items[draft.nextPosition]?.verseText ||
                        '말씀 본문을 불러오고 있어요.'}
                    </p>
                    {draft.items[draft.nextPosition + 1] &&
                      recordingMode === 'continuous' && (
                        <span className="next-verse-preview">
                          <small>
                            다음 말씀 ·{' '}
                            {draft.items[draft.nextPosition + 1].verse}절
                          </small>
                          <span>
                            {draft.items[draft.nextPosition + 1].verseText}
                          </span>
                        </span>
                      )}
                  </div>
                </article>
                <div
                  className={`waveform ${recording ? 'recording' : ''}`}
                  aria-hidden="true"
                >
                  {[16, 28, 42, 24, 51, 34, 46, 20, 38, 27, 44, 18].map(
                    (height, index) => (
                      <span key={index} style={{ height }} />
                    ),
                  )}
                </div>
                <div className="timer">
                  <span>{formatTime(seconds)}</span>
                  <small>
                    {recording
                      ? '실제 마이크 음성을 녹음하고 있어요'
                      : '버튼을 누르면 마이크 권한을 요청해요'}
                  </small>
                </div>
                {savingRecording ? (
                  <button className="gift-record-button" type="button" disabled><LoaderCircle className="spin" size={20} /> 녹음 저장 중</button>
                ) : recording && recordingMode === 'continuous' && (
                  <div className="continuous-record-actions">
                    <button
                      className="next"
                      type="button"
                      onClick={finishCurrentVerseAndContinue}
                    >
                      {draft.nextPosition === draft.items.length - 1
                        ? '마지막 절 완료'
                        : '다음 절로'}{' '}
                      <ArrowRight size={18} />
                    </button>
                    <button
                      className="finish"
                      type="button"
                      onClick={() => {
                        autoContinueRef.current = false;
                        recorderRef.current?.stop();
                      }}
                    >
                      <Pause size={18} /> 현재 절까지 저장
                    </button>
                  </div>
                )}
                {!savingRecording && recording && recordingMode === 'verse' && (
                  <button
                    className="gift-record-button"
                    type="button"
                    onClick={() => recorderRef.current?.stop()}
                  >
                    <Pause size={18} /> 이 절 저장
                  </button>
                )}
                {!savingRecording && !recording && (
                  <button
                    className="gift-record-button"
                    type="button"
                    onClick={() => void startRecording()}
                  >
                    <Mic size={22} />{' '}
                    {recordingMode === 'continuous'
                      ? `${draft.items[draft.nextPosition]?.verse}절부터 이어 녹음`
                      : '이 절 다시 녹음'}
                  </button>
                )}
              </div>
            )}
            <div className="gift-recording-sound">
              <div>
                <Music2 size={18} />
                <div>
                  <strong>배경음악</strong>
                  <small>녹음 전에 분위기와 음량을 확인해 보세요.</small>
                </div>
              </div>
              <select
                value={draft.bgmId}
                onChange={(event) => {
                  stopFullGiftPreview();
                  selectGiftBgm(event.target.value);
                }}
              >
                {GIFT_BGM_CATALOG.map((track) => (
                  <option value={track.id} key={track.id}>
                    {track.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={draft.bgmId === 'none'}
                onClick={() => void toggleBgmPreview()}
              >
                {bgmPlaying ? (
                  <>
                    <Pause size={15} /> BGM 일시정지
                  </>
                ) : (
                  <>
                    <Play size={15} /> BGM 미리 듣기
                  </>
                )}
              </button>
              {bgmPreviewError && (
                <small role="alert">
                  BGM을 재생할 수 없어요. 잠시 후 다시 시도해 주세요.
                </small>
              )}
              <label>
                <span>음량 {draft.bgmVolume}%</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={draft.bgmVolume}
                  onChange={(event) => {
                    if (bgmPreviewRef.current)
                      bgmPreviewRef.current.volume =
                        toAudibleBgmGain(Number(event.target.value));
                    if (fullPreviewBgmRef.current)
                      fullPreviewBgmRef.current.volume =
                        toAudibleBgmGain(Number(event.target.value));
                    void saveMusic(draft.bgmId, Number(event.target.value));
                  }}
                />
              </label>
            </div>
            {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- 녹음 본문이 화면에 함께 표시됩니다. */}
            <audio ref={fullPreviewVoiceRef} onEnded={handleFullPreviewEnded} />
            {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- 배경음악에는 음성 자막이 필요하지 않습니다. */}
            <audio ref={fullPreviewBgmRef} />
            <div className="gift-verse-list">
              {draft.items.map((item) => (
                <article
                  className={item.recorded ? 'recorded' : ''}
                  key={item.position}
                >
                  <span>
                    {item.recorded ? <Check size={15} /> : item.position + 1}
                  </span>
                  <div>
                    <strong>
                      {item.book} {item.chapter}:{item.verse}
                    </strong>
                    <small>{item.recorded ? '녹음 완료' : '녹음 대기'}</small>
                  </div>
                  {item.recorded && (
                    <>
                      <audio
                        ref={item.position === 0 ? previewRef : undefined}
                        controls
                        src={`/api/gift-drafts/${draft.id}/items/${item.position}/audio`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setDraft({ ...draft, nextPosition: item.position });
                          setRecordingMode('verse');
                          setStep('record');
                        }}
                      >
                        <RotateCcw size={14} /> 이 절 다시 녹음
                      </button>
                    </>
                  )}
                </article>
              ))}
            </div>
            <div className="gift-studio-actions">
              <button
                className="secondary"
                type="button"
                disabled={!progress?.recorded || recording || loading}
                onClick={() => setConfirmResetRecordings(true)}
              >
                <RotateCcw size={16} /> 처음부터 다시 녹음
              </button>
              <button
                className="secondary"
                type="button"
                disabled={!progress?.recorded}
                onClick={() => {
                  if (fullPreviewPlaying) {
                    fullPreviewVoiceRef.current?.pause();
                    fullPreviewBgmRef.current?.pause();
                    setFullPreviewPlaying(false);
                  } else if (fullPreviewVoiceRef.current?.src) {
                    void Promise.all([
                      fullPreviewVoiceRef.current.play(),
                      fullPreviewBgmRef.current?.src
                        ? fullPreviewBgmRef.current.play()
                        : Promise.resolve(),
                    ]).then(() => setFullPreviewPlaying(true));
                  } else {
                    void playFullGiftPreview();
                  }
                }}
              >
                {fullPreviewPlaying ? <Pause size={16} /> : <Play size={16} />}
                {fullPreviewPlaying ? '미리 듣기 일시정지' : '전체 미리 듣기'}
              </button>
              <button
                className="gift-studio-continue"
                type="button"
                disabled={!isGiftDraftSendable(draft.items)}
                onClick={() => setStep('music')}
              >
                <Music2 size={17} /> 음악 고르기
              </button>
            </div>
            {step === 'music' && (
              <div className="gift-music-panel">
                <h3>선물에 넣을 음악</h3>
                <p>곡을 고른 뒤 직접 들어보고, 선물에 담을 음량을 조절해 보세요.</p>
                <div className="music-list">
                  {GIFT_BGM_CATALOG.map((track) => (
                    <div className={`music-option ${draft.bgmId === track.id ? 'selected' : ''}`} key={track.id}>
                      <button className="music-select" type="button" onClick={() => selectGiftBgm(track.id)}>
                        <span className="music-icon">{track.id === 'none' ? '—' : 'recommended' in track && track.recommended ? <Sparkles size={15} /> : '♪'}</span>
                        <span>
                          <strong>{track.name}</strong>
                          <small>{track.description}</small>
                        </span>
                        <span className="radio-dot" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="bgm-transport" aria-label="배경음악 재생 조작">
                  <button className={bgmPlaying ? 'active' : ''} type="button" onClick={() => void playBgmPreview()} disabled={draft.bgmId === 'none' || bgmPlaying || bgmLoading} aria-label="배경음악 재생">
                    {bgmLoading ? <LoaderCircle className="spin" size={16} /> : <Play size={16} />}
                    <span>{bgmLoading ? '음악 준비 중' : bgmPlaying ? '재생 중' : '재생'}</span>
                  </button>
                  <button className={bgmPaused ? 'active' : ''} type="button" onClick={pauseBgmPreview} disabled={!bgmPlaying} aria-label="배경음악 일시정지">
                    <Pause size={16} /><span>{bgmPaused ? '멈춤 상태' : '일시정지'}</span>
                  </button>
                  <button type="button" onClick={stopBgmPreview} disabled={!bgmPlaying && !bgmPaused} aria-label="배경음악 정지">
                    <CircleStop size={16} /><span>정지</span>
                  </button>
                </div>
                {bgmPreviewError && <small role="alert">BGM을 재생할 수 없어요. 잠시 후 다시 시도해 주세요.</small>}
                <label className="volume-control">
                  <span><Volume2 size={17} /> 배경음악 음량 <strong>{draft.bgmVolume}%</strong></span>
                  <input
                    aria-label="선물 배경음악 음량"
                    type="range"
                    min="0"
                    max="100"
                    value={draft.bgmVolume}
                    disabled={draft.bgmId === 'none'}
                    onChange={(event) => {
                      const nextVolume = Number(event.target.value);
                      if (bgmPreviewRef.current) bgmPreviewRef.current.volume = toAudibleBgmGain(nextVolume);
                      void saveMusic(draft.bgmId, nextVolume);
                    }}
                  />
                </label>
                <GiftLetterComposer value={letter} disabled={loading} onChange={setLetter} />
                <button
                  className="gift-send-button"
                  type="button"
                  disabled={
                    sending || !draft.title.trim() || !isGiftDraftSendable(draft.items)
                  }
                  onClick={() => void send()}
                >
                  {sending ? <LoaderCircle className="spin" size={19} /> : <Send size={19} />} {sending ? `${selectedFriends.length}개 선물 포장 중` : `${selectedFriends.length}명에게 보내기`}
                </button>
              </div>
            )}
            {recordingManageOpen && (
              <div
                className="recording-manage-backdrop"
                role="presentation"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget)
                    setRecordingManageOpen(false);
                }}
              >
                <dialog
                  open
                  className="recording-manage-sheet"
                  aria-labelledby="gift-recording-manage-title"
                >
                  <button
                    className="recording-manage-close"
                    type="button"
                    aria-label="닫기"
                    onClick={() => setRecordingManageOpen(false)}
                  >
                    <X size={18} />
                  </button>
                  <p className="eyebrow">RECORDING MANAGE</p>
                  <h2 id="gift-recording-manage-title">
                    녹음을 어떻게 수정할까요?
                  </h2>
                  <p>
                    완료한 절 하나만 고쳐 녹음하거나, 모든 녹음을 지우고
                    처음부터 이어 읽을 수 있어요.
                  </p>
                  <div className="recording-manage-options">
                    <button
                      type="button"
                      onClick={() => setRecordingManageOpen(false)}
                    >
                      <span>
                        <Mic size={19} />
                      </span>
                      <div>
                        <strong>절별 수정</strong>
                        <small>
                          아래 녹음 목록에서 원하는 절의 ‘이 절 다시 녹음’을
                          눌러 주세요.
                        </small>
                      </div>
                    </button>
                    <button
                      className="full-retake"
                      type="button"
                      onClick={() => {
                        setRecordingManageOpen(false);
                        setConfirmResetRecordings(true);
                      }}
                    >
                      <span>
                        <RotateCcw size={19} />
                      </span>
                      <div>
                        <strong>처음부터 다시 녹음</strong>
                        <small>
                          지금까지 녹음한 선물 음성을 모두 지우고 첫 절부터
                          시작해요.
                        </small>
                      </div>
                    </button>
                  </div>
                </dialog>
              </div>
            )}
          </section>
        )}
        {friendPickerOpen && (
          <FriendPickerModal
            title="누구에게 선물할까요?"
            description="말씀 선물을 받을 친구를 최대 30명까지 선택해 주세요."
            multiple
            initialSelectedFriends={selectedFriends}
            onCancel={() => setFriendPickerOpen(false)}
            onSelect={(friend) => {
              setSelectedFriend(friend);
              setFriendPickerOpen(false);
            }}
            onSelectMany={(friends) => {
              setSelectedFriends(friends);
              setSelectedFriend(friends[0] ?? null);
              setFriendPickerOpen(false);
            }}
          />
        )}
        <aside className="gift-studio-summary">
          <div>
            <Gift size={20} />
            <h2>선물 꾸러미</h2>
          </div>
          <dl>
            <div>
              <dt>받을 친구</dt>
              <dd>
                {selectedFriends.length > 1 ? `${selectedFriends.length}명` : selectedFriend?.nickname ??
                  draft?.recipientNickname ??
                  '아직 선택하지 않았어요'}
              </dd>
            </div>
            <div>
              <dt>말씀</dt>
              <dd>
                {draft?.title ??
                  (initialScope ? '미리 고른 말씀' : '범위를 선택해 주세요')}
              </dd>
            </div>
            <div>
              <dt>녹음</dt>
              <dd>
                {progress
                  ? `${progress.recorded} / ${progress.total}절`
                  : '초안을 만들면 시작돼요'}
              </dd>
            </div>
            <div>
              <dt>배경음악</dt>
              <dd>
                {draft
                  ? (GIFT_BGM_CATALOG.find((track) => track.id === draft.bgmId)
                      ?.name ?? '음악 없음')
                  : '나중에 선택해요'}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
      <InProgressGifts gifts={drafts as InProgressGift[]} activeGiftId={draft?.id ?? null} onDelete={setConfirmDiscardDraft} onResume={(item) => {
        const target = drafts.find((candidate) => candidate.id === item.id);
        if (!target) return;
        void Promise.all([
          hydrateVerseTexts(target),
          fetch('/api/friends').then((response) => response.json() as Promise<{ friends?: FriendPickerPerson[] }>),
        ]).then(([hydratedDraft, friendsPayload]) => {
          const ids = target.recipientUserIds ?? (target.recipientUserId ? [target.recipientUserId] : []);
          const restoredFriends = ids.map((id) => friendsPayload.friends?.find((friend) => friend.userId === id)).filter((friend): friend is FriendPickerPerson => Boolean(friend));
          setSelectedFriends(restoredFriends);
          setSelectedFriend(restoredFriends[0] ?? null);
          setDraft(hydratedDraft);
          setRecordingMode('continuous');
          setStep(hydratedDraft.nextPosition == null ? 'preview' : 'record');
        });
      }} />
      {message && (
        <output className="gift-studio-message" aria-live="polite">
          {message}
        </output>
      )}
      {confirmResetRecordings && (
        <div className="gift-dialog-backdrop" role="presentation">
          <dialog className="gift-delete-dialog" open aria-labelledby="gift-reset-title">
            <button type="button" onClick={() => setConfirmResetRecordings(false)} aria-label="전체 재녹음 확인 닫기"><X size={20} /></button>
            <span><RotateCcw size={25} /></span>
            <h2 id="gift-reset-title">처음부터 다시 녹음할까요?</h2>
            <p>확정하면 지금까지 녹음한 선물 음성이 모두 삭제되고 복구할 수 없어요. 취소하면 녹음은 그대로 유지돼요.</p>
            <div>
              <button type="button" onClick={() => setConfirmResetRecordings(false)}>취소</button>
              <button className="delete" type="button" onClick={() => { setConfirmResetRecordings(false); void resetAllRecordings(); }}>모두 지우고 다시 녹음</button>
            </div>
          </dialog>
        </div>
      )}
      {confirmDiscardDraft && (
        <div className="gift-dialog-backdrop" role="presentation">
          <dialog className="gift-delete-dialog" open aria-labelledby="gift-draft-delete-title">
            <button type="button" onClick={() => setConfirmDiscardDraft(null)} aria-label="초안 삭제 확인 닫기"><X size={20} /></button>
            <span><Trash2 size={25} /></span>
            <h2 id="gift-draft-delete-title">‘{confirmDiscardDraft.title}’ 초안을 삭제할까요?</h2>
            <p>삭제하면 녹음도 함께 사라지고 복구할 수 없어요.</p>
            <div>
              <button type="button" onClick={() => setConfirmDiscardDraft(null)}>취소</button>
              <button className="delete" type="button" onClick={() => { const id = confirmDiscardDraft.id; setConfirmDiscardDraft(null); void discard(id); }}>초안 삭제</button>
            </div>
          </dialog>
        </div>
      )}
      {sendError && (
        <div className="gift-dialog-backdrop gift-send-error-backdrop" role="presentation">
          <dialog className="gift-send-error-dialog" open aria-labelledby="gift-send-error-title" aria-describedby="gift-send-error-description">
            <button className="gift-dialog-close" type="button" onClick={() => setSendError(null)} aria-label="전송 오류 닫기"><X size={21} /></button>
            <span className="gift-send-error-icon"><Gift size={27} /></span>
            <p className="eyebrow">선물을 보내지 못했어요</p>
            <h2 id="gift-send-error-title">먼저 이전 선물을 확인해 주세요</h2>
            <p id="gift-send-error-description">{sendError}</p>
            <div className="gift-send-error-actions">
              <button type="button" onClick={() => setSendError(null)}>확인</button>
              <button className="primary" type="button" onClick={() => { setSendError(null); window.location.hash = 'gifts'; }}>선물함 확인하기</button>
            </div>
          </dialog>
        </div>
      )}
      {sendSuccessGiftId && (
        <div className="gift-dialog-backdrop" role="presentation">
          <dialog
            className="gift-send-error-dialog"
            open
            aria-labelledby="gift-send-success-title"
          >
            <span className="gift-send-error-icon">
              <Gift size={27} />
            </span>
            <p className="eyebrow">선물 전송 완료</p>
            <h2 id="gift-send-success-title">선물을 보냈습니다!</h2>
            <div className="gift-send-error-actions gift-send-success-actions">
              <button
                className="primary"
                type="button"
                onClick={() => onSent(sendSuccessGiftId)}
              >
                확인
              </button>
            </div>
          </dialog>
        </div>
      )}
    </div>
  );
}
