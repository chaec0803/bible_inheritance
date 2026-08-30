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
  Download,
  Headphones,
  Home,
  LoaderCircle,
  Mic,
  Moon,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Save,
  Sparkles,
  Sun,
  Target,
  Users,
  Volume2,
} from 'lucide-react';

const verses = [
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

type RecordingTake = {
  url: string;
  blob: Blob;
  mimeType: string;
  duration: number;
};

type SavedRecording = {
  id: string;
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
  const [recording, setRecording] = useState(false);
  const [requestingMic, setRequestingMic] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [takes, setTakes] = useState<(RecordingTake | null)[]>(() => verses.map(() => null));
  const [saved, setSaved] = useState<boolean[]>(() => verses.map(() => false));
  const [reverb, setReverb] = useState('따뜻하게');
  const [bgm, setBgm] = useState('still-waters');
  const [volume, setVolume] = useState(12);
  const [notice, setNotice] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [playerReady, setPlayerReady] = useState(false);
  const [activePreview, setActivePreview] = useState<string | null>(null);
  const [previewRemaining, setPreviewRemaining] = useState(0);
  const [libraryRecordings, setLibraryRecordings] = useState<SavedRecording[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [savingLibrary, setSavingLibrary] = useState(false);
  const [activeLibraryId, setActiveLibraryId] = useState<string | null>(null);
  const [ownerKey, setOwnerKey] = useState('');
  const [chapterPlaying, setChapterPlaying] = useState(false);
  const [replacingRecording, setReplacingRecording] = useState<SavedRecording | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<'welcome' | 'projects' | 'app'>('welcome');
  const [projectDuration, setProjectDuration] = useState<7 | 14>(7);
  const [selectedTemplateId, setSelectedTemplateId] = useState('psalm-23-beginner');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingAudioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const recordingStartedAtRef = useRef(0);
  const objectUrlsRef = useRef(new Set<string>());
  const youtubeContainerRef = useRef<HTMLDivElement | null>(null);
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const ownerKeyRef = useRef('');
  const libraryAudioRefs = useRef(new Map<string, HTMLAudioElement>());
  const activeLibraryRef = useRef<string | null>(null);
  const chapterPlayingRef = useRef(false);
  const chapterBgmIdRef = useRef<string | null>(null);

  const currentTake = takes[verseIndex];
  const hasTake = Boolean(currentTake);

  useEffect(() => {
    const completed = window.localStorage.getItem('verse-legacy-onboarding-complete') === 'true';
    const savedProjectId = window.localStorage.getItem('verse-legacy-project');
    const frame = window.requestAnimationFrame(() => {
      if (savedProjectId && projectTemplates.some((item) => item.id === savedProjectId)) {
        setSelectedTemplateId(savedProjectId);
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
        setSaved(verses.map((_, index) => recordings.some((item) => item.verse === index + 1)));
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
  }, []);

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
              setPreviewRemaining(0);
            }
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
      if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
      youtubePlayerRef.current?.destroy();
      youtubePlayerRef.current = null;
      window.onYouTubeIframeAPIReady = previousReadyHandler;
    };
  }, []);

  useEffect(() => {
    youtubePlayerRef.current?.setVolume(volume);
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
    () => Math.round((completedCount / verses.length) * 100),
    [completedCount],
  );
  const chapterQueue = useMemo(() => {
    const latestByVerse = new Map<number, SavedRecording>();
    libraryRecordings.forEach((item) => {
      if (!latestByVerse.has(item.verse)) latestByVerse.set(item.verse, item);
    });
    return [...latestByVerse.values()].sort((a, b) => a.verse - b.verse);
  }, [libraryRecordings]);

  const refreshLibrary = async () => {
    const recordings = await fetchLibrary(ownerKeyRef.current);
    setLibraryRecordings(recordings);
    setSaved(verses.map((_, index) => recordings.some((item) => item.verse === index + 1)));
  };

  const stopLibraryPlayback = (recordingId?: string) => {
    if (recordingId && activeLibraryRef.current !== recordingId) return;
    youtubePlayerRef.current?.stopVideo();
    activeLibraryRef.current = null;
    setActiveLibraryId(null);
    setActivePreview(null);
    setPreviewRemaining(0);
  };

  const stopChapterPlayback = () => {
    chapterPlayingRef.current = false;
    chapterBgmIdRef.current = null;
    setChapterPlaying(false);
    libraryAudioRefs.current.forEach((audio) => {
      if (!audio.paused) audio.pause();
    });
    stopLibraryPlayback();
  };

  const stopPreview = () => {
    if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
    previewTimerRef.current = null;
    youtubePlayerRef.current?.stopVideo();
    setActivePreview(null);
    setPreviewRemaining(0);
  };

  const playLibraryBgm = (recording: SavedRecording) => {
    if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
    previewTimerRef.current = null;

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
    setPreviewRemaining(0);
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
    chapterBgmIdRef.current = first.bgmId;
    setChapterPlaying(true);
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
      setNotice('시편 23편 이어듣기를 모두 마쳤어요.');
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

  const startPreview = (option: BgmOption) => {
    if (recording) {
      setNotice('녹음 중에는 배경음악이 나오지 않아요. 녹음이 끝난 뒤 미리 들어보세요.');
      return;
    }
    if (activeLibraryRef.current) {
      libraryAudioRefs.current.get(activeLibraryRef.current)?.pause();
      stopLibraryPlayback();
    }
    if (!option.videoId) {
      stopPreview();
      return;
    }
    if (activePreview === option.id) {
      stopPreview();
      return;
    }
    if (!playerReady || !youtubePlayerRef.current) {
      setNotice('유튜브 미리듣기를 준비하고 있어요. 잠시 후 다시 눌러 주세요.');
      return;
    }

    if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
    youtubePlayerRef.current.setVolume(volume);
    youtubePlayerRef.current.loadVideoById({
      videoId: option.videoId,
      startSeconds: option.startSeconds,
      endSeconds: option.startSeconds + 10,
    });
    setBgm(option.id);
    setActivePreview(option.id);
    setPreviewRemaining(10);
    previewTimerRef.current = window.setInterval(() => {
      setPreviewRemaining((remaining) => {
        if (remaining <= 1) {
          if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
          previewTimerRef.current = null;
          youtubePlayerRef.current?.stopVideo();
          setActivePreview(null);
          return 0;
        }
        return remaining - 1;
      });
    }, 1000);
  };

  const moveVerse = (nextIndex: number) => {
    if (recording || requestingMic) return;
    const safeIndex = Math.min(Math.max(nextIndex, 0), verses.length - 1);
    if (replacingRecording?.verse !== safeIndex + 1) setReplacingRecording(null);
    setVerseIndex(safeIndex);
    setSeconds(takes[safeIndex]?.duration ?? 0);
  };

  const startRetake = (item: SavedRecording) => {
    stopChapterPlayback();
    const targetIndex = item.verse - 1;
    setTakes((current) => {
      const next = [...current];
      const previousTake = next[targetIndex];
      if (previousTake) {
        URL.revokeObjectURL(previousTake.url);
        objectUrlsRef.current.delete(previousTake.url);
      }
      next[targetIndex] = null;
      return next;
    });
    setReplacingRecording(item);
    setVerseIndex(targetIndex);
    setSeconds(0);
    setBgm(item.bgmId);
    setReverb(item.reverb);
    setNotice(`${item.verse}절의 기존 녹음은 보존한 채 다시 녹음할 준비가 됐어요.`);
    window.requestAnimationFrame(() => {
      document.querySelector('#recording')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setNotice('이 브라우저에서는 마이크 녹음을 지원하지 않아요. 최신 Safari나 Chrome을 사용해 주세요.');
      return;
    }

    libraryAudioRefs.current.forEach((audio) => audio.pause());
    chapterPlayingRef.current = false;
    chapterBgmIdRef.current = null;
    setChapterPlaying(false);
    activeLibraryRef.current = null;
    setActiveLibraryId(null);
    stopPreview();
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
        setNotice('음량을 고르게 다듬은 녹음이 완료됐어요. 바로 들어보거나 내려받을 수 있어요.');
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
        new File([currentTake.blob], `시편23편_${verseIndex + 1}절.${extension}`, {
          type: currentTake.mimeType,
        }),
      );
      formData.append('book', '시편');
      formData.append('chapter', '23');
      formData.append('verse', String(verseIndex + 1));
      formData.append('verseText', verses[verseIndex]);
      formData.append('bgmId', bgm);
      formData.append('reverb', reverb);
      formData.append('durationSeconds', String(currentTake.duration));

      const isReplacingCurrentVerse = replacingRecording?.verse === verseIndex + 1;
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

      await refreshLibrary();
      if (isReplacingCurrentVerse) {
        setReplacingRecording(null);
        setNotice(`${verseIndex + 1}절을 새 녹음으로 안전하게 교체했어요.`);
      } else {
        setNotice(`${verseIndex + 1}절을 실제 보관함에 저장했어요. 나중에도 다시 들을 수 있어요.`);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '보관함 저장 중 문제가 생겼어요.');
    } finally {
      setSavingLibrary(false);
    }
  };

  const downloadTake = () => {
    if (!currentTake) return;
    const extension = currentTake.mimeType.includes('mp4')
      ? 'm4a'
      : currentTake.mimeType.includes('ogg')
        ? 'ogg'
        : 'webm';
    const anchor = document.createElement('a');
    anchor.href = currentTake.url;
    anchor.download = `말씀유산_시편23편_${verseIndex + 1}절.${extension}`;
    anchor.click();
  };

  const finishOnboarding = (projectId?: string) => {
    window.localStorage.setItem('verse-legacy-onboarding-complete', 'true');
    if (projectId) {
      window.localStorage.setItem('verse-legacy-project', projectId);
      setSelectedTemplateId(projectId);
      const project = projectTemplates.find((item) => item.id === projectId);
      setNotice(project?.custom ? '직접 프로젝트를 만들 준비가 됐어요.' : `‘${project?.title}’ 프로젝트를 시작했어요.`);
    } else {
      window.localStorage.removeItem('verse-legacy-project');
      setNotice('원하는 말씀을 자유롭게 녹음할 수 있어요.');
    }
    setOnboardingStep('app');
  };

  const selectedTemplate = projectTemplates.find((item) => item.id === selectedTemplateId) ?? projectTemplates[0];
  const visibleTemplates = projectTemplates.filter((item) => item.duration === projectDuration);

  return (
    <main className="app-shell">
      {onboardingStep !== 'app' && (
        <section className="onboarding-overlay" aria-label="말씀유산 시작 설정">
          <div className="onboarding-brand"><span className="brand-mark"><BookOpen size={20} /></span><strong>말씀유산</strong></div>
          {onboardingStep === 'welcome' ? (
            <div className="onboarding-card welcome-card">
              <p className="eyebrow">소중한 목소리를 오래 간직해요</p>
              <h1>어떤 방식으로 시작할까요?</h1>
              <p className="onboarding-lead">지금 마음에 맞는 방법을 골라보세요. 나중에 언제든 바꿀 수 있어요.</p>
              <div className="start-choice-grid">
                <button type="button" onClick={() => finishOnboarding()}>
                  <span><Sparkles size={22} /></span>
                  <strong>내 방식대로 자유롭게</strong>
                  <small>원하는 말씀을 골라 일정 없이 자유롭게 녹음해요.</small>
                  <em>바로 시작 <ArrowRight size={15} /></em>
                </button>
                <button className="recommended" type="button" onClick={() => setOnboardingStep('projects')}>
                  <i>추천</i><span><Target size={22} /></span>
                  <strong>완성 프로젝트로 시작하기</strong>
                  <small>정해진 기간 동안 조금씩 녹음해 하나의 말씀 작품을 완성해요.</small>
                  <em>프로젝트 고르기 <ArrowRight size={15} /></em>
                </button>
              </div>
            </div>
          ) : (
            <div className="onboarding-card project-picker-card">
              <button className="onboarding-back" type="button" onClick={() => setOnboardingStep('welcome')}><ChevronLeft size={16} /> 이전</button>
              <p className="eyebrow">완성 프로젝트</p>
              <h1>얼마 동안 함께 완성해볼까요?</h1>
              <div className="duration-picker" aria-label="프로젝트 기간">
                <button className={projectDuration === 7 ? 'selected' : ''} type="button" onClick={() => { setProjectDuration(7); setSelectedTemplateId('psalm-23-beginner'); }}>1주</button>
                <button className={projectDuration === 14 ? 'selected' : ''} type="button" onClick={() => { setProjectDuration(14); setSelectedTemplateId('comfort-14-beginner'); }}>2주</button>
                <span>1개월부터 3년 프로젝트는 준비 중이에요.</span>
              </div>
              <div className="project-picker-layout">
                <div className="project-template-list">
                  {visibleTemplates.map((project) => (
                    <button className={selectedTemplateId === project.id ? 'selected' : ''} type="button" onClick={() => setSelectedTemplateId(project.id)} key={project.id}>
                      <span className={`difficulty difficulty-${project.level}`}>{project.custom ? '직접 구성' : project.level}</span>
                      <strong>{project.title}</strong>
                      <small>{project.scope}</small>
                      <em><CalendarDays size={13} /> {project.duration}일 · {project.minutes}</em>
                    </button>
                  ))}
                </div>
                <aside className="project-schedule-preview">
                  <p className="eyebrow">자동으로 만든 일정</p>
                  <h2>{selectedTemplate.title}</h2>
                  {selectedTemplate.custom ? (
                    <div className="custom-project-preview"><Target size={28} /><strong>원하는 말씀을 직접 골라요</strong><p>범위를 선택하면 말씀 길이와 문단을 살펴 하루 분량을 자동으로 나눠드려요.</p></div>
                  ) : (
                    <ol>
                      {selectedTemplate.tasks.map((task, index) => (
                        <li key={task}><span>{index + 1}일</span><strong>{task}</strong></li>
                      ))}
                      {selectedTemplate.duration === 14 && <><li><span>13일</span><strong>밀린 녹음과 다시 녹음</strong></li><li><span>14일</span><strong>전체 확인하고 완성하기</strong></li></>}
                    </ol>
                  )}
                  <button className="start-project-button" type="button" onClick={() => finishOnboarding(selectedTemplate.id)}>{selectedTemplate.custom ? '직접 프로젝트 만들기' : '이 프로젝트 시작하기'} <ArrowRight size={16} /></button>
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
        <div className="project-progress" aria-label={`시편 23편 ${progress}% 완료`}>
          <div><span>시편 23편</span><strong>{completedCount}/{verses.length}절</strong></div>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
        </div>
        <a className="icon-button" href="#library" aria-label="보관함으로 이동"><Archive size={20} /></a>
      </header>

      <div className="prototype-note"><Cloud size={15} /> 보관함에 저장하면 나중에 다시 듣고, 선택한 BGM을 목소리 뒤에 함께 재생할 수 있어요.</div>

      <section className="workspace" id="recording">
        <aside className="chapter-panel" aria-label="프로젝트 정보">
          <div>
            <p className="eyebrow">우리 가족 첫 번째 낭독</p>
            <h2>시편 23편</h2>
            <p className="muted">엄마의 목소리로 남기는 말씀</p>
          </div>
          <div className="verse-list" aria-label="구절 목록">
            {verses.map((_, index) => (
              <button
                className={`verse-item ${verseIndex === index ? 'active' : ''}`}
                key={index}
                onClick={() => moveVerse(index)}
                type="button"
              >
                <span>{index + 1}절</span>
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
              <p className="eyebrow">시편 23편 · {verseIndex + 1}절</p>
              <h1>천천히, 평소 목소리로 읽어 주세요.</h1>
            </div>
            <span className={`status-pill ${recording ? 'live' : hasTake ? 'ready' : ''}`}>
              {recording ? '녹음 중' : hasTake ? '재생 가능' : replacingRecording ? '다시 녹음' : '녹음 전'}
            </span>
          </div>

          {replacingRecording && replacingRecording.verse === verseIndex + 1 && (
            <div className="retake-banner">
              <RotateCcw size={18} />
              <p><strong>{verseIndex + 1}절을 다시 녹음하고 있어요.</strong><small>새 녹음을 저장하기 전까지 기존 보관함 음성은 그대로 유지됩니다.</small></p>
              <button type="button" onClick={() => setReplacingRecording(null)}>취소</button>
            </div>
          )}

          <article className="verse-paper">
            <span className="verse-number">{verseIndex + 1}</span>
            <p>{verses[verseIndex]}</p>
          </article>

          <div className={`waveform ${recording ? 'recording' : ''}`} aria-label={recording ? '녹음 중인 음성 파형' : '대기 중인 음성 파형'}>
            {Array.from({ length: 34 }).map((_, index) => (
              <span key={index} style={{ height: `${12 + ((index * 17) % 42)}%`, animationDelay: `${index * 45}ms` }} />
            ))}
          </div>

          <div className="timer"><span>{formatTime(seconds)}</span><small>{requestingMic ? '마이크 연결을 요청하고 있어요' : recording ? '실제 마이크 음성을 녹음하고 있어요' : hasTake ? '아래에서 녹음을 확인해 주세요' : '버튼을 누르면 마이크 권한을 요청해요'}</small></div>

          <div className="record-controls">
            <button className="round-button secondary" onClick={resetTake} disabled={!recording && !hasTake} type="button" aria-label="다시 녹음"><RotateCcw size={20} /></button>
            <button className={`record-button ${recording ? 'recording' : ''}`} onClick={toggleRecording} disabled={requestingMic} type="button">
              <span>{recording ? <CircleStop size={27} /> : <Mic size={29} />}</span>
              {requestingMic ? '마이크 연결 중' : recording ? '녹음 멈추기' : '녹음 시작'}
            </button>
            <button className="round-button save" onClick={() => void saveVerse()} disabled={!hasTake || recording || savingLibrary} type="button" aria-label={replacingRecording ? '새 녹음으로 교체' : '이 구절을 보관함에 저장'}>{savingLibrary ? <LoaderCircle className="spin" size={20} /> : <Save size={20} />}</button>
          </div>

          {currentTake && !recording && (
            <div className="take-preview">
              <div className="take-preview-heading">
                <span><AudioLines size={18} /></span>
                <p><strong>{verseIndex + 1}절 녹음 완료</strong><small>{formatTime(currentTake.duration)} · 지금 바로 재생할 수 있어요.</small></p>
              </div>
              {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- 사용자가 방금 만든 음성 녹음에는 별도 자막 파일이 없습니다. */}
              <audio className="recording-preview" controls preload="metadata" src={currentTake.url}>녹음 재생을 지원하지 않는 브라우저입니다.</audio>
              <div className="take-actions">
                <button className="library-save-button" onClick={() => void saveVerse()} disabled={savingLibrary} type="button">{savingLibrary ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />} {replacingRecording ? '새 녹음으로 교체' : '보관함에 저장'}</button>
                <button className="download-button" onClick={downloadTake} type="button"><Download size={15} /> 파일 내려받기</button>
              </div>
            </div>
          )}

          <div className="verse-navigation">
            <button onClick={() => moveVerse(verseIndex - 1)} disabled={verseIndex === 0 || recording || requestingMic} type="button"><ChevronLeft size={18} /> 이전 구절</button>
            <span>{verseIndex + 1} / {verses.length}</span>
            <button onClick={() => moveVerse(verseIndex + 1)} disabled={verseIndex === verses.length - 1 || recording || requestingMic} type="button">다음 구절 <ChevronRight size={18} /></button>
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
            <p>선택만 해두세요. 녹음 중에는 조용하고, 보관함에서 다시 들을 때 함께 재생돼요.</p>
            <div className="music-list">
              {bgmOptions.map((option) => (
                <div className={`music-option ${bgm === option.id ? 'selected' : ''}`} key={option.id}>
                  <button
                    className="music-select"
                    onClick={() => {
                      setBgm(option.id);
                      if (!option.videoId) stopPreview();
                    }}
                    type="button"
                  >
                    <span className="music-icon">{option.videoId ? (option.recommended ? <Sparkles size={15} /> : '♪') : '—'}</span>
                    <span><strong>{option.name}</strong><small>{option.description}</small></span>
                    <span className="radio-dot" />
                  </button>
                  {option.videoId && (
                    <button className="preview-button" onClick={() => startPreview(option)} disabled={!playerReady} type="button" aria-label={`${option.name} 10초 미리듣기`}>
                      {activePreview === option.id ? <Pause size={13} /> : <Play size={13} />}
                      {activePreview === option.id ? `${previewRemaining}초` : playerReady ? '10초 듣기' : '준비 중'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </fieldset>

          <div className={`youtube-preview-shell ${activePreview ? 'active' : ''}`} aria-label="유튜브 배경음악 미리듣기">
            <div ref={youtubeContainerRef} />
            {!activePreview && <div className="youtube-placeholder"><Play size={18} /><span>{playerReady ? '음악을 골라 10초 들어보세요' : '미리듣기를 준비하고 있어요'}</span></div>}
          </div>

          <label className="volume-control">
            <span><Volume2 size={17} /> 미리듣기·이어듣기 BGM 음량 <strong>{volume}%</strong></span>
            <input type="range" min="0" max="40" value={volume} onChange={(event) => setVolume(Number(event.target.value))} disabled={bgm === 'none'} />
          </label>

          <div className="sound-summary">
            <Sparkles size={18} />
            <p><strong>절마다 목소리 크기를 자동으로 맞춰요</strong><small>새 녹음에는 음량 보정과 선택한 리버브가 적용되고, BGM은 전체 이어듣기에서만 작게 재생돼요.</small></p>
          </div>
        </aside>
      </section>

      <section className="library-section" id="library" aria-labelledby="library-title">
        <div className="library-heading">
          <div>
            <p className="eyebrow">나중에도 다시 듣기</p>
            <h2 id="library-title">말씀 보관함</h2>
            <p className="muted">한 절은 목소리만 듣고, 전체 이어듣기에서는 선택한 배경음악과 함께 감상할 수 있어요.</p>
          </div>
          <span className="library-count"><Archive size={15} /> {libraryRecordings.length}개 보관</span>
        </div>

        {chapterQueue.length > 0 && (
          <div className="chapter-player">
            <div className="chapter-player-copy">
              <span><BookOpen size={20} /></span>
              <div>
                <strong>시편 23편 전체 이어듣기</strong>
                <small>{chapterQueue.length === verses.length ? '1절부터 6절까지' : `완성률과 관계없이 저장된 ${chapterQueue.length}개 절`} · 절이 바뀌어도 배경음악은 끊기지 않아요.</small>
              </div>
            </div>
            <div className="chapter-player-actions">
              <label>
                <span><Volume2 size={14} /> BGM <strong>{volume}%</strong></span>
                <input aria-label="이어듣기 배경음악 음량" type="range" min="0" max="40" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
              </label>
              <button type="button" onClick={chapterPlaying ? stopChapterPlayback : startChapterPlayback}>
                {chapterPlaying ? <CircleStop size={17} /> : <Play size={17} />}
                {chapterPlaying ? '이어듣기 멈춤' : '전체 이어듣기'}
              </button>
            </div>
          </div>
        )}

        {libraryLoading ? (
          <div className="library-state"><LoaderCircle className="spin" size={28} /><strong>보관함을 불러오고 있어요</strong></div>
        ) : libraryRecordings.length === 0 ? (
          <div className="library-state empty">
            <span><Archive size={28} /></span>
            <strong>아직 저장된 녹음이 없어요</strong>
            <p>위에서 말씀을 녹음한 다음 ‘보관함에 저장’을 눌러 주세요.</p>
            <a href="#recording">첫 녹음 시작하기</a>
          </div>
        ) : (
          <div className="library-grid">
            {libraryRecordings.map((item) => {
              const savedBgm = bgmOptions.find((option) => option.id === item.bgmId) ?? bgmOptions[3];
              const isPlaying = activeLibraryId === item.id;
              return (
                <article className={`library-card ${isPlaying ? 'playing' : ''}`} key={item.id}>
                  <div className="library-card-top">
                    <span className="library-verse-number">{item.verse}</span>
                    <div><strong>{item.book} {item.chapter}편 · {item.verse}절</strong><small>{formatSavedDate(item.createdAt)} 저장</small></div>
                    {isPlaying && <span className="playing-badge"><AudioLines size={13} /> 재생 중</span>}
                  </div>
                  <blockquote>{item.verseText}</blockquote>
                  <div className="library-tags">
                    <span><Music2 size={13} /> {savedBgm.name}</span>
                    <span><Sparkles size={13} /> {item.reverb}</span>
                    <span>{formatTime(item.durationSeconds)}</span>
                  </div>
                  {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- 사용자가 직접 녹음한 음성에는 별도 자막 파일이 없습니다. */}
                  <audio
                    className="library-audio"
                    controls
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
                  >저장된 녹음 재생을 지원하지 않는 브라우저입니다.</audio>
                  <p className="library-playback-note">
                    {isPlaying
                      ? chapterPlaying && savedBgm.videoId ? `이어듣기 중 · ‘${savedBgm.name}’이 작게 함께 재생돼요.` : '이 절의 목소리만 재생하고 있어요.'
                      : '한 절 재생은 목소리만 들려요. BGM은 위의 전체 이어듣기에서만 나와요.'}
                  </p>
                  <button className="library-retake-button" type="button" onClick={() => startRetake(item)}>
                    <RotateCcw size={14} /> 이 절 다시 녹음
                  </button>
                </article>
              );
            })}
          </div>
        )}

        <p className="library-privacy"><Cloud size={14} /> 현재는 이 브라우저에서 저장한 녹음만 보여요. 다른 기기와 공유하는 가족 계정은 다음 단계에서 연결할 수 있어요.</p>
      </section>

      <footer className="page-footer">
        <button className="theme-toggle" onClick={() => setOnboardingStep('welcome')} type="button" aria-label="시작 방식과 프로젝트 다시 선택"><Target size={18} /><span>프로젝트 선택</span></button>
        <button className="theme-toggle" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} type="button" aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          <span>{theme === 'dark' ? '라이트 모드' : '다크 모드'}</span>
        </button>
        <p>말씀유산 · 소중한 목소리를 오래 간직하는 성경 낭독</p>
      </footer>

      <nav className="mobile-nav" aria-label="주요 메뉴">
        <a className="active" href="#recording"><Home size={19} /><span>녹음</span></a>
        <a href="#library"><Headphones size={19} /><span>보관함</span></a>
        <a href="#family"><Users size={19} /><span>가족</span></a>
      </nav>

      {notice && <output className="toast" aria-live="polite"><Check size={17} />{notice}</output>}
    </main>
  );
}
