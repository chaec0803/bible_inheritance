'use client';

import { CircleStop, List, Pause, Play, Volume2, X } from 'lucide-react';

export type ContinuousPlaybackItem = {
  id: string;
  book: string;
  chapter: number;
  verse: number;
  verseText: string;
  readerName?: string;
};

export function ContinuousPlaybackView({
  items,
  index,
  paused,
  listOpen,
  volume,
  onClose,
  onTogglePlayback,
  onToggleList,
  onSelect,
  onVolumeChange,
  children,
}: {
  items: readonly ContinuousPlaybackItem[];
  index: number;
  paused: boolean;
  listOpen: boolean;
  volume: number;
  onClose: () => void;
  onTogglePlayback: () => void;
  onToggleList: () => void;
  onSelect: (index: number) => void;
  onVolumeChange: (volume: number) => void;
  children?: React.ReactNode;
}) {
  const current = items[index];
  if (!current) return null;
  return (
    <div className="continuous-player-backdrop" role="presentation">
      <dialog className="continuous-player-modal" open aria-labelledby="continuous-playback-title">
        <button className="continuous-player-close" type="button" onClick={onClose} aria-label="이어듣기 닫기"><X size={22} /></button>
        <p className="eyebrow">CONTINUOUS PLAYBACK</p>
        <div className="continuous-player-progress"><span style={{ width: `${((index + 1) / items.length) * 100}%` }} /></div>
        <small>{index + 1} / {items.length} · {current.book} {current.chapter}:{current.verse}{current.readerName ? ` · ${current.readerName}님의 목소리` : ''}</small>
        <div className="continuous-player-verse">
          <span>{current.verse}</span>
          <h2 id="continuous-playback-title">{current.verseText}</h2>
        </div>
        <label className="continuous-player-volume">
          <span><Volume2 size={15} /> BGM 볼륨 <strong>{volume}%</strong></span>
          <input aria-label="이어듣기 재생 중 배경음악 음량" type="range" min="0" max="100" value={volume} onChange={(event) => onVolumeChange(Number(event.target.value))} />
        </label>
        <div className="continuous-player-actions">
          <button className="continuous-player-list-trigger" type="button" onClick={onToggleList} aria-expanded={listOpen}><List size={19} /><span>목록</span></button>
          <button className="continuous-player-stop" type="button" onClick={onTogglePlayback}>{paused ? <Play size={18} /> : <Pause size={18} />}{paused ? '계속 듣기' : '일시정지'}</button>
          <button className="continuous-player-stop" type="button" onClick={onClose}><CircleStop size={18} /> 종료</button>
        </div>
        {listOpen && (
          <div className="continuous-player-list" aria-label="녹음된 절 목록">
            <strong>녹음된 절</strong>
            <div>{items.map((item, itemIndex) => (
              <button className={itemIndex === index ? 'playing' : ''} type="button" onClick={() => onSelect(itemIndex)} key={item.id}>
                <span>{item.book} {item.chapter}{item.book === '시편' ? '편' : '장'} · {item.verse}절</span>
                <small>{item.readerName ? `${item.readerName}님의 목소리 · ` : ''}{itemIndex === index ? '재생 중' : '여기부터 듣기'}</small>
              </button>
            ))}</div>
          </div>
        )}
        {children}
      </dialog>
    </div>
  );
}
