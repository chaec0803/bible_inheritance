'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  Headphones,
  Home,
  Mic,
  Music2,
  RotateCcw,
  Settings2,
  Sparkles,
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
const bgmOptions = ['고요한 물가', '평안한 아침', '음악 없음'];

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export default function HomePage() {
  const [verseIndex, setVerseIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [hasTake, setHasTake] = useState(false);
  const [saved, setSaved] = useState<boolean[]>(() => verses.map(() => false));
  const [reverb, setReverb] = useState('따뜻하게');
  const [bgm, setBgm] = useState('고요한 물가');
  const [volume, setVolume] = useState(28);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!recording) return;
    const interval = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [recording]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 2200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const completedCount = saved.filter(Boolean).length;
  const progress = useMemo(
    () => Math.round((completedCount / verses.length) * 100),
    [completedCount],
  );

  const moveVerse = (nextIndex: number) => {
    if (recording) return;
    const safeIndex = Math.min(Math.max(nextIndex, 0), verses.length - 1);
    setVerseIndex(safeIndex);
    setSeconds(0);
    setHasTake(saved[safeIndex] ?? false);
  };

  const toggleRecording = () => {
    if (recording) {
      setRecording(false);
      setHasTake(true);
      setNotice('녹음을 멈췄어요. 들어보고 저장해 주세요.');
      return;
    }
    setSeconds(0);
    setHasTake(false);
    setRecording(true);
    setNotice('녹음을 시작했어요. 편안하게 읽어 주세요.');
  };

  const resetTake = () => {
    setRecording(false);
    setSeconds(0);
    setHasTake(false);
    setNotice('현재 녹음을 지웠어요. 다시 시작할 수 있어요.');
  };

  const saveVerse = () => {
    const nextSaved = [...saved];
    nextSaved[verseIndex] = true;
    setSaved(nextSaved);
    setHasTake(true);
    setNotice(`${verseIndex + 1}절을 안전하게 저장했어요.`);
    if (verseIndex < verses.length - 1) {
      window.setTimeout(() => moveVerse(verseIndex + 1), 450);
    }
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

      <div className="prototype-note"><Sparkles size={15} /> UI 학습용 프로토타입 · 실제 음성 파일은 저장되지 않아요.</div>

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
                {saved[index] ? <Check size={15} aria-label="저장 완료" /> : <span className="empty-dot" />}
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
              {recording ? '녹음 중' : hasTake ? '확인 필요' : '녹음 전'}
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

          <div className="timer"><span>{formatTime(seconds)}</span><small>{recording ? '마이크 입력을 확인하고 있어요' : hasTake ? '녹음이 준비되었어요' : '버튼을 누르면 바로 시작해요'}</small></div>

          <div className="record-controls">
            <button className="round-button secondary" onClick={resetTake} disabled={!recording && !hasTake} type="button" aria-label="다시 녹음"><RotateCcw size={20} /></button>
            <button className={`record-button ${recording ? 'recording' : ''}`} onClick={toggleRecording} type="button">
              <span>{recording ? <CircleStop size={27} /> : <Mic size={29} />}</span>
              {recording ? '녹음 멈추기' : '녹음 시작'}
            </button>
            <button className="round-button save" onClick={saveVerse} disabled={!hasTake || recording} type="button" aria-label="이 구절 저장"><Check size={21} /></button>
          </div>

          <div className="verse-navigation">
            <button onClick={() => moveVerse(verseIndex - 1)} disabled={verseIndex === 0 || recording} type="button"><ChevronLeft size={18} /> 이전 구절</button>
            <span>{verseIndex + 1} / {verses.length}</span>
            <button onClick={() => moveVerse(verseIndex + 1)} disabled={verseIndex === verses.length - 1 || recording} type="button">다음 구절 <ChevronRight size={18} /></button>
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
            <p>말씀을 방해하지 않도록 자동으로 작아져요.</p>
            <div className="music-list">
              {bgmOptions.map((option, index) => (
                <button className={bgm === option ? 'selected' : ''} onClick={() => setBgm(option)} type="button" key={option}>
                  <span className="music-icon">{index === 2 ? '—' : '♪'}</span>
                  <span><strong>{option}</strong><small>{index === 0 ? '잔잔한 피아노' : index === 1 ? '어쿠스틱 기타' : '목소리만 저장'}</small></span>
                  <span className="radio-dot" />
                </button>
              ))}
            </div>
          </fieldset>

          <label className="volume-control">
            <span><Volume2 size={17} /> BGM 음량 <strong>{volume}%</strong></span>
            <input type="range" min="0" max="60" value={volume} onChange={(event) => setVolume(Number(event.target.value))} disabled={bgm === '음악 없음'} />
          </label>

          <div className="sound-summary">
            <Sparkles size={18} />
            <p><strong>자동 보정 켜짐</strong><small>잡음을 줄이고 목소리 크기를 고르게 맞춰요.</small></p>
          </div>
        </aside>
      </section>

      <nav className="mobile-nav" aria-label="주요 메뉴">
        <a className="active" href="#recording"><Home size={19} /><span>녹음</span></a>
        <a href="#library"><Headphones size={19} /><span>보관함</span></a>
        <a href="#family"><Users size={19} /><span>가족</span></a>
      </nav>

      {notice && <output className="toast" aria-live="polite"><Check size={17} />{notice}</output>}
    </main>
  );
}
