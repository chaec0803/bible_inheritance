'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowRight,
  AudioLines,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  Cloud,
  Headphones,
  Home,
  List,
  LoaderCircle,
  Mic,
  Moon,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Sun,
  Target,
  Users,
  Volume2,
  X,
} from 'lucide-react';
import { bibleBooks, type BibleBook } from './bible-metadata';

const defaultVerses = [
  '여호와는 나의 목자시니 내게 부족함이 없으리로다.',
  '그가 나를 푸른 풀밭에 누이시며 쉴 만한 물가로 인도하시는도다.',
  '내 영혼을 소생시키시고 자기 이름을 위하여 의의 길로 인도하시는도다.',
  '내가 사망의 음침한 골짜기로 다닐지라도 해를 두려워하지 않을 것은 주께서 나와 함께 하심이라.',
  '주께서 내 원수의 목전에서 내게 상을 차려 주시고 기름을 내 머리에 부으셨으니 내 잔이 넘치나이다.',
  '내 평생에 선하심과 인자하심이 반드시 나를 따르리니 내가 여호와의 집에 영원히 살리로다.',
];

const reverbOptions = ['원음', '따뜻하게', '예배당'];

type ProjectTemplate = {
  id: string;
  duration: 7 | 14;
  level: '초보자' | '중급' | '고급';
  title: string;
  scope: string;
  minutes: string;
  tasks: string[];
  custom?: boolean;
};

type ActiveProject = {
  id: string;
  title: string;
  duration: number;
  scope: string;
  tasks: string[];
  totalVerses?: number;
  kind?: 'guided' | 'free';
  passage?: ProjectPassage;
};

type ProjectPassage = { code: string; name: string; chapter: number; startVerse: number; endVerse: number };

const projectTemplates: ProjectTemplate[] = [
  {
    id: 'psalm-23-beginner', duration: 7, level: '초보자', title: '시편 23편 완성하기', scope: '총 6절 · 하루 한 절', minutes: '하루 1–2분',
    tasks: ['시편 23편 1절', '시편 23편 2절', '시편 23편 3절', '시편 23편 4절', '시편 23편 5절', '시편 23편 6절', '전체 확인하고 완성하기'],
  },
  {
    id: 'hope-psalms-medium', duration: 7, level: '중급', title: '도움과 소망의 시편', scope: '시편 121편·130편 · 총 16절', minutes: '하루 3–5분',
    tasks: ['시편 121편 1–3절', '시편 121편 4–6절', '시편 121편 7–8절', '시편 130편 1–3절', '시편 130편 4–6절', '시편 130편 7–8절', '전체 확인하고 완성하기'],
  },
  {
    id: 'james-1-advanced', duration: 7, level: '고급', title: '야고보서 1장 완성하기', scope: '총 27절 · 하루 4–5절', minutes: '하루 6–10분',
    tasks: ['야고보서 1장 1–4절', '5–8절', '9–13절', '14–18절', '19–22절', '23–27절', '전체 확인하고 완성하기'],
  },
  {
    id: 'custom-7', duration: 7, level: '초보자', title: '내가 직접 프로젝트 만들기', scope: '원하는 범위를 6일 분량으로 자동 배정', minutes: '분량에 따라 자동 계산', tasks: [], custom: true,
  },
  {
    id: 'comfort-14-beginner', duration: 14, level: '초보자', title: '위로가 되는 말씀 12일', scope: '짧은 위로의 말씀 12개', minutes: '하루 1–2분',
    tasks: Array.from({ length: 12 }, (_, index) => `위로의 말씀 ${index + 1}`),
  },
  {
    id: 'sermon-medium', duration: 14, level: '중급', title: '산상수훈 핵심 말씀', scope: '마태복음 5장 · 하루 3–6절', minutes: '하루 4–7분',
    tasks: Array.from({ length: 12 }, (_, index) => `마태복음 5장 · ${index + 1}일차 분량`),
  },
  {
    id: 'philippians-advanced', duration: 14, level: '고급', title: '빌립보서 전체 완성하기', scope: '총 4장 · 하루 약 8–10절', minutes: '하루 8–12분',
    tasks: Array.from({ length: 12 }, (_, index) => `빌립보서 · ${index + 1}일차 분량`),
  },
  {
    id: 'custom-14', duration: 14, level: '초보자', title: '내가 직접 프로젝트 만들기', scope: '원하는 범위를 12일 분량으로 자동 배정', minutes: '분량에 따라 자동 계산', tasks: [], custom: true,
  },
];

type SupportedBibleBook = {
  id: string;
  name: string;
  chapterOffset?: number;
  verseCounts: number[];
};

const supportedBibleBooks: SupportedBibleBook[] = [
  { id: 'psalms', name: '시편', verseCounts: [6, 12, 8, 8, 12, 10, 17, 9, 20, 18, 7, 8, 6, 7, 5, 11, 15, 50, 14, 9, 13, 31, 6, 10, 22, 12, 14, 9, 11, 12, 24, 11, 22, 22, 28, 12, 40, 22, 13, 17, 13, 11, 5, 26, 17, 11, 9, 14, 20, 23, 19, 9, 6, 7, 23, 13, 11, 11, 17, 12, 8, 12, 11, 10, 13, 20, 7, 35, 36, 5, 24, 20, 28, 23, 10, 12, 20, 72, 13, 19, 16, 8, 18, 12, 13, 17, 7, 18, 52, 17, 16, 15, 5, 23, 11, 13, 12, 9, 9, 5, 8, 28, 22, 35, 45, 48, 43, 13, 31, 7, 10, 10, 9, 8, 18, 19, 2, 29, 176, 7, 8, 9, 4, 8, 5, 6, 5, 6, 8, 8, 3, 18, 3, 3, 21, 26, 9, 8, 24, 13, 10, 7, 12, 15, 21, 10, 20, 14, 9, 6] },
  { id: 'matthew', name: '마태복음', verseCounts: [25, 23, 17, 25, 48, 34, 29, 34, 38, 42, 30, 50, 58, 36, 39, 28, 27, 35, 30, 34, 46, 46, 39, 51, 46, 75, 66, 20] },
  { id: 'john', name: '요한복음', verseCounts: [51, 25, 36, 54, 47, 71, 53, 59, 41, 42, 57, 50, 38, 31, 27, 33, 26, 40, 42, 31, 25] },
  { id: 'philippians', name: '빌립보서', verseCounts: [30, 30, 21, 23] },
  { id: 'james', name: '야고보서', verseCounts: [27, 26, 18, 17, 20] },
];

type VersePointer = { chapter: number; verse: number };

function makeDailyTasks(book: SupportedBibleBook, start: VersePointer, end: VersePointer, days: number) {
  const verses: VersePointer[] = [];
  for (let chapter = start.chapter; chapter <= end.chapter; chapter += 1) {
    const firstVerse = chapter === start.chapter ? start.verse : 1;
    const lastVerse = chapter === end.chapter ? end.verse : book.verseCounts[chapter - 1];
    for (let verse = firstVerse; verse <= lastVerse; verse += 1) verses.push({ chapter, verse });
  }

  const taskCount = Math.min(days, verses.length);
  let cursor = 0;
  return Array.from({ length: taskCount }, (_, index) => {
    const size = Math.floor(verses.length / taskCount) + (index < verses.length % taskCount ? 1 : 0);
    const portion = verses.slice(cursor, cursor + size);
    cursor += size;
    const first = portion[0];
    const last = portion[portion.length - 1];
    const chapterNumber = (chapter: number) => chapter + (book.chapterOffset ?? 0);
    const reference = first.chapter === last.chapter
      ? `${book.name} ${chapterNumber(first.chapter)}장 ${first.verse}–${last.verse}절`
      : `${book.name} ${chapterNumber(first.chapter)}장 ${first.verse}절 ~ ${chapterNumber(last.chapter)}장 ${last.verse}절`;
    return { reference, count: portion.length };
  });
}

type BgmOption = {
  id: string;
  name: string;
  description: string;
  videoId: string | null;
  startSeconds: number;
  recommended?: boolean;
};

const bgmOptions: readonly BgmOption[] = [
  {
    id: 'still-waters',
    name: '고요한 물가',
    description: '잔잔한 묵상 피아노',
    videoId: 'DBVSSzzSlVw',
    startSeconds: 3371,
  },
  {
    id: 'peaceful-morning',
    name: '평안한 아침',
    description: '따뜻한 아침의 선율',
    videoId: 'WDkUGO7qWOQ',
    startSeconds: 0,
  },
  {
    id: 'word-breath',
    name: '말씀의 숨결',
    description: 'AI 추천 · 시편 23편과 어울리는 음악',
    videoId: 'TkodnfN4kUQ',
    startSeconds: 0,
    recommended: true,
  },
  {
    id: 'none',
    name: '음악 없음',
    description: '목소리만 녹음',
    videoId: null,
    startSeconds: 0,
  },
];

type WordCard = {
  id: string;
  name: string;
  heading: string;
  detail: string;
  spriteIndex: number;
};

const wordCards: readonly WordCard[] = [
  { id: 'jacob', name: '야곱', heading: '붙들고 씨름하며 새 이름을 받은 사람', detail: '야곱은 부족함과 실수 속에서도 하나님의 약속을 놓지 않았어요. 하나님은 그에게 이스라엘이라는 새 이름을 주시고, 한 민족의 시작이 되게 하셨어요.', spriteIndex: 0 },
  { id: 'jesus', name: '예수님', heading: '사랑으로 우리에게 가장 가까이 오신 구원자', detail: '예수님은 하나님의 사랑을 삶으로 보여 주시고, 아픈 사람을 고치며 소외된 이들을 품으셨어요. 십자가와 부활을 통해 모든 사람에게 구원의 길을 열어 주셨어요.', spriteIndex: 1 },
  { id: 'peter', name: '베드로', heading: '넘어져도 다시 부르심을 따라간 제자', detail: '베드로는 성급하고 두려움도 많았지만 예수님의 용서와 격려로 다시 일어났어요. 이후 복음을 담대하게 전하며 초대 교회를 든든히 세웠어요.', spriteIndex: 2 },
  { id: 'god', name: '하나님', heading: '세상을 지으시고 끝까지 사랑하시는 분', detail: '하나님은 모든 생명의 창조자이며 약속을 지키시는 분이에요. 성경 전체를 통해 사람을 찾고 회복시키며 선한 길로 이끄시는 사랑을 보여 주세요.', spriteIndex: 3 },
  { id: 'holy-spirit', name: '성령님', heading: '우리와 함께하며 힘과 지혜를 주시는 분', detail: '성령님은 믿는 사람 안에 함께하시며 예수님의 말씀을 기억하게 하세요. 두려울 때 용기를 주고, 사랑과 기쁨과 평화의 열매를 맺도록 도와주세요.', spriteIndex: 4 },
  { id: 'david', name: '다윗', heading: '하나님의 마음을 노래한 목동이자 왕', detail: '다윗은 작은 목동이었지만 하나님을 신뢰하며 골리앗 앞에 섰어요. 왕이 된 뒤에도 기쁨과 슬픔, 회개와 소망을 시편의 노래로 남겼어요.', spriteIndex: 5 },
  { id: 'goliath', name: '골리앗', heading: '크기보다 믿음이 더 강하다는 것을 보여 준 거인', detail: '골리앗은 강한 무기와 큰 몸을 자랑했지만, 하나님을 의지한 다윗 앞에서 무너졌어요. 이 이야기는 눈앞의 크기보다 믿음의 방향이 중요하다는 것을 보여 줘요.', spriteIndex: 6 },
  { id: 'samson', name: '삼손', heading: '큰 힘과 함께 책임도 배워야 했던 사사', detail: '삼손은 이스라엘을 돕도록 특별한 힘을 받았지만 자신의 선택 때문에 어려움을 겪었어요. 마지막 순간 하나님을 다시 찾으며 맡겨진 힘의 의미를 깨달았어요.', spriteIndex: 7 },
  { id: 'mary', name: '마리아', heading: '두려움 속에서도 믿음으로 응답한 사람', detail: '마리아는 놀라운 소식을 들었을 때 모든 것을 다 알 수 없었지만 하나님을 믿고 순종했어요. 예수님의 어머니로서 약속을 마음에 간직하며 길을 걸었어요.', spriteIndex: 8 },
  { id: 'magi', name: '동방박사들', heading: '별을 따라 먼 길을 걸어온 예배자들', detail: '동방박사들은 새 왕의 탄생을 알리는 별을 보고 먼 길을 떠났어요. 아기 예수님을 만나 기뻐하며 귀한 예물을 드리고 경배했어요.', spriteIndex: 9 },
  { id: 'magi-1', name: '동방박사 1', heading: '왕을 위한 황금을 준비한 지혜로운 여행자', detail: '황금은 왕에게 드리는 귀한 예물이었어요. 이 박사는 긴 여정 끝에 예수님을 참된 왕으로 높이며 자신의 가장 귀한 것을 기쁨으로 드렸어요.', spriteIndex: 10 },
  { id: 'magi-2', name: '동방박사 2', heading: '예배의 향기인 유향을 들고 온 여행자', detail: '유향은 하나님께 예배할 때 사용하던 향이었어요. 이 박사의 선물은 아기 예수님께 드리는 경배와 존경을 담고 있어요.', spriteIndex: 11 },
  { id: 'magi-3', name: '동방박사 3', heading: '깊은 의미를 품은 몰약을 준비한 여행자', detail: '몰약은 매우 귀한 향품이었어요. 이 선물은 예수님의 삶과 희생을 미리 떠올리게 하며, 동방박사들의 진심 어린 경배를 보여 줘요.', spriteIndex: 12 },
];

type RecordingTake = {
  url: string;
  blob: Blob;
  mimeType: string;
  duration: number;
};

type SavedRecording = {
  id: string;
  projectId: string;
  projectTitle: string;
  book: string;
  chapter: number;
  verse: number;
  verseText: string;
  bgmId: string;
  reverb: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number;
  createdAt: number;
};

type YouTubePlayer = {
  destroy: () => void;
  loadVideoById: (options: {
    videoId: string;
    startSeconds: number;
    endSeconds?: number;
  }) => void;
  setVolume: (volume: number) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
};

type YouTubeNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      height: string;
      width: string;
      videoId: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: (event: { target: YouTubePlayer }) => void;
        onStateChange: (event: { data: number }) => void;
      };
    },
  ) => YouTubePlayer;
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function formatSavedDate(timestamp: number) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

async function fetchLibrary(ownerKey: string) {
  const response = await fetch('/api/recordings', {
    headers: { 'x-verse-legacy-owner': ownerKey },
  });
  if (!response.ok) throw new Error('보관함을 불러오지 못했어요.');
  const payload = (await response.json()) as { recordings: SavedRecording[] };
  return payload.recordings;
}

function getSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return (
    ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find((type) =>
      MediaRecorder.isTypeSupported(type),
    ) ?? ''
  );
}

function createRecordingAudioGraph(stream: MediaStream, reverb: string) {
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const highPass = context.createBiquadFilter();
  const leveler = context.createDynamicsCompressor();
  const makeupGain = context.createGain();
  const dryGain = context.createGain();
  const mix = context.createGain();
  const limiter = context.createDynamicsCompressor();
  const destination = context.createMediaStreamDestination();

  highPass.type = 'highpass';
  highPass.frequency.value = 70;
  highPass.Q.value = 0.7;

  // Gentle speech levelling keeps softly and loudly read verses closer together.
  leveler.threshold.value = -30;
  leveler.knee.value = 24;
  leveler.ratio.value = 5;
  leveler.attack.value = 0.008;
  leveler.release.value = 0.28;
  makeupGain.gain.value = 1.3;
  dryGain.gain.value = reverb === '원음' ? 1 : 0.94;

  // The final limiter protects the recorded file from clipping after make-up gain.
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.12;

  source.connect(highPass);
  highPass.connect(leveler);
  leveler.connect(makeupGain);
  makeupGain.connect(dryGain);
  dryGain.connect(mix);

  if (reverb !== '원음') {
    const convolver = context.createConvolver();
    const wetGain = context.createGain();
    const duration = reverb === '예배당' ? 1.8 : 0.55;
    const decay = reverb === '예배당' ? 3.4 : 7;
    const impulse = context.createBuffer(2, Math.ceil(context.sampleRate * duration), context.sampleRate);

    for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
      const samples = impulse.getChannelData(channel);
      for (let index = 0; index < samples.length; index += 1) {
        const envelope = Math.pow(1 - index / samples.length, decay);
        samples[index] = (Math.random() * 2 - 1) * envelope;
      }
    }

    convolver.buffer = impulse;
    wetGain.gain.value = reverb === '예배당' ? 0.22 : 0.1;
    makeupGain.connect(convolver);
    convolver.connect(wetGain);
    wetGain.connect(mix);
  }

  mix.connect(limiter);
  limiter.connect(destination);

  return { context, stream: destination.stream };
}

export default function HomePage() {
  const [verseIndex, setVerseIndex] = useState(0);
  const [passageBook, setPassageBook] = useState({ code: '시', name: '시편' });
  const [passageChapter, setPassageChapter] = useState(23);
  const [passageStartVerse, setPassageStartVerse] = useState(1);
  const [passageVerses, setPassageVerses] = useState(defaultVerses);
  const [recording, setRecording] = useState(false);
  const [requestingMic, setRequestingMic] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [takes, setTakes] = useState<(RecordingTake | null)[]>(() => defaultVerses.map(() => null));
  const [saved, setSaved] = useState<boolean[]>(() => defaultVerses.map(() => false));
  const [reverb, setReverb] = useState('따뜻하게');
  const [bgm, setBgm] = useState('still-waters');
  const [volume, setVolume] = useState(12);
  const [notice, setNotice] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [playerReady, setPlayerReady] = useState(false);
  const [activePreview, setActivePreview] = useState<string | null>(null);
  const [bgmPaused, setBgmPaused] = useState(false);
  const [headphoneWarningOpen, setHeadphoneWarningOpen] = useState(false);
  const [earnedCard, setEarnedCard] = useState<WordCard | null>(null);
  const [wordCardFlipped, setWordCardFlipped] = useState(false);
  const [wordCardExpanded, setWordCardExpanded] = useState(false);
  const [libraryRecordings, setLibraryRecordings] = useState<SavedRecording[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [savingLibrary, setSavingLibrary] = useState(false);
  const [deletingRecordingId, setDeletingRecordingId] = useState<string | null>(null);
  const [savedRecordingPlaying, setSavedRecordingPlaying] = useState(false);
  const [activeLibraryId, setActiveLibraryId] = useState<string | null>(null);
  const [ownerKey, setOwnerKey] = useState('');
  const [chapterPlaying, setChapterPlaying] = useState(false);
  const [appTab, setAppTab] = useState<'recording' | 'library'>('recording');
  const [selectedLibraryChapter, setSelectedLibraryChapter] = useState<string | null>(null);
  const [selectedLibraryRecordingId, setSelectedLibraryRecordingId] = useState<string | null>(null);
  const [libraryChapterMenuOpen, setLibraryChapterMenuOpen] = useState(false);
  const [replacingRecording, setReplacingRecording] = useState<SavedRecording | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<'welcome' | 'projectHome' | 'projects' | 'bible' | 'schedule' | 'app'>('welcome');
  const [bibleBackTarget, setBibleBackTarget] = useState<'welcome' | 'app'>('welcome');
  const [returningHome, setReturningHome] = useState(false);
  const [projectDuration, setProjectDuration] = useState<7 | 14>(7);
  const [selectedTemplateId, setSelectedTemplateId] = useState('psalm-23-beginner');
  const [customProjectName, setCustomProjectName] = useState('나의 말씀 프로젝트');
  const [customBookId, setCustomBookId] = useState('psalms');
  const [customStartChapter, setCustomStartChapter] = useState(1);
  const [customStartVerse, setCustomStartVerse] = useState(1);
  const [customEndChapter, setCustomEndChapter] = useState(1);
  const [customEndVerse, setCustomEndVerse] = useState(6);
  const [activeProject, setActiveProject] = useState<ActiveProject | null>(null);
  const [activeProjects, setActiveProjects] = useState<ActiveProject[]>([]);
  const [bibleTestament, setBibleTestament] = useState<'old' | 'new'>('old');
  const [bibleSearch, setBibleSearch] = useState('');
  const [selectedBibleBook, setSelectedBibleBook] = useState<BibleBook>(bibleBooks[0]);
  const [selectedBibleChapter, setSelectedBibleChapter] = useState(1);
  const [selectedBibleVerses, setSelectedBibleVerses] = useState<string[]>([]);
  const [bibleLoading, setBibleLoading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingAudioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const recordingStartedAtRef = useRef(0);
  const objectUrlsRef = useRef(new Set<string>());
  const youtubeContainerRef = useRef<HTMLDivElement | null>(null);
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const ownerKeyRef = useRef('');
  const libraryAudioRefs = useRef(new Map<string, HTMLAudioElement>());
  const savedRecordingAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeLibraryRef = useRef<string | null>(null);
  const chapterPlayingRef = useRef(false);
  const chapterBgmIdRef = useRef<string | null>(null);
  const bibleVersePaneRef = useRef<HTMLElement | null>(null);

  const currentTake = takes[verseIndex];
  const currentVerseNumber = passageStartVerse + verseIndex;
  const hasTake = Boolean(currentTake);

  useEffect(() => {
    const completed = window.localStorage.getItem('verse-legacy-onboarding-complete') === 'true';
    const savedProjectId = window.localStorage.getItem('verse-legacy-project');
    const savedFreePassage = window.localStorage.getItem('verse-legacy-free-passage');
    const savedActiveProjects = window.localStorage.getItem('verse-legacy-active-projects');
    const frame = window.requestAnimationFrame(() => {
      let restoredProjects: ActiveProject[] = [];
      if (savedActiveProjects) {
        try {
          const parsedProjects = JSON.parse(savedActiveProjects) as ActiveProject[];
          const latestFreeProject = [...parsedProjects].reverse().find((project) => project.kind === 'free');
          restoredProjects = [
            ...parsedProjects.filter((project) => project.kind !== 'free'),
            ...(latestFreeProject ? [{ ...latestFreeProject, id: 'free-recording', title: '자유 녹음' }] : []),
          ];
          setActiveProjects(restoredProjects);
          window.localStorage.setItem('verse-legacy-active-projects', JSON.stringify(restoredProjects));
        } catch {
          window.localStorage.removeItem('verse-legacy-active-projects');
        }
      }
      if (savedProjectId) {
        setSelectedTemplateId(savedProjectId);
        const template = projectTemplates.find((item) => item.id === savedProjectId);
        const restoredActiveProject = restoredProjects.find((item) => item.id === savedProjectId)
          ?? (savedProjectId.startsWith('free-') ? restoredProjects.find((item) => item.kind === 'free') : undefined);
        if (restoredActiveProject) {
          setActiveProject(restoredActiveProject);
          window.localStorage.setItem('verse-legacy-project', restoredActiveProject.id);
        } else
        if (template?.custom) {
          const savedCustomProject = window.localStorage.getItem('verse-legacy-custom-project');
          if (savedCustomProject) {
            try {
              const customProject = JSON.parse(savedCustomProject) as ActiveProject;
              setActiveProject(customProject);
              setActiveProjects([customProject]);
            } catch {
              window.localStorage.removeItem('verse-legacy-custom-project');
            }
          }
        } else if (template) {
          const restoredProject = { id: template.id, title: template.title, duration: template.duration, scope: template.scope, tasks: template.tasks };
          setActiveProject(restoredProject);
          setActiveProjects((current) => current.length ? current : [restoredProject]);
        }
      }
      if (!savedProjectId && savedFreePassage) {
        try {
          const passage = JSON.parse(savedFreePassage) as { code: string; name: string; chapter: number };
          fetch(`/data/bible/${encodeURIComponent(passage.code)}.json`)
            .then((response) => response.json() as Promise<string[][]>)
            .then((chapters) => {
              const chapterVerses = chapters[passage.chapter - 1];
              if (!chapterVerses?.length) return;
              setPassageBook({ code: passage.code, name: passage.name });
              setPassageChapter(passage.chapter);
              setPassageVerses(chapterVerses);
              setTakes(chapterVerses.map(() => null));
              setSaved(chapterVerses.map(() => false));
            })
            .catch(() => undefined);
        } catch {
          window.localStorage.removeItem('verse-legacy-free-passage');
        }
      }
      if (completed) setOnboardingStep('app');
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!recording) return;
    const interval = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [recording]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('verse-legacy-theme');
    const preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const initialTheme = savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : preferredTheme;
    const frame = window.requestAnimationFrame(() => setTheme(initialTheme));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('verse-legacy-theme', theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    let ownerKey = window.localStorage.getItem('verse-legacy-owner') ?? '';
    if (!/^[a-f0-9-]{20,80}$/i.test(ownerKey)) {
      ownerKey = crypto.randomUUID();
      window.localStorage.setItem('verse-legacy-owner', ownerKey);
    }
    ownerKeyRef.current = ownerKey;
    queueMicrotask(() => {
      if (!cancelled) setOwnerKey(ownerKey);
    });

    fetchLibrary(ownerKey)
      .then((recordings) => {
        if (cancelled) return;
        setLibraryRecordings(recordings);
        setSaved(passageVerses.map((_, index) => recordings.some((item) => (!activeProject || item.projectId === activeProject.id || (activeProject.kind === 'free' && item.projectId.startsWith('free-'))) && item.book === passageBook.name && item.chapter === passageChapter && item.verse === passageStartVerse + index)));
      })
      .catch(() => {
        if (!cancelled) setNotice('보관함 연결을 준비하고 있어요. 잠시 후 다시 시도해 주세요.');
      })
      .finally(() => {
        if (!cancelled) setLibraryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeProject, passageBook.name, passageChapter, passageStartVerse, passageVerses]);

  useEffect(() => {
    let disposed = false;
    const previousReadyHandler = window.onYouTubeIframeAPIReady;

    const createPlayer = () => {
      if (disposed || !youtubeContainerRef.current || !window.YT?.Player || youtubePlayerRef.current) return;
      youtubePlayerRef.current = new window.YT.Player(youtubeContainerRef.current, {
        height: '158',
        width: '100%',
        videoId: bgmOptions[0].videoId ?? '',
        playerVars: {
          controls: 0,
          disablekb: 1,
          playsinline: 1,
          rel: 0,
          start: bgmOptions[0].startSeconds,
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(12);
            event.target.stopVideo();
            setPlayerReady(true);
          },
          onStateChange: (event) => {
            if (event.data === 0) {
              setActivePreview(null);
              setBgmPaused(false);
            }
            if (event.data === 1) setBgmPaused(false);
            if (event.data === 2) setBgmPaused(true);
          },
        },
      });
    };

    if (window.YT?.Player) {
      createPlayer();
    } else {
      window.onYouTubeIframeAPIReady = () => {
        previousReadyHandler?.();
        createPlayer();
      };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        document.head.appendChild(script);
      }
    }

    return () => {
      disposed = true;
      if (typeof youtubePlayerRef.current?.destroy === 'function') youtubePlayerRef.current.destroy();
      youtubePlayerRef.current = null;
      window.onYouTubeIframeAPIReady = previousReadyHandler;
    };
  }, []);

  useEffect(() => {
    if (typeof youtubePlayerRef.current?.setVolume === 'function') youtubePlayerRef.current.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;
    return () => {
      discardRecordingRef.current = true;
      if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      void recordingAudioContextRef.current?.close();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const completedCount = saved.filter(Boolean).length;
  const progress = useMemo(
    () => Math.round((completedCount / passageVerses.length) * 100),
    [completedCount, passageVerses.length],
  );
  const currentPassageComplete = passageVerses.length > 0 && saved.length === passageVerses.length && saved.every(Boolean);
  const activeLibraryRecordings = useMemo(
    () => activeProject ? libraryRecordings.filter((item) => item.projectId === activeProject.id || (activeProject.kind === 'free' && item.projectId.startsWith('free-'))) : libraryRecordings,
    [activeProject, libraryRecordings],
  );
  const currentSavedRecording = activeLibraryRecordings.find((item) => item.book === passageBook.name && item.chapter === passageChapter && item.verse === currentVerseNumber) ?? null;
  const completedProjectTaskIndexes = useMemo(() => {
    const completed = new Set<number>();
    if (!activeProject || activeProject.kind === 'free') return completed;

    const recorded = new Set(activeLibraryRecordings.map((item) => `${item.book}-${item.chapter}-${item.verse}`));
    let currentBook = '';
    let currentChapter = 0;

    activeProject.tasks.forEach((task, index) => {
      if (task.includes('전체 확인') || task.includes('밀린 녹음')) {
        if (index > 0 && Array.from({ length: index }, (_, taskIndex) => completed.has(taskIndex)).every(Boolean)) completed.add(index);
        return;
      }

      const fullReference = task.match(/^(.+?)\s+(\d+)(?:장|편)\s+(\d+)(?:–(\d+))?절(?:\s*~\s*(\d+)장\s+(\d+)절)?/);
      const shortReference = task.match(/^(\d+)(?:–(\d+))절/);
      if (fullReference) {
        currentBook = fullReference[1];
        currentChapter = Number(fullReference[2]);
      }
      if (!fullReference && !shortReference) return;

      const startChapter = fullReference ? Number(fullReference[2]) : currentChapter;
      const startVerse = Number(fullReference?.[3] ?? shortReference?.[1]);
      const endChapter = Number(fullReference?.[5] ?? startChapter);
      const endVerse = Number(fullReference?.[6] ?? fullReference?.[4] ?? shortReference?.[2] ?? startVerse);
      if (!currentBook || !startChapter || !startVerse) return;

      const bookMetadata = supportedBibleBooks.find((book) => book.name === currentBook);
      const required: string[] = [];
      for (let chapter = startChapter; chapter <= endChapter; chapter += 1) {
        const metadataChapter = chapter - (bookMetadata?.chapterOffset ?? 0);
        const firstVerse = chapter === startChapter ? startVerse : 1;
        const lastVerse = chapter === endChapter ? endVerse : bookMetadata?.verseCounts[metadataChapter - 1] ?? 0;
        for (let verse = firstVerse; verse <= lastVerse; verse += 1) required.push(`${currentBook}-${chapter}-${verse}`);
      }
      if (required.length > 0 && required.every((reference) => recorded.has(reference))) completed.add(index);
    });

    if (currentPassageComplete) completed.add(0);

    return completed;
  }, [activeLibraryRecordings, activeProject, currentPassageComplete]);
  const freeRecordingChapterKeys = useMemo(() => new Set(
    libraryRecordings
      .filter((item) => item.projectId === 'free-recording' || item.projectId.startsWith('free-'))
      .map((item) => `${item.book}-${item.chapter}`),
  ), [libraryRecordings]);
  const freeRecordingBookNames = useMemo(() => new Set(
    libraryRecordings
      .filter((item) => item.projectId === 'free-recording' || item.projectId.startsWith('free-'))
      .map((item) => item.book),
  ), [libraryRecordings]);
  const activeProjectIds = useMemo(() => new Set(activeProjects.map((project) => project.id)), [activeProjects]);
  const guidedProjects = activeProjects.filter((project) => project.kind !== 'free');
  const libraryChapterGroups = useMemo(() => {
    const groups = new Map<string, { key: string; book: string; chapter: number; recordings: SavedRecording[]; updatedAt: number }>();
    activeLibraryRecordings.forEach((item) => {
      const key = `${item.book}-${item.chapter}`;
      const group = groups.get(key) ?? { key, book: item.book, chapter: item.chapter, recordings: [], updatedAt: item.createdAt };
      group.recordings.push(item);
      group.updatedAt = Math.max(group.updatedAt, item.createdAt);
      groups.set(key, group);
    });
    return [...groups.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [activeLibraryRecordings]);
  const projectChapterOptions = useMemo(() => {
    const references = new Map<string, { key: string; book: string; chapter: number }>();
    const addReference = (book: string, chapter: number) => {
      const key = `${book}-${chapter}`;
      references.set(key, { key, book, chapter });
    };

    if (activeProject?.passage) addReference(activeProject.passage.name, activeProject.passage.chapter);
    activeProject?.tasks.forEach((task) => {
      const matches = task.matchAll(/([가-힣]+)\s+(\d+)(?:장|편)/g);
      for (const match of matches) addReference(match[1], Number(match[2]));
    });

    if (activeProject?.id.startsWith('custom-')) {
      const grouped = new Map<string, number[]>();
      references.forEach((reference) => grouped.set(reference.book, [...(grouped.get(reference.book) ?? []), reference.chapter]));
      grouped.forEach((chapters, book) => {
        for (let chapter = Math.min(...chapters); chapter <= Math.max(...chapters); chapter += 1) addReference(book, chapter);
      });
    }

    if (activeProject?.id === 'philippians-advanced') {
      for (let chapter = 1; chapter <= 4; chapter += 1) addReference('빌립보서', chapter);
    }

    libraryChapterGroups.forEach((group) => addReference(group.book, group.chapter));
    if (!references.size && activeProject) {
      const fallbacks: Record<string, { name: string; chapter: number }> = {
        'comfort-14-beginner': { name: '시편', chapter: 34 },
        'sermon-medium': { name: '마태복음', chapter: 5 },
        'philippians-advanced': { name: '빌립보서', chapter: 1 },
      };
      const fallback = fallbacks[activeProject.id] ?? { name: '시편', chapter: 23 };
      addReference(fallback.name, fallback.chapter);
    }

    const bibleOrder = new Map(bibleBooks.map((book, index) => [book.name, index]));
    return [...references.values()]
      .map((reference) => ({ ...reference, hasRecording: libraryChapterGroups.some((group) => group.key === reference.key) }))
      .sort((a, b) => (bibleOrder.get(a.book) ?? 999) - (bibleOrder.get(b.book) ?? 999) || a.chapter - b.chapter);
  }, [activeProject, libraryChapterGroups]);
  const selectedLibraryGroup = libraryChapterGroups.find((group) => group.key === selectedLibraryChapter) ?? libraryChapterGroups[0] ?? null;
  const chapterQueue = useMemo(() => {
    const latestByVerse = new Map<number, SavedRecording>();
    selectedLibraryGroup?.recordings.forEach((item) => {
      if (!latestByVerse.has(item.verse)) latestByVerse.set(item.verse, item);
    });
    return [...latestByVerse.values()].sort((a, b) => a.verse - b.verse);
  }, [selectedLibraryGroup]);
  const selectedLibraryVerseCount = useMemo(() => {
    if (!selectedLibraryGroup) return 0;
    const book = bibleBooks.find((item) => item.name === selectedLibraryGroup.book);
    return book?.chapters[selectedLibraryGroup.chapter - 1] ?? Math.max(0, ...chapterQueue.map((item) => item.verse));
  }, [chapterQueue, selectedLibraryGroup]);
  const selectedLibraryRecording = chapterQueue.find((item) => item.id === selectedLibraryRecordingId) ?? null;
  const currentlyPlayingRecording = chapterQueue.find((item) => item.id === activeLibraryId) ?? null;

  const refreshLibrary = async () => {
    const recordings = await fetchLibrary(ownerKeyRef.current);
    setLibraryRecordings(recordings);
    setSaved(passageVerses.map((_, index) => recordings.some((item) => (!activeProject || item.projectId === activeProject.id || (activeProject.kind === 'free' && item.projectId.startsWith('free-'))) && item.book === passageBook.name && item.chapter === passageChapter && item.verse === passageStartVerse + index)));
    return recordings;
  };

  const awardDailyWordCard = (recordings: SavedRecording[]) => {
    if (!activeProject || activeProject.kind === 'free') return;
    const completedToday = passageVerses.every((_, index) => recordings.some((item) => item.projectId === activeProject.id && item.book === passageBook.name && item.chapter === passageChapter && item.verse === passageStartVerse + index));
    if (!completedToday) return;

    const storageKey = 'verse-legacy-word-card-awards';
    const awardKey = `${activeProject.id}:day-1`;
    let awards: { key: string; cardId: string }[] = [];
    try {
      awards = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]') as { key: string; cardId: string }[];
    } catch {
      awards = [];
    }
    if (awards.some((award) => award.key === awardKey)) return;

    const ownedIds = new Set(awards.map((award) => award.cardId));
    const availableCards = wordCards.filter((card) => !ownedIds.has(card.id));
    const pool = availableCards.length ? availableCards : wordCards;
    const card = pool[Math.floor(Math.random() * pool.length)];
    window.localStorage.setItem(storageKey, JSON.stringify([...awards, { key: awardKey, cardId: card.id }]));
    setWordCardFlipped(false);
    setWordCardExpanded(false);
    setEarnedCard(card);
  };

  const stopLibraryPlayback = (recordingId?: string) => {
    if (recordingId && activeLibraryRef.current !== recordingId) return;
    youtubePlayerRef.current?.stopVideo();
    activeLibraryRef.current = null;
    setActiveLibraryId(null);
    setActivePreview(null);
    setBgmPaused(false);
  };

  const stopChapterPlayback = () => {
    chapterPlayingRef.current = false;
    chapterBgmIdRef.current = null;
    setChapterPlaying(false);
    libraryAudioRefs.current.forEach((audio) => {
      if (!audio.paused) audio.pause();
    });
    savedRecordingAudioRef.current?.pause();
    setSavedRecordingPlaying(false);
    stopLibraryPlayback();
  };

  const openRecordingTab = () => {
    stopChapterPlayback();
    setAppTab('recording');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openLibraryTab = () => {
    stopChapterPlayback();
    savedRecordingAudioRef.current?.pause();
    setSavedRecordingPlaying(false);
    setAppTab('library');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openLibraryVerse = (recording: SavedRecording) => {
    stopChapterPlayback();
    setSelectedLibraryChapter(`${recording.book}-${recording.chapter}`);
    setSelectedLibraryRecordingId(recording.id);
    setLibraryChapterMenuOpen(false);
    window.setTimeout(() => document.querySelector(`#library-recording-${recording.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
  };

  const stopPreview = () => {
    youtubePlayerRef.current?.stopVideo();
    setActivePreview(null);
    setBgmPaused(false);
  };

  const playLibraryBgm = (recording: SavedRecording) => {
    activeLibraryRef.current = recording.id;
    setActiveLibraryId(recording.id);
    libraryAudioRefs.current.forEach((audio, id) => {
      if (id !== recording.id && !audio.paused) audio.pause();
    });

    if (!chapterPlayingRef.current) {
      youtubePlayerRef.current?.stopVideo();
      setActivePreview(null);
      return;
    }

    const playbackBgmId = chapterBgmIdRef.current ?? recording.bgmId;
    const option = bgmOptions.find((item) => item.id === playbackBgmId);
    if (!option?.videoId) {
      youtubePlayerRef.current?.stopVideo();
      setActivePreview(null);
      return;
    }
    if (!playerReady || !youtubePlayerRef.current) {
      setNotice('목소리는 재생 중이에요. BGM 플레이어가 준비되면 다시 재생해 주세요.');
      return;
    }

    if (chapterPlayingRef.current && activePreview === `chapter-${playbackBgmId}`) return;

    youtubePlayerRef.current.setVolume(volume);
    youtubePlayerRef.current.loadVideoById({
      videoId: option.videoId,
      startSeconds: option.startSeconds,
    });
    setActivePreview(chapterPlayingRef.current ? `chapter-${playbackBgmId}` : `library-${recording.id}`);
    setBgmPaused(false);
  };

  const startChapterPlayback = () => {
    if (chapterQueue.length === 0) return;
    libraryAudioRefs.current.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    stopPreview();
    const first = chapterQueue[0];
    chapterPlayingRef.current = true;
    chapterBgmIdRef.current = bgm;
    setChapterPlaying(true);
    playLibraryBgm(first);
    window.setTimeout(() => {
      void libraryAudioRefs.current.get(first.id)?.play();
    }, 0);
  };

  const handleLibraryEnded = (recordingId: string) => {
    if (!chapterPlayingRef.current) {
      stopLibraryPlayback(recordingId);
      return;
    }

    const currentIndex = chapterQueue.findIndex((item) => item.id === recordingId);
    const next = chapterQueue[currentIndex + 1];
    if (!next) {
      stopChapterPlayback();
      setNotice(`${selectedLibraryGroup?.book ?? passageBook.name} ${selectedLibraryGroup?.chapter ?? passageChapter}${selectedLibraryGroup?.book === '시편' ? '편' : '장'} 이어듣기를 모두 마쳤어요.`);
      return;
    }

    const nextAudio = libraryAudioRefs.current.get(next.id);
    if (!nextAudio) {
      stopChapterPlayback();
      return;
    }
    nextAudio.currentTime = 0;
    void nextAudio.play();
  };

  const playSelectedBgm = (option: BgmOption) => {
    if (activeLibraryRef.current) {
      libraryAudioRefs.current.get(activeLibraryRef.current)?.pause();
      stopLibraryPlayback();
    }
    if (!option.videoId) {
      stopPreview();
      return;
    }
    if (!playerReady || !youtubePlayerRef.current) {
      setNotice('배경음악을 준비하고 있어요. 잠시 후 다시 눌러 주세요.');
      return;
    }

    youtubePlayerRef.current.setVolume(volume);
    if (activePreview === option.id) youtubePlayerRef.current.playVideo();
    else youtubePlayerRef.current.loadVideoById({ videoId: option.videoId, startSeconds: option.startSeconds });
    setBgm(option.id);
    setActivePreview(option.id);
    setBgmPaused(false);
  };

  const pauseSelectedBgm = () => {
    youtubePlayerRef.current?.pauseVideo();
    setBgmPaused(true);
  };

  const selectLibraryBgm = (option: BgmOption) => {
    setBgm(option.id);
    chapterBgmIdRef.current = option.id;
    if (!chapterPlayingRef.current) return;
    const current = chapterQueue.find((item) => item.id === activeLibraryRef.current) ?? chapterQueue[0];
    if (current) playLibraryBgm(current);
  };

  const moveVerse = (nextIndex: number) => {
    if (recording || requestingMic) return;
    savedRecordingAudioRef.current?.pause();
    setSavedRecordingPlaying(false);
    const safeIndex = Math.min(Math.max(nextIndex, 0), passageVerses.length - 1);
    if (replacingRecording?.verse !== safeIndex + 1) setReplacingRecording(null);
    setVerseIndex(safeIndex);
    setSeconds(takes[safeIndex]?.duration ?? 0);
  };

  const startRetake = async (item: SavedRecording) => {
    if (deletingRecordingId) return;
    stopChapterPlayback();
    setDeletingRecordingId(item.id);
    try {
      const response = await fetch(`/api/recordings/${item.id}/audio`, {
        method: 'DELETE',
        headers: { 'x-verse-legacy-owner': ownerKeyRef.current },
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || '녹음본을 삭제하지 못했어요.');
      }

      const remainingRecordings = libraryRecordings.filter((recording) => recording.id !== item.id);
      setLibraryRecordings(remainingRecordings);
      setSelectedLibraryRecordingId(null);
      setReplacingRecording(null);
      setBgm(item.bgmId);
      setReverb(item.reverb);

      if (item.book === passageBook.name && item.chapter === passageChapter) {
        const targetIndex = item.verse - passageStartVerse;
        if (targetIndex >= 0 && targetIndex < passageVerses.length) {
          setTakes((current) => current.map((take, index) => {
            if (index !== targetIndex || !take) return take;
            URL.revokeObjectURL(take.url);
            objectUrlsRef.current.delete(take.url);
            return null;
          }));
          setSaved((current) => current.map((value, index) => index === targetIndex ? false : value));
          setVerseIndex(targetIndex);
        }
      }

      setSeconds(0);
      setAppTab('recording');
      setNotice('녹음본이 삭제되었습니다.');
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '녹음본을 삭제하지 못했어요.');
    } finally {
      setDeletingRecordingId(null);
    }
  };

  const startRecording = async (skipHeadphoneWarning = false) => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setNotice('이 브라우저에서는 마이크 녹음을 지원하지 않아요. 최신 Safari나 Chrome을 사용해 주세요.');
      return;
    }
    if (!skipHeadphoneWarning && bgm !== 'none' && activePreview && !bgmPaused) {
      setHeadphoneWarningOpen(true);
      return;
    }

    setHeadphoneWarningOpen(false);
    savedRecordingAudioRef.current?.pause();
    setSavedRecordingPlaying(false);
    libraryAudioRefs.current.forEach((audio) => audio.pause());
    chapterPlayingRef.current = false;
    chapterBgmIdRef.current = null;
    setChapterPlaying(false);
    activeLibraryRef.current = null;
    setActiveLibraryId(null);
    setRequestingMic(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      const audioGraph = createRecordingAudioGraph(stream, reverb);
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(audioGraph.stream, mimeType ? { mimeType } : undefined);
      const targetVerseIndex = verseIndex;

      streamRef.current = stream;
      recordingAudioContextRef.current = audioGraph.context;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      discardRecordingRef.current = false;
      recordingStartedAtRef.current = 0;

      recorder.onstart = (event) => {
        recordingStartedAtRef.current = event.timeStamp;
      };

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = (event) => {
        const chunks = [...chunksRef.current];
        chunksRef.current = [];
        stream.getTracks().forEach((track) => track.stop());
        void audioGraph.context.close();
        streamRef.current = null;
        recordingAudioContextRef.current = null;
        mediaRecorderRef.current = null;
        setRecording(false);

        if (discardRecordingRef.current || chunks.length === 0) return;

        const finalMimeType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: finalMimeType });
        const url = URL.createObjectURL(blob);
        const duration = Math.max(1, Math.round((event.timeStamp - recordingStartedAtRef.current) / 1000));
        objectUrlsRef.current.add(url);

        setTakes((current) => {
          const next = [...current];
          const previousTake = next[targetVerseIndex];
          if (previousTake) {
            URL.revokeObjectURL(previousTake.url);
            objectUrlsRef.current.delete(previousTake.url);
          }
          next[targetVerseIndex] = { url, blob, mimeType: finalMimeType, duration };
          return next;
        });
        setSeconds(duration);
        setNotice('녹음이 끝났어요. 체크 버튼을 누르면 바로 보관함에 저장돼요.');
      };

      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        void audioGraph.context.close();
        recordingAudioContextRef.current = null;
        setRecording(false);
        setNotice('녹음 중 문제가 생겼어요. 마이크 연결을 확인하고 다시 시도해 주세요.');
      };

      setTakes((current) => {
        const next = [...current];
        const previousTake = next[targetVerseIndex];
        if (previousTake) {
          URL.revokeObjectURL(previousTake.url);
          objectUrlsRef.current.delete(previousTake.url);
        }
        next[targetVerseIndex] = null;
        return next;
      });
      setSaved((current) => current.map((value, index) => (index === targetVerseIndex ? false : value)));
      setSeconds(0);
      recorder.start(250);
      setRecording(true);
      setNotice(`자동 음량 보정과 ‘${reverb}’ 효과로 녹음을 시작했어요.`);
    } catch (error) {
      const denied = error instanceof DOMException && error.name === 'NotAllowedError';
      setNotice(
        denied
          ? '마이크 권한이 필요해요. 브라우저 주소창의 마이크 권한을 허용해 주세요.'
          : '마이크를 연결할 수 없어요. 연결 상태를 확인하고 다시 시도해 주세요.',
      );
    } finally {
      setRequestingMic(false);
    }
  };

  const toggleRecording = () => {
    if (recording) {
      if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
      setRecording(false);
      setNotice('녹음을 마무리하고 있어요. 잠시만 기다려 주세요.');
      return;
    }
    void startRecording();
  };

  const resetTake = () => {
    if (recording && mediaRecorderRef.current?.state !== 'inactive') {
      discardRecordingRef.current = true;
      mediaRecorderRef.current?.stop();
    }
    setRecording(false);
    setSeconds(0);
    setTakes((current) => {
      const next = [...current];
      const take = next[verseIndex];
      if (take) {
        URL.revokeObjectURL(take.url);
        objectUrlsRef.current.delete(take.url);
      }
      next[verseIndex] = null;
      return next;
    });
    setSaved((current) => current.map((value, index) => (index === verseIndex ? false : value)));
    setNotice('현재 녹음을 지웠어요. 다시 시작할 수 있어요.');
  };

  const saveVerse = async () => {
    if (!currentTake || savingLibrary) return;
    setSavingLibrary(true);
    try {
      const extension = currentTake.mimeType.includes('mp4')
        ? 'm4a'
        : currentTake.mimeType.includes('ogg')
          ? 'ogg'
          : 'webm';
      const formData = new FormData();
      formData.append(
        'audio',
        new File([currentTake.blob], `${passageBook.name}${passageChapter}장_${currentVerseNumber}절.${extension}`, {
          type: currentTake.mimeType,
        }),
      );
      formData.append('book', passageBook.name);
      formData.append('chapter', String(passageChapter));
      formData.append('verse', String(currentVerseNumber));
      formData.append('verseText', passageVerses[verseIndex]);
      formData.append('projectId', activeProject?.id ?? 'free-recording');
      formData.append('projectTitle', activeProject?.title ?? '자유 녹음');
      formData.append('bgmId', bgm);
      formData.append('reverb', reverb);
      formData.append('durationSeconds', String(currentTake.duration));

      const isReplacingCurrentVerse = replacingRecording?.book === passageBook.name && replacingRecording.chapter === passageChapter && replacingRecording.verse === currentVerseNumber;
      const response = await fetch(
        isReplacingCurrentVerse ? `/api/recordings/${replacingRecording.id}/audio` : '/api/recordings',
        {
        method: isReplacingCurrentVerse ? 'PUT' : 'POST',
        headers: { 'x-verse-legacy-owner': ownerKeyRef.current },
        body: formData,
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || '보관함에 저장하지 못했어요.');
      }

      const updatedRecordings = await refreshLibrary();
      setReplacingRecording(null);
      setTakes((current) => current.map((take, index) => {
        if (index !== verseIndex || !take) return take;
        URL.revokeObjectURL(take.url);
        objectUrlsRef.current.delete(take.url);
        return null;
      }));
      setSeconds(0);
      setNotice('보관함에 저장되었어요.');
      awardDailyWordCard(updatedRecordings);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '보관함 저장 중 문제가 생겼어요.');
    } finally {
      setSavingLibrary(false);
    }
  };

  const chooseBibleBook = (book: BibleBook) => {
    setSelectedBibleBook(book);
    setSelectedBibleChapter(1);
    setSelectedBibleVerses([]);
  };

  const chooseBibleChapter = async (chapter: number) => {
    setSelectedBibleChapter(chapter);
    setBibleLoading(true);
    try {
      const response = await fetch(`/data/bible/${encodeURIComponent(selectedBibleBook.code)}.json`);
      if (!response.ok) throw new Error('본문을 불러오지 못했어요.');
      const chapters = await response.json() as string[][];
      setSelectedBibleVerses(chapters[chapter - 1] ?? []);
      window.requestAnimationFrame(() => bibleVersePaneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch {
      setSelectedBibleVerses([]);
      setNotice('성경 본문을 불러오지 못했어요. 다시 시도해 주세요.');
    } finally {
      setBibleLoading(false);
    }
  };

  function resolveProjectPassage(project: ActiveProject): ProjectPassage {
    if (project.passage) return project.passage;
    const task = project.tasks[0]?.replace('편', '장') ?? '';
    const match = task.match(/^(.+?)\s+(\d+)장(?:\s+(\d+)(?:–(\d+))?절)?/);
    if (match) {
      const book = bibleBooks.find((item) => item.name === match[1]);
      if (book) {
        const startVerse = Number(match[3] ?? 1);
        return { code: book.code, name: book.name, chapter: Number(match[2]), startVerse, endVerse: Number(match[4] ?? startVerse) };
      }
    }
    const fallback: Record<string, ProjectPassage> = {
      'comfort-14-beginner': { code: '시', name: '시편', chapter: 34, startVerse: 18, endVerse: 18 },
      'sermon-medium': { code: '마', name: '마태복음', chapter: 5, startVerse: 1, endVerse: 4 },
      'philippians-advanced': { code: '빌', name: '빌립보서', chapter: 1, startVerse: 1, endVerse: 8 },
    };
    return fallback[project.id] ?? { code: '시', name: '시편', chapter: 23, startVerse: 1, endVerse: 1 };
  }

  async function loadProjectPassage(project: ActiveProject) {
    const target = resolveProjectPassage(project);
    try {
      const response = await fetch(`/data/bible/${encodeURIComponent(target.code)}.json`);
      if (!response.ok) throw new Error('본문을 불러오지 못했어요.');
      const chapters = await response.json() as string[][];
      const selectedVerses = (chapters[target.chapter - 1] ?? []).slice(target.startVerse - 1, target.endVerse);
      if (!selectedVerses.length) throw new Error('오늘의 본문이 비어 있어요.');
      setPassageBook({ code: target.code, name: target.name });
      setPassageChapter(target.chapter);
      setPassageStartVerse(target.startVerse);
      setPassageVerses(selectedVerses);
      setVerseIndex(0);
      setTakes(selectedVerses.map(() => null));
      setSaved(selectedVerses.map(() => false));
      setReplacingRecording(null);
    } catch {
      setNotice('프로젝트 본문을 불러오지 못했어요. 다시 선택해 주세요.');
    }
  }

  useEffect(() => {
    if (!activeProject) return;
    const project = activeProject;
    queueMicrotask(() => void loadProjectPassage(project));
  }, [activeProject]);

  const activateProject = (project: ActiveProject) => {
    setActiveProject(project);
    setActiveProjects((current) => {
      const withoutPreviousFree = project.kind === 'free' ? current.filter((item) => item.kind !== 'free') : current;
      const next = withoutPreviousFree.some((item) => item.id === project.id)
        ? withoutPreviousFree.map((item) => item.id === project.id ? project : item)
        : [...withoutPreviousFree, project];
      window.localStorage.setItem('verse-legacy-active-projects', JSON.stringify(next));
      return next;
    });
    window.localStorage.setItem('verse-legacy-project', project.id);
    window.localStorage.removeItem('verse-legacy-free-passage');
  };

  const startFreeChapter = () => {
    if (!selectedBibleVerses.length) return;
    const freeProject: ActiveProject = {
      id: 'free-recording',
      title: '자유 녹음',
      duration: 0,
      scope: `총 ${selectedBibleVerses.length}절 · 일정 없이 자유롭게`,
      tasks: [`${selectedBibleBook.name} ${selectedBibleChapter}장 전체`],
      totalVerses: selectedBibleVerses.length,
      kind: 'free',
      passage: { code: selectedBibleBook.code, name: selectedBibleBook.name, chapter: selectedBibleChapter, startVerse: 1, endVerse: selectedBibleVerses.length },
    };
    setPassageBook({ code: selectedBibleBook.code, name: selectedBibleBook.name });
    setPassageChapter(selectedBibleChapter);
    setPassageStartVerse(1);
    setPassageVerses(selectedBibleVerses);
    setVerseIndex(0);
    setTakes(selectedBibleVerses.map(() => null));
    setSaved(selectedBibleVerses.map(() => false));
    window.localStorage.setItem('verse-legacy-free-passage', JSON.stringify({ code: selectedBibleBook.code, name: selectedBibleBook.name, chapter: selectedBibleChapter }));
    window.localStorage.setItem('verse-legacy-onboarding-complete', 'true');
    activateProject(freeProject);
    setAppTab('recording');
    setNotice(`${selectedBibleBook.name} ${selectedBibleChapter}장을 자유 녹음으로 열었어요.`);
    setOnboardingStep('app');
  };

  const finishOnboarding = (projectId?: string) => {
    window.localStorage.setItem('verse-legacy-onboarding-complete', 'true');
    if (projectId) {
      setSelectedTemplateId(projectId);
      const project = projectTemplates.find((item) => item.id === projectId);
      if (project?.custom) {
        const savedCustomProject = window.localStorage.getItem('verse-legacy-custom-project');
        if (savedCustomProject) activateProject(JSON.parse(savedCustomProject) as ActiveProject);
      } else if (project) {
        activateProject({ id: project.id, title: project.title, duration: project.duration, scope: project.scope, tasks: project.tasks });
      }
      setNotice(project?.custom ? '직접 프로젝트를 만들 준비가 됐어요.' : `‘${project?.title}’ 프로젝트를 시작했어요.`);
    } else {
      window.localStorage.removeItem('verse-legacy-project');
      setActiveProject(null);
      setNotice('원하는 말씀을 자유롭게 녹음할 수 있어요.');
    }
    setOnboardingStep('app');
  };

  const selectedTemplate = projectTemplates.find((item) => item.id === selectedTemplateId) ?? projectTemplates[0];
  const visibleTemplates = projectTemplates.filter((item) => item.duration === projectDuration);
  const visibleBibleBooks = bibleBooks.filter((book) => book.testament === bibleTestament && book.name.includes(bibleSearch.trim()));
  const selectedFreeChapterInProgress = freeRecordingChapterKeys.has(`${selectedBibleBook.name}-${selectedBibleChapter}`);
  const selectedFreeRecordedVerses = new Set(
    libraryRecordings
      .filter((item) => (item.projectId === 'free-recording' || item.projectId.startsWith('free-')) && item.book === selectedBibleBook.name && item.chapter === selectedBibleChapter)
      .map((item) => item.verse),
  );
  const customBook = supportedBibleBooks.find((item) => item.id === customBookId) ?? supportedBibleBooks[0];
  const customRecordingDays = projectDuration === 7 ? 6 : 12;
  const customDailyTasks = useMemo(
    () => makeDailyTasks(
      customBook,
      { chapter: customStartChapter, verse: customStartVerse },
      { chapter: customEndChapter, verse: customEndVerse },
      customRecordingDays,
    ),
    [customBook, customEndChapter, customEndVerse, customRecordingDays, customStartChapter, customStartVerse],
  );
  const customTotalVerses = customDailyTasks.reduce((total, task) => total + task.count, 0);

  const changeCustomBook = (bookId: string) => {
    const book = supportedBibleBooks.find((item) => item.id === bookId) ?? supportedBibleBooks[0];
    setCustomBookId(book.id);
    setCustomStartChapter(1);
    setCustomStartVerse(1);
    setCustomEndChapter(book.verseCounts.length);
    setCustomEndVerse(book.verseCounts[book.verseCounts.length - 1]);
    setCustomProjectName(`${book.name} 목소리 프로젝트`);
  };

  const saveCustomProject = () => {
    const project = {
      id: `custom-${crypto.randomUUID()}`,
      title: customProjectName.trim() || `${customBook.name} 프로젝트`,
      duration: projectDuration,
      bookId: customBook.id,
      scope: `${customBook.name} · 총 ${customTotalVerses}절`,
      totalVerses: customTotalVerses,
      tasks: customDailyTasks.map((task) => task.reference),
    };
    window.localStorage.setItem('verse-legacy-custom-project', JSON.stringify(project));
    finishOnboarding(selectedTemplate.id);
    setNotice(`‘${project.title}’ 일정을 만들었어요. 하루 분량을 확인해 보세요.`);
  };

  return (
    <main className="app-shell">
      <div className="persistent-youtube-host" aria-hidden="true"><div ref={youtubeContainerRef} /></div>
      {onboardingStep !== 'app' && (
        <section className="onboarding-overlay" aria-label="말씀유산 시작 설정">
          <div className="onboarding-brand"><span className="brand-mark"><BookOpen size={20} /></span><strong>말씀유산</strong></div>
          {onboardingStep === 'welcome' ? (
            <div className="onboarding-card welcome-card">
              <p className="eyebrow">{returningHome ? '말씀유산 홈' : '소중한 목소리를 오래 간직해요'}</p>
              <h1>{returningHome ? '무엇을 이어서 할까요?' : '어떤 방식으로 시작할까요?'}</h1>
              <p className="onboarding-lead">{returningHome ? '진행 중인 프로젝트를 열거나, 원하는 말씀을 골라 자유롭게 녹음하세요.' : '지금 마음에 맞는 방법을 골라보세요. 나중에 언제든 바꿀 수 있어요.'}</p>
              <div className="start-choice-grid">
                <button type="button" onClick={() => { setBibleBackTarget('welcome'); setOnboardingStep('bible'); }}>
                  <span><Sparkles size={22} /></span>
                  <strong>내 방식대로 자유롭게</strong>
                  <small>원하는 말씀을 골라 일정 없이 자유롭게 녹음해요.</small>
                  <em>성경 고르기 <ArrowRight size={15} /></em>
                </button>
                <button className="recommended" type="button" onClick={() => setOnboardingStep('projectHome')}>
                  <i>추천</i><span><Target size={22} /></span>
                  <strong>프로젝트 보기</strong>
                  <small>진행 중인 프로젝트를 골라 이어서 녹음하거나 새 프로젝트를 시작해요.</small>
                  <em>내 프로젝트 보기 <ArrowRight size={15} /></em>
                </button>
              </div>
            </div>
          ) : onboardingStep === 'projectHome' ? (
            <div className="onboarding-card project-home-card">
              <button className="onboarding-back" type="button" onClick={() => setOnboardingStep('welcome')}><ChevronLeft size={16} /> 홈으로</button>
              <p className="eyebrow">MY PROJECTS</p>
              <h1>어떤 프로젝트를 이어갈까요?</h1>
              <p className="onboarding-lead">프로젝트를 선택하면 다른 항목 없이 그 프로젝트의 녹음 화면만 열려요.</p>
              {guidedProjects.length ? <div className="running-project-list">
                {guidedProjects.map((project, index) => <button className={`project-color-${index % 5} ${activeProject?.id === project.id ? 'current' : ''}`} type="button" onClick={() => { activateProject(project); setAppTab('recording'); setOnboardingStep('app'); }} key={project.id}><span><Target size={20} /></span><div><small>{activeProject?.id === project.id ? '현재 진행 중' : `${project.duration}일 프로젝트`}</small><strong>{project.title}</strong><p>{project.scope}</p></div><ArrowRight size={18} /></button>)}
              </div> : <div className="project-home-empty"><Target size={28} /><strong>진행 중인 프로젝트가 없어요</strong><p>첫 프로젝트를 만들고 매일 조금씩 완성해보세요.</p></div>}
              <button className="start-project-button" type="button" onClick={() => setOnboardingStep('projects')}>새 프로젝트 시작하기 <ArrowRight size={16} /></button>
            </div>
          ) : onboardingStep === 'bible' ? (
            <div className="onboarding-card bible-browser-card">
              <button className="onboarding-back" type="button" onClick={() => setOnboardingStep(bibleBackTarget)}><ChevronLeft size={16} /> 이전</button>
              <p className="eyebrow">자유롭게 녹음하기</p>
              <h1>어떤 말씀부터 읽어볼까요?</h1>
              <p className="onboarding-lead">구약·신약 66권 전체에서 성경책과 장을 고르면 모든 절을 한눈에 볼 수 있어요.</p>
              <div className="bible-browser-toolbar">
                <div className="testament-tabs" aria-label="구약 또는 신약 선택">
                  <button className={bibleTestament === 'old' ? 'selected' : ''} type="button" onClick={() => { setBibleTestament('old'); setBibleSearch(''); chooseBibleBook(bibleBooks[0]); }}>구약 <small>39권</small></button>
                  <button className={bibleTestament === 'new' ? 'selected' : ''} type="button" onClick={() => { setBibleTestament('new'); setBibleSearch(''); chooseBibleBook(bibleBooks[39]); }}>신약 <small>27권</small></button>
                </div>
                <label className="bible-search"><Search size={16} /><input value={bibleSearch} onChange={(event) => setBibleSearch(event.target.value)} placeholder="성경책 이름 검색" /></label>
              </div>
              <div className="bible-browser-layout">
                <section className="bible-book-pane" aria-label={`${bibleTestament === 'old' ? '구약' : '신약'} 성경책`}>
                  <div className="pane-heading"><span>1</span><div><strong>성경책</strong><small>{bibleTestament === 'old' ? '구약 39권' : '신약 27권'}</small></div></div>
                  <div className="bible-book-grid">
                    {visibleBibleBooks.map((book) => {
                      const inProgress = freeRecordingBookNames.has(book.name);
                      return <button className={`${selectedBibleBook.code === book.code ? 'selected' : ''} ${inProgress ? 'in-progress' : ''}`} type="button" onClick={() => chooseBibleBook(book)} key={book.code}><strong>{book.name}</strong><small>{inProgress ? `진행 중 · ${book.chapters.length}장` : `${book.chapters.length}장`}</small></button>;
                    })}
                  </div>
                </section>
                <section className="bible-chapter-pane" aria-label={`${selectedBibleBook.name} 장 선택`}>
                  <div className="pane-heading"><span>2</span><div><strong>장 선택</strong><small>{selectedBibleBook.name} · 총 {selectedBibleBook.chapters.length}장</small></div></div>
                  <div className="bible-chapter-grid">
                    {selectedBibleBook.chapters.map((verseCount, index) => {
                      const chapter = index + 1;
                      const inProgress = freeRecordingChapterKeys.has(`${selectedBibleBook.name}-${chapter}`);
                      return <button className={`${selectedBibleChapter === chapter && selectedBibleVerses.length ? 'selected' : ''} ${inProgress ? 'in-progress' : ''}`} type="button" onClick={() => void chooseBibleChapter(chapter)} key={index}><strong>{chapter}</strong><small>{inProgress ? `진행 중 · ${verseCount}절` : `${verseCount}절`}</small></button>;
                    })}
                  </div>
                </section>
                <aside className="bible-verse-pane" aria-label="선택한 장의 성경 구절" ref={bibleVersePaneRef}>
                  <div className="pane-heading"><span>3</span><div><strong>본문 확인</strong><small>{selectedBibleBook.name} {selectedBibleChapter}장</small></div></div>
                  {bibleLoading ? <div className="bible-empty"><LoaderCircle className="spin" size={22} /> 본문을 불러오고 있어요</div> : selectedBibleVerses.length ? <div className="bible-verse-preview">{selectedBibleVerses.map((text, index) => {
                    const verse = index + 1;
                    const completed = selectedFreeRecordedVerses.has(verse);
                    return <p className={completed ? 'completed' : ''} key={index}><span>{completed ? <Check size={12} /> : verse}</span>{text}</p>;
                  })}</div> : <div className="bible-empty"><BookOpen size={25} /><strong>읽을 장을 선택해 주세요</strong><small>선택하면 그 장의 모든 절이 여기에 나타나요.</small></div>}
                  <button className="start-project-button" type="button" onClick={startFreeChapter} disabled={!selectedBibleVerses.length}>{selectedBibleBook.name} {selectedBibleChapter}장 {selectedFreeChapterInProgress ? '계속하기' : '녹음 시작'} <ArrowRight size={16} /></button>
                </aside>
              </div>
              <p className="bible-credit">본문: PLAY X 번역(플레이엑스) · 번역 김무송 · CC BY 4.0</p>
            </div>
          ) : onboardingStep === 'schedule' && activeProject ? (
            <div className="onboarding-card project-schedule-card">
              <button className="onboarding-back" type="button" onClick={() => setOnboardingStep('app')}><ChevronLeft size={16} /> 프로젝트로 돌아가기</button>
              <p className="eyebrow">PROJECT SCHEDULE</p>
              <h1>{activeProject.title}</h1>
              <p className="onboarding-lead">{activeProject.scope}</p>
              <div className="project-schedule-only">
                <div className="schedule-summary">
                  <span><CalendarDays size={20} /></span>
                  <div><small>{activeProject.kind === 'free' ? '자유 녹음' : `총 ${activeProject.duration}일`}</small><strong>프로젝트 전체 일정</strong></div>
                </div>
                <ol>
                  {activeProject.tasks.map((task, index) => {
                    const completed = completedProjectTaskIndexes.has(index);
                    return <li className={completed ? 'completed' : ''} key={`${task}-${index}`}><span>{completed ? <Check size={14} aria-label="완료" /> : activeProject.kind === 'free' ? '자유' : `${index + 1}일`}</span><strong>{task}</strong>{completed && <small>완료</small>}</li>;
                  })}
                  {activeProject.kind !== 'free' && activeProject.tasks.length < activeProject.duration && Array.from({ length: activeProject.duration - activeProject.tasks.length }, (_, index) => {
                    const day = activeProject.tasks.length + index + 1;
                    const task = day === activeProject.duration ? '전체 확인하고 완성하기' : '밀린 녹음과 다시 녹음';
                    return <li key={`finish-${day}`}><span>{day}일</span><strong>{task}</strong></li>;
                  })}
                </ol>
              </div>
              <button className="start-project-button" type="button" onClick={() => setOnboardingStep('app')}>이 프로젝트 계속하기 <ArrowRight size={16} /></button>
            </div>
          ) : (
            <div className="onboarding-card project-picker-card">
              <button className="onboarding-back" type="button" onClick={() => setOnboardingStep('projectHome')}><ChevronLeft size={16} /> 이전</button>
              <p className="eyebrow">완성 프로젝트</p>
              <h1>얼마 동안 함께 완성해볼까요?</h1>
              <div className="duration-picker" aria-label="프로젝트 기간">
                <button className={projectDuration === 7 ? 'selected' : ''} type="button" onClick={() => { setProjectDuration(7); setSelectedTemplateId('psalm-23-beginner'); }}>1주</button>
                <button className={projectDuration === 14 ? 'selected' : ''} type="button" onClick={() => { setProjectDuration(14); setSelectedTemplateId('comfort-14-beginner'); }}>2주</button>
                <span>1개월부터 3년 프로젝트는 준비 중이에요.</span>
              </div>
              <div className="project-picker-layout">
                <div className="project-template-list">
                  {visibleTemplates.map((project) => {
                    const isActive = activeProjectIds.has(project.id);
                    return (
                    <button className={`${selectedTemplateId === project.id ? 'selected' : ''} ${isActive ? 'in-progress' : ''}`} type="button" onClick={() => setSelectedTemplateId(project.id)} disabled={isActive} key={project.id}>
                      <span className={`difficulty difficulty-${project.level}`}>{isActive ? '진행 중' : project.custom ? '직접 구성' : project.level}</span>
                      <strong>{project.title}</strong>
                      <small>{project.scope}</small>
                      <em><CalendarDays size={13} /> {project.duration}일 · {project.minutes}</em>
                    </button>
                  )})}
                </div>
                <aside className="project-schedule-preview">
                  <p className="eyebrow">자동으로 만든 일정</p>
                  <h2>{selectedTemplate.title}</h2>
                  {selectedTemplate.custom ? (
                    <div className="custom-project-builder">
                      <label><span>프로젝트 이름</span><input value={customProjectName} onChange={(event) => setCustomProjectName(event.target.value)} maxLength={50} /></label>
                      <label><span>성경 선택</span><select value={customBookId} onChange={(event) => changeCustomBook(event.target.value)}>{supportedBibleBooks.map((book) => <option value={book.id} key={book.id}>{book.name}</option>)}</select></label>
                      <div className="range-row">
                        <label><span>시작 장</span><select value={customStartChapter} onChange={(event) => {
                          const chapter = Number(event.target.value);
                          setCustomStartChapter(chapter);
                          setCustomStartVerse(1);
                          if (chapter > customEndChapter) {
                            setCustomEndChapter(chapter);
                            setCustomEndVerse(customBook.verseCounts[chapter - 1]);
                          }
                        }}>{customBook.verseCounts.map((_, index) => <option value={index + 1} key={index}>{index + 1 + (customBook.chapterOffset ?? 0)}장</option>)}</select></label>
                        <label><span>시작 절</span><select value={customStartVerse} onChange={(event) => {
                          const verse = Number(event.target.value);
                          setCustomStartVerse(verse);
                          if (customStartChapter === customEndChapter && verse > customEndVerse) setCustomEndVerse(verse);
                        }}>{Array.from({ length: customBook.verseCounts[customStartChapter - 1] }, (_, index) => <option value={index + 1} key={index}>{index + 1}절</option>)}</select></label>
                      </div>
                      <div className="range-row">
                        <label><span>마지막 장</span><select value={customEndChapter} onChange={(event) => {
                          const chapter = Number(event.target.value);
                          setCustomEndChapter(chapter);
                          setCustomEndVerse(customBook.verseCounts[chapter - 1]);
                          if (chapter < customStartChapter) {
                            setCustomStartChapter(chapter);
                            setCustomStartVerse(1);
                          }
                        }}>{customBook.verseCounts.map((_, index) => <option value={index + 1} key={index}>{index + 1 + (customBook.chapterOffset ?? 0)}장</option>)}</select></label>
                        <label><span>마지막 절</span><select value={customEndVerse} onChange={(event) => {
                          const verse = Number(event.target.value);
                          setCustomEndVerse(verse);
                          if (customStartChapter === customEndChapter && verse < customStartVerse) setCustomStartVerse(verse);
                        }}>{Array.from({ length: customBook.verseCounts[customEndChapter - 1] }, (_, index) => <option value={index + 1} key={index}>{index + 1}절</option>)}</select></label>
                      </div>
                      <div className="custom-project-summary"><strong>총 {customTotalVerses}절</strong><span>{customRecordingDays}일 동안 하루 평균 {Math.ceil(customTotalVerses / Math.max(customRecordingDays, 1))}절</span></div>
                      <ol>{customDailyTasks.map((task, index) => <li key={task.reference}><span>{index + 1}일</span><strong>{task.reference}</strong><small>{task.count}절</small></li>)}</ol>
                    </div>
                  ) : (
                    <ol>
                      {selectedTemplate.tasks.map((task, index) => (
                        <li key={task}><span>{index + 1}일</span><strong>{task}</strong></li>
                      ))}
                      {selectedTemplate.duration === 14 && <><li><span>13일</span><strong>밀린 녹음과 다시 녹음</strong></li><li><span>14일</span><strong>전체 확인하고 완성하기</strong></li></>}
                    </ol>
                  )}
                  <button className="start-project-button" type="button" onClick={selectedTemplate.custom ? saveCustomProject : () => finishOnboarding(selectedTemplate.id)} disabled={activeProjectIds.has(selectedTemplate.id) || (selectedTemplate.custom && customTotalVerses === 0)}>{activeProjectIds.has(selectedTemplate.id) ? '이미 진행 중인 프로젝트' : selectedTemplate.custom ? '이 일정으로 프로젝트 만들기' : '이 프로젝트 시작하기'} {!activeProjectIds.has(selectedTemplate.id) && <ArrowRight size={16} />}</button>
                </aside>
              </div>
            </div>
          )}
        </section>
      )}
      <header className="topbar">
        <a className="brand" href="#recording" aria-label="말씀유산 홈">
          <span className="brand-mark"><BookOpen size={20} /></span>
          <span><strong>말씀유산</strong><small>VERSE LEGACY</small></span>
        </a>
        <div className="project-progress" aria-label={activeProject ? `${activeProject.title} 진행 중` : `${passageBook.name} ${passageChapter}장 ${progress}% 완료`}>
          <div><span>{activeProject?.title ?? `자유 녹음 · ${passageBook.name} ${passageChapter}장`}</span><strong>{activeProject ? (activeProject.kind === 'free' ? '자유' : `${activeProject.duration}일`) : `${completedCount}/${passageVerses.length}절`}</strong></div>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
        </div>
        <nav className="desktop-tabs" aria-label="주요 화면">
          <button className={appTab === 'recording' ? 'active' : ''} type="button" onClick={openRecordingTab}><Mic size={16} /> 녹음</button>
          <button className={appTab === 'library' ? 'active' : ''} type="button" onClick={openLibraryTab}><Headphones size={16} /> 듣기</button>
        </nav>
      </header>

      {appTab === 'recording' && <div className="prototype-note"><Cloud size={15} /> 보관함에 저장하면 나중에 다시 듣고, 선택한 BGM을 목소리 뒤에 함께 재생할 수 있어요.</div>}

      {appTab === 'recording' && <section className="workspace" id="recording">
        <aside className="chapter-panel" aria-label="프로젝트 정보">
          <div>
            <p className="eyebrow">{activeProject ? (activeProject.kind === 'free' ? '자유 녹음 프로젝트' : `${activeProject.duration}일 완성 프로젝트`) : '우리 가족 첫 번째 낭독'}</p>
            <h2>{activeProject?.title ?? `${passageBook.name} ${passageChapter}장`}</h2>
            <p className="muted">{activeProject?.tasks[0] ? `오늘: ${activeProject.tasks[0]}` : '엄마의 목소리로 남기는 말씀'}</p>
            {activeProject?.kind !== 'free' && completedProjectTaskIndexes.has(0) && <span className="project-day-complete"><Check size={13} /> 1일차 완료</span>}
          </div>
          {activeProject && activeProject.kind !== 'free' && <button className="chapter-schedule-button" type="button" onClick={() => setOnboardingStep('schedule')}><CalendarDays size={15} /> 전체 일정 확인</button>}
          <div className="verse-list" aria-label="구절 목록">
            {passageVerses.map((_, index) => (
              <button
                className={`verse-item ${verseIndex === index ? 'active' : ''}`}
                key={index}
                onClick={() => moveVerse(index)}
                type="button"
              >
                <span>{passageStartVerse + index}절</span>
                {saved[index] ? <Check size={15} aria-label="저장 완료" /> : takes[index] ? <AudioLines size={15} aria-label="녹음 완료" /> : <span className="empty-dot" />}
              </button>
            ))}
          </div>
          <div className="family-card">
            <div className="avatar-stack" aria-hidden="true"><span>엄</span><span>나</span><span>설</span></div>
            <p><strong>가족 3명과 함께</strong><small>완성되면 가족에게 알려드려요.</small></p>
          </div>
        </aside>

        <section className="recording-card" aria-label="성경 녹음 화면">
          <div className="recording-heading">
            <div>
              <p className="eyebrow">{passageBook.name} {passageChapter}장 · {currentVerseNumber}절</p>
              <h1>천천히, 평소 목소리로 읽어 주세요.</h1>
            </div>
            <span className={`status-pill ${recording ? 'live' : hasTake || saved[verseIndex] ? 'ready' : ''}`}>
              {recording ? '녹음 중' : hasTake ? '재생 가능' : saved[verseIndex] ? '저장 완료' : replacingRecording ? '다시 녹음' : '녹음 전'}
            </span>
          </div>

          {replacingRecording && replacingRecording.book === passageBook.name && replacingRecording.chapter === passageChapter && replacingRecording.verse === currentVerseNumber && (
            <div className="retake-banner">
              <RotateCcw size={18} />
              <p><strong>{currentVerseNumber}절을 다시 녹음하고 있어요.</strong><small>새 녹음을 저장하기 전까지 기존 보관함 음성은 그대로 유지됩니다.</small></p>
              <button type="button" onClick={() => setReplacingRecording(null)}>취소</button>
            </div>
          )}

          <article className="verse-paper">
            <span className="verse-number">{currentVerseNumber}</span>
            <p>{passageVerses[verseIndex]}</p>
          </article>

          <div className={`waveform ${recording ? 'recording' : ''}`} aria-label={recording ? '녹음 중인 음성 파형' : '대기 중인 음성 파형'}>
            {Array.from({ length: 34 }).map((_, index) => (
              <span key={index} style={{ height: `${12 + ((index * 17) % 42)}%`, animationDelay: `${index * 45}ms` }} />
            ))}
          </div>

          <div className="timer"><span>{formatTime(seconds)}</span><small>{requestingMic ? '마이크 연결을 요청하고 있어요' : recording ? '실제 마이크 음성을 녹음하고 있어요' : hasTake ? '아래에서 녹음을 확인해 주세요' : saved[verseIndex] ? '보관함에 저장된 녹음이에요' : '버튼을 누르면 마이크 권한을 요청해요'}</small></div>

          <div className={`record-controls ${hasTake && !recording ? 'record-complete-actions' : ''} ${saved[verseIndex] && currentSavedRecording ? 'saved-recording-actions' : ''}`}>
            {hasTake && !recording ? <>
              <button className="record-complete-button restart" onClick={resetTake} type="button"><RotateCcw size={22} /><span>다시 녹음</span></button>
              <button className="record-complete-button confirm" onClick={() => void saveVerse()} disabled={savingLibrary} type="button">{savingLibrary ? <LoaderCircle className="spin" size={22} /> : <Check size={24} />}<span>{savingLibrary ? '저장 중' : replacingRecording ? '교체 저장' : '보관함에 저장'}</span></button>
            </> : saved[verseIndex] && currentSavedRecording ? <>
              <button className="record-complete-button saved-listen" onClick={() => {
                const audio = savedRecordingAudioRef.current;
                if (!audio) return;
                if (savedRecordingPlaying) audio.pause();
                else void audio.play();
              }} type="button">
                {savedRecordingPlaying ? <Pause size={22} /> : <Headphones size={22} />}
                <span>{savedRecordingPlaying ? '듣기 멈춤' : '녹음 듣기'}</span>
              </button>
              <button className="record-complete-button restart" type="button" disabled={deletingRecordingId === currentSavedRecording.id} onClick={() => void startRetake(currentSavedRecording)}>
                {deletingRecordingId === currentSavedRecording.id ? <LoaderCircle className="spin" size={21} /> : <RotateCcw size={21} />}
                <span>{deletingRecordingId === currentSavedRecording.id ? '삭제 중' : '다시 녹음'}</span>
              </button>
            </> : <button className={`record-button ${recording ? 'recording' : ''}`} onClick={toggleRecording} disabled={requestingMic} type="button">
              <span>{recording ? <CircleStop size={27} /> : <Mic size={29} />}</span>
              {requestingMic ? '마이크 연결 중' : recording ? '녹음 멈추기' : '녹음 시작'}
            </button>}
          </div>

          {currentSavedRecording && saved[verseIndex] && (
            // oxlint-disable-next-line jsx-a11y/media-has-caption -- 사용자가 직접 녹음한 음성에는 별도 자막 파일이 없습니다.
            <audio ref={savedRecordingAudioRef} preload="metadata" src={ownerKey ? `/api/recordings/${currentSavedRecording.id}/audio?owner=${encodeURIComponent(ownerKey)}` : undefined} onPlay={() => setSavedRecordingPlaying(true)} onPause={() => setSavedRecordingPlaying(false)} onEnded={() => setSavedRecordingPlaying(false)} />
          )}

          {currentTake && !recording && (
            <div className="take-preview">
              <div className="take-preview-heading">
                <span><AudioLines size={18} /></span>
                <p><strong>{currentVerseNumber}절 녹음 완료</strong><small>{formatTime(currentTake.duration)} · 지금 바로 재생할 수 있어요.</small></p>
              </div>
              {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- 사용자가 방금 만든 음성 녹음에는 별도 자막 파일이 없습니다. */}
              <audio className="recording-preview" controls preload="metadata" src={currentTake.url}>녹음 재생을 지원하지 않는 브라우저입니다.</audio>
            </div>
          )}

          <div className="verse-navigation">
            <button onClick={() => moveVerse(verseIndex - 1)} disabled={verseIndex === 0 || recording || requestingMic} type="button"><ChevronLeft size={18} /> 이전 구절</button>
            <span>{currentVerseNumber}절 · {verseIndex + 1} / {passageVerses.length}</span>
            <button onClick={() => moveVerse(verseIndex + 1)} disabled={verseIndex === passageVerses.length - 1 || recording || requestingMic} type="button">다음 구절 <ChevronRight size={18} /></button>
          </div>
        </section>

        <aside className="sound-panel" aria-label="음향 설정">
          <div className="panel-heading"><span><Headphones size={19} /></span><div><p className="eyebrow">간편 음향</p><h2>목소리 다듬기</h2></div></div>

          <fieldset className="setting-group">
            <legend>리버브</legend>
            <p>녹음 파일에 자연스러운 공간감을 실제로 더해요.</p>
            <div className="segment-control">
              {reverbOptions.map((option) => (
                <button className={reverb === option ? 'selected' : ''} onClick={() => setReverb(option)} type="button" key={option}>{option}</button>
              ))}
            </div>
          </fieldset>

          <fieldset className="setting-group">
            <legend><Music2 size={17} /> 배경음악</legend>
            <p>곡을 고른 뒤 녹음하면서 재생하거나 잠시 멈출 수 있어요. 선택한 곡은 저장된 말씀에도 연결돼요.</p>
            <div className="music-list">
              {bgmOptions.map((option) => (
                <div className={`music-option ${bgm === option.id ? 'selected' : ''}`} key={option.id}>
                  <button
                    className="music-select"
                    disabled={recording || requestingMic}
                    onClick={() => {
                      if (option.id !== bgm && activePreview) stopPreview();
                      setBgm(option.id);
                      if (!option.videoId) stopPreview();
                    }}
                    type="button"
                  >
                    <span className="music-icon">{option.videoId ? (option.recommended ? <Sparkles size={15} /> : '♪') : '—'}</span>
                    <span><strong>{option.name}</strong><small>{option.description}</small></span>
                    <span className="radio-dot" />
                  </button>
                </div>
              ))}
            </div>
          </fieldset>

          <div className="bgm-transport" aria-label="배경음악 재생 조작">
            <button type="button" onClick={() => {
              const option = bgmOptions.find((item) => item.id === bgm);
              if (option) playSelectedBgm(option);
            }} disabled={!playerReady || bgm === 'none'} aria-label="배경음악 재생"><Play size={16} /><span>재생</span></button>
            <button type="button" onClick={pauseSelectedBgm} disabled={!activePreview || bgmPaused} aria-label="배경음악 일시정지"><Pause size={16} /><span>일시정지</span></button>
            <button type="button" onClick={stopPreview} disabled={!activePreview} aria-label="배경음악 정지"><CircleStop size={16} /><span>정지</span></button>
          </div>

          <label className="volume-control">
            <span><Volume2 size={17} /> 배경음악 음량 <strong>{volume}%</strong></span>
            <input type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} disabled={bgm === 'none'} />
          </label>

          <div className="sound-summary">
            <Sparkles size={18} />
            <p><strong>절마다 목소리 크기를 자동으로 맞춰요</strong><small>녹음 중에는 BGM을 들으며 읽을 수 있고, 저장 후에는 이어듣기 전체에 같은 음악을 적용할 수 있어요.</small></p>
          </div>
        </aside>
      </section>}

      {appTab === 'library' && <section className="library-section" id="library" aria-labelledby="library-title">
        <div className="library-heading">
          <div>
            <p className="eyebrow">나중에도 다시 듣기</p>
            <h2 id="library-title">{activeProject ? `${activeProject.title} 보관함` : '말씀 보관함'}</h2>
            <p className="muted">현재 선택한 프로젝트의 녹음만 모아 보여드려요. 프로젝트 탭을 바꾸면 보관함도 함께 바뀝니다.</p>
          </div>
          <span className="library-count"><Archive size={15} /> {activeLibraryRecordings.length}개 보관</span>
        </div>

        {libraryLoading ? (
          <div className="library-state"><LoaderCircle className="spin" size={28} /><strong>보관함을 불러오고 있어요</strong></div>
        ) : activeLibraryRecordings.length === 0 ? (
          <div className="library-state empty">
            <span><Archive size={28} /></span>
            <strong>{activeProject ? `‘${activeProject.title}’에 저장된 녹음이 없어요` : '아직 저장된 녹음이 없어요'}</strong>
            <p>위에서 말씀을 녹음한 다음 ‘보관함에 저장’을 눌러 주세요. 다른 프로젝트의 녹음과 섞이지 않아요.</p>
            <button className="library-empty-action" type="button" onClick={openRecordingTab}>첫 녹음 시작하기</button>
          </div>
        ) : (
          <div className="library-browser">
            {selectedLibraryGroup && <div className="library-listen-detail">
              <div className="chapter-player">
                <div className="chapter-player-copy">
                  <span>{chapterPlaying ? <AudioLines size={31} /> : <BookOpen size={31} />}</span>
                  {chapterPlaying && currentlyPlayingRecording ? (
                    <div className="chapter-lyrics" key={currentlyPlayingRecording.id}>
                      <small className="now-playing-label">NOW PLAYING · {currentlyPlayingRecording.verse}절</small>
                      <strong>{currentlyPlayingRecording.verseText}</strong>
                      <small>{currentlyPlayingRecording.book} {currentlyPlayingRecording.chapter}{currentlyPlayingRecording.book === '시편' ? '편' : '장'} {currentlyPlayingRecording.verse}절</small>
                    </div>
                  ) : (
                    <div>
                      <small className="now-playing-label">READY TO PLAY</small>
                      <strong>{selectedLibraryGroup.book} {selectedLibraryGroup.chapter}{selectedLibraryGroup.book === '시편' ? '편' : '장'} 이어듣기</strong>
                      <small>{chapterQueue.map((item) => `${item.verse}절`).join(' · ')} 저장됨 · 절이 바뀌어도 배경음악은 끊기지 않아요.</small>
                    </div>
                  )}
                </div>
                <div className="library-bgm-picker" aria-label="이어듣기 배경음악 선택">
                  <span><Music2 size={14} /> 이어듣기 BGM</span>
                  <div>{bgmOptions.map((option) => <button className={bgm === option.id ? 'selected' : ''} type="button" disabled={chapterPlaying} onClick={() => selectLibraryBgm(option)} key={option.id}>{option.name}</button>)}</div>
                </div>
                <div className="chapter-player-controls">
                  <button className="chapter-list-trigger" type="button" onClick={() => setLibraryChapterMenuOpen(true)}><List size={18} /><span>목록</span></button>
                  <div className="chapter-player-actions">
                  <label>
                    <span><Volume2 size={14} /> BGM <strong>{volume}%</strong></span>
                    <input aria-label="이어듣기 배경음악 음량" type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
                  </label>
                  <button type="button" onClick={chapterPlaying ? stopChapterPlayback : startChapterPlayback}>
                    {chapterPlaying ? <CircleStop size={17} /> : <Play size={17} />}
                    {chapterPlaying ? '이어듣기 멈춤' : '전체 이어듣기'}
                  </button>
                  </div>
                </div>
              </div>
              <div className="chapter-audio-bank">
                {chapterQueue.map((item) => (
                  // oxlint-disable-next-line jsx-a11y/media-has-caption -- 사용자가 직접 녹음한 음성에는 별도 자막 파일이 없습니다.
                  <audio
                    preload="metadata"
                    src={ownerKey ? `/api/recordings/${item.id}/audio?owner=${encodeURIComponent(ownerKey)}` : undefined}
                    ref={(element) => {
                      if (element) libraryAudioRefs.current.set(item.id, element);
                      else libraryAudioRefs.current.delete(item.id);
                    }}
                    onPlay={() => playLibraryBgm(item)}
                    onPause={(event) => {
                      if (!event.currentTarget.ended && activeLibraryRef.current === item.id) {
                        if (chapterPlayingRef.current) stopChapterPlayback();
                        else stopLibraryPlayback(item.id);
                      }
                    }}
                    onEnded={() => handleLibraryEnded(item.id)}
                    key={item.id}
                  />
                ))}
              </div>
              {selectedLibraryRecording && <div className="listen-track-section">
                <div className="listen-track-heading"><div><small>SELECTED VERSE</small><strong>{selectedLibraryRecording.verse}절 녹음</strong></div><button type="button" onClick={() => setSelectedLibraryRecordingId(null)}>닫기</button></div>
          <div className="library-grid">
            {[selectedLibraryRecording].map((item) => {
              const savedBgm = bgmOptions.find((option) => option.id === item.bgmId) ?? bgmOptions[3];
              const isPlaying = activeLibraryId === item.id;
              return (
                <article className={`library-card ${isPlaying ? 'playing' : ''}`} id={`library-recording-${item.id}`} key={item.id}>
                  <div className="library-card-top">
                    <span className="library-verse-number">{item.verse}</span>
                    <div><strong>{item.book} {item.chapter}{item.book === '시편' ? '편' : '장'} · {item.verse}절</strong><small>{formatSavedDate(item.createdAt)} 저장</small></div>
                    {isPlaying && <span className="playing-badge"><AudioLines size={13} /> 재생 중</span>}
                  </div>
                  <blockquote>{item.verseText}</blockquote>
                  <div className="library-tags">
                    <span><Target size={13} /> {item.projectTitle}</span>
                    <span><Music2 size={13} /> {savedBgm.name}</span>
                    <span><Sparkles size={13} /> {item.reverb}</span>
                    <span>{formatTime(item.durationSeconds)}</span>
                  </div>
                  <button className="library-audio-button" type="button" onClick={() => {
                    const audio = libraryAudioRefs.current.get(item.id);
                    if (!audio) return;
                    if (isPlaying && !audio.paused) audio.pause();
                    else void audio.play();
                  }}>{isPlaying ? <Pause size={16} /> : <Play size={16} />}{isPlaying ? '이 절 멈춤' : '이 절 듣기'}</button>
                  <p className="library-playback-note">
                    {isPlaying
                      ? chapterPlaying && savedBgm.videoId ? `이어듣기 중 · ‘${savedBgm.name}’이 작게 함께 재생돼요.` : '이 절의 목소리만 재생하고 있어요.'
                      : '한 절 재생은 목소리만 들려요. BGM은 위의 전체 이어듣기에서만 나와요.'}
                  </p>
                  <button className="library-retake-button" type="button" disabled={deletingRecordingId === item.id} onClick={() => void startRetake(item)}>
                    {deletingRecordingId === item.id ? <LoaderCircle className="spin" size={14} /> : <RotateCcw size={14} />} {deletingRecordingId === item.id ? '녹음본 삭제 중' : '이 절 다시 녹음'}
                  </button>
                </article>
              );
            })}
          </div>
              </div>}
            </div>}
          </div>
        )}

        {libraryChapterMenuOpen && (
          <div className="chapter-menu-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLibraryChapterMenuOpen(false); }}>
            <dialog className="chapter-menu-sheet" open aria-labelledby="chapter-menu-title">
              <div className="chapter-menu-heading"><div><h3 id="chapter-menu-title">{activeProject?.title ?? selectedLibraryGroup?.book ?? '저장된 말씀'}</h3><p>{projectChapterOptions.filter((option) => option.hasRecording).length}개 장 녹음됨</p></div><button type="button" onClick={() => setLibraryChapterMenuOpen(false)} aria-label="목록 닫기"><X size={22} /></button></div>
              <div className="chapter-menu-list">
                {projectChapterOptions.map((option) => {
                  const selected = selectedLibraryGroup?.key === option.key;
                  return <button className={selected ? 'selected' : ''} type="button" disabled={!option.hasRecording} onClick={() => { stopChapterPlayback(); setSelectedLibraryChapter(option.key); setSelectedLibraryRecordingId(null); }} key={option.key}><span>{option.book}</span><strong>{option.chapter}{option.book === '시편' ? '편' : '장'}</strong><small>{option.hasRecording ? selected ? '선택한 장' : '녹음됨' : '아직 녹음하지 않음'}</small></button>;
                })}
              </div>
              {selectedLibraryGroup && <div className="verse-menu-section">
                <div className="verse-menu-heading"><strong>{selectedLibraryGroup.book} {selectedLibraryGroup.chapter}{selectedLibraryGroup.book === '시편' ? '편' : '장'} · 절별 녹음</strong><span>{chapterQueue.length}/{selectedLibraryVerseCount}절</span></div>
                <div className="verse-menu-list">
                  {Array.from({ length: selectedLibraryVerseCount }, (_, index) => {
                    const verse = index + 1;
                    const recording = chapterQueue.find((item) => item.verse === verse);
                    return <button type="button" disabled={!recording} onClick={() => recording && openLibraryVerse(recording)} key={verse}><strong>{verse}절</strong><small>{recording ? '녹음 듣기' : '미녹음'}</small></button>;
                  })}
                </div>
              </div>}
            </dialog>
          </div>
        )}

        <p className="library-privacy"><Cloud size={14} /> 현재는 이 브라우저에서 저장한 녹음만 보여요. 다른 기기와 공유하는 가족 계정은 다음 단계에서 연결할 수 있어요.</p>
      </section>}

      <footer className="page-footer">
        <button className="theme-toggle" onClick={() => setOnboardingStep('welcome')} type="button" aria-label="시작 방식과 프로젝트 다시 선택"><Target size={18} /><span>프로젝트 선택</span></button>
        <button className="theme-toggle" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} type="button" aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          <span>{theme === 'dark' ? '라이트 모드' : '다크 모드'}</span>
        </button>
        <p>말씀유산 · 소중한 목소리를 오래 간직하는 성경 낭독</p>
      </footer>

      <nav className="mobile-nav" aria-label="주요 메뉴">
        <button className={appTab === 'recording' ? 'active' : ''} type="button" onClick={openRecordingTab}><Home size={19} /><span>녹음</span></button>
        <button className={appTab === 'library' ? 'active' : ''} type="button" onClick={openLibraryTab}><Headphones size={19} /><span>듣기</span></button>
        <button type="button"><Users size={19} /><span>가족</span></button>
      </nav>

      <button className="floating-home-button" type="button" onClick={() => { stopChapterPlayback(); setReturningHome(true); setBibleBackTarget('welcome'); setOnboardingStep('welcome'); }} aria-label="프로젝트와 자유 녹음을 선택하는 홈으로 이동"><Home size={22} /><span>홈</span></button>

      {headphoneWarningOpen && (
        <div className="headphone-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHeadphoneWarningOpen(false); }}>
          <dialog className="headphone-modal" open aria-labelledby="headphone-modal-title">
            <span className="headphone-modal-icon"><Headphones size={28} /></span>
            <p className="eyebrow">녹음 품질 확인</p>
            <h2 id="headphone-modal-title">이어폰이 연결되어 있나요?</h2>
            <p>스피커로 BGM을 재생하면 음악이 마이크에 함께 들어가 목소리 품질이 낮아질 수 있어요. 이어폰을 연결한 뒤 녹음하는 것을 권장해요.</p>
            <div className="headphone-modal-actions">
              <button className="confirm" type="button" onClick={() => void startRecording(true)}><Headphones size={16} /> 이어폰 연결했어요</button>
              <button type="button" onClick={() => { stopPreview(); setHeadphoneWarningOpen(false); window.setTimeout(() => void startRecording(true), 0); }}><CircleStop size={16} /> BGM 끄고 녹음</button>
              <button className="cancel" type="button" onClick={() => setHeadphoneWarningOpen(false)}>취소</button>
            </div>
          </dialog>
        </div>
      )}

      {earnedCard && (() => {
        const column = earnedCard.spriteIndex % 4;
        const row = Math.floor(earnedCard.spriteIndex / 4);
        return (
          <div className="word-card-modal-backdrop" role="presentation">
            <dialog className="word-card-modal" open aria-labelledby="word-card-modal-title">
              <button className="word-card-close" type="button" onClick={() => setEarnedCard(null)} aria-label="말씀 카드 닫기"><X size={21} /></button>
              <p className="eyebrow">TODAY&apos;S WORD CARD</p>
              <h2 id="word-card-modal-title">오늘의 말씀 카드를 뽑았어요!</h2>
              <p className="word-card-instruction">카드를 눌러 뒤집어 보세요.</p>
              <div className={`word-card-scene ${wordCardFlipped ? 'flipped' : ''}`}>
                <button className="word-card" type="button" aria-label={`${earnedCard.name} 말씀 카드 뒤집기`} onClick={() => setWordCardFlipped((current) => !current)}>
                  <section className="word-card-face word-card-front">
                    <div className="word-card-art" style={{ backgroundImage: 'url(/cards/bible-character-sprite.png)', backgroundPosition: `${column / 3 * 100}% ${row / 3 * 100}%` }} />
                    <small>성경 속 말씀 인물</small>
                    <strong>{earnedCard.name}</strong>
                    <span><Sparkles size={13} /> 오늘의 카드</span>
                  </section>
                  <section className="word-card-face word-card-back">
                    <small>성경 속 말씀 인물</small>
                    <strong>{earnedCard.name}</strong>
                    <h3>{earnedCard.heading}</h3>
                    {wordCardExpanded && <p>{earnedCard.detail}</p>}
                    <span>카드를 누르면 앞면으로 돌아가요</span>
                  </section>
                </button>
                {wordCardFlipped && <button className="word-card-detail-toggle" type="button" onClick={() => setWordCardExpanded((current) => !current)}>{wordCardExpanded ? '간단히 보기' : '더 자세히'}</button>}
              </div>
              <button className="word-card-keep" type="button" onClick={() => setEarnedCard(null)}>내 카드로 간직하기</button>
            </dialog>
          </div>
        );
      })()}

      {notice && <output className="toast" aria-live="polite"><Check size={17} />{notice}</output>}
    </main>
  );
}
