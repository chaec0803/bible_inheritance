'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  Download,
  Headphones,
  Home,
  Mic,
  Moon,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Sparkles,
  Sun,
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

type YouTubePlayer = {
  destroy: () => void;
  loadVideoById: (options: {
    videoId: string;
    startSeconds: number;
    endSeconds: number;
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

function getSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return (
    ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find((type) =>
      MediaRecorder.isTypeSupported(type),
    ) ?? ''
  );
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
  const [volume, setVolume] = useState(28);
  const [notice, setNotice] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [playerReady, setPlayerReady] = useState(false);
  const [activePreview, setActivePreview] = useState<string | null>(null);
  const [previewRemaining, setPreviewRemaining] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const recordingStartedAtRef = useRef(0);
  const objectUrlsRef = useRef(new Set<string>());
  const youtubeContainerRef = useRef<HTMLDivElement | null>(null);
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const previewTimerRef = useRef<number | null>(null);

  const currentTake = takes[verseIndex];
  const hasTake = Boolean(currentTake);

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
            event.target.setVolume(28);
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
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const completedCount = saved.filter(Boolean).length;
  const progress = useMemo(
    () => Math.round((completedCount / verses.length) * 100),
    [completedCount],
  );

  const stopPreview = () => {
    if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
    previewTimerRef.current = null;
    youtubePlayerRef.current?.stopVideo();
    setActivePreview(null);
    setPreviewRemaining(0);
  };

  const startPreview = (option: BgmOption) => {
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
    setVerseIndex(safeIndex);
    setSeconds(takes[safeIndex]?.duration ?? 0);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setNotice('이 브라우저에서는 마이크 녹음을 지원하지 않아요. 최신 Safari나 Chrome을 사용해 주세요.');
      return;
    }

    setRequestingMic(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const targetVerseIndex = verseIndex;

      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      discardRecordingRef.current = false;
      recordingStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const chunks = [...chunksRef.current];
        chunksRef.current = [];
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        setRecording(false);

        if (discardRecordingRef.current || chunks.length === 0) return;

        const finalMimeType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: finalMimeType });
        const url = URL.createObjectURL(blob);
        const duration = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
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
        setNotice('실제 음성 녹음이 완료됐어요. 바로 들어보거나 내려받을 수 있어요.');
      };

      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
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
      setNotice('마이크 녹음을 시작했어요. 편안하게 읽어 주세요.');
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

  const saveVerse = () => {
    if (!currentTake) return;
    const nextSaved = [...saved];
    nextSaved[verseIndex] = true;
    setSaved(nextSaved);
    setNotice(`${verseIndex + 1}절을 완료로 표시했어요. 음성 파일은 아래에서 내려받을 수 있어요.`);
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

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#recording" aria-label="말씀유산 홈">
          <span className="brand-mark"><BookOpen size={20} /></span>
          <span><strong>말씀유산</strong><small>VERSE LEGACY</small></span>
        </a>
        <div className="project-progress" aria-label={`시편 23편 ${progress}% 완료`}>
          <div><span>시편 23편</span><strong>{completedCount}/{verses.length}절</strong></div>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
        </div>
        <button className="icon-button" type="button" aria-label="설정"><Settings2 size={20} /></button>
      </header>

      <div className="prototype-note"><Sparkles size={15} /> 실제 마이크 녹음 가능 · 음성은 이 기기에서 재생하거나 내려받을 수 있어요.</div>

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
              {recording ? '녹음 중' : hasTake ? '재생 가능' : '녹음 전'}
            </span>
          </div>

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
            <button className="round-button save" onClick={saveVerse} disabled={!hasTake || recording} type="button" aria-label="이 구절 완료"><Check size={21} /></button>
          </div>

          {currentTake && !recording && (
            <div className="take-preview">
              <div className="take-preview-heading">
                <span><AudioLines size={18} /></span>
                <p><strong>{verseIndex + 1}절 녹음 완료</strong><small>{formatTime(currentTake.duration)} · 지금 바로 재생할 수 있어요.</small></p>
              </div>
              {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- 사용자가 방금 만든 음성 녹음에는 별도 자막 파일이 없습니다. */}
              <audio className="recording-preview" controls preload="metadata" src={currentTake.url}>녹음 재생을 지원하지 않는 브라우저입니다.</audio>
              <button className="download-button" onClick={downloadTake} type="button"><Download size={15} /> 음성 파일 내려받기</button>
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
            <p>목소리에 자연스러운 공간감을 더해요.</p>
            <div className="segment-control">
              {reverbOptions.map((option) => (
                <button className={reverb === option ? 'selected' : ''} onClick={() => setReverb(option)} type="button" key={option}>{option}</button>
              ))}
            </div>
          </fieldset>

          <fieldset className="setting-group">
            <legend><Music2 size={17} /> 배경음악</legend>
            <p>원본 유튜브 음원을 공식 플레이어로 10초 미리 들어요.</p>
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
                    <button className="preview-button" onClick={() => startPreview(option)} type="button" aria-label={`${option.name} 10초 미리듣기`}>
                      {activePreview === option.id ? <Pause size={13} /> : <Play size={13} />}
                      {activePreview === option.id ? `${previewRemaining}초` : '10초 듣기'}
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
            <span><Volume2 size={17} /> 미리듣기 음량 <strong>{volume}%</strong></span>
            <input type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} disabled={bgm === 'none'} />
          </label>

          <div className="sound-summary">
            <Sparkles size={18} />
            <p><strong>10초 미리듣기</strong><small>유튜브 원본을 재생하며, BGM과 리버브를 녹음 파일에 합치는 기능은 다음 단계예요.</small></p>
          </div>
        </aside>
      </section>

      <footer className="page-footer">
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
