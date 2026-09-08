import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const playback = readFileSync(new URL('./continuous-playback-view.tsx', import.meta.url), 'utf8');
const bgmTracks = ['aeternum', 'unto-thee', 'the-kings-return'];

describe('아이폰 이어듣기 BGM', () => {
  it('앱 내부 BGM을 iOS에서도 목소리와 같은 Web Audio 엔진으로 재생한다', () => {
    expect(page).toContain("audioSrc: '/api/bgm/aeternum?v=3'");
    expect(page).toContain('createMediaElementSource(audio)');
    expect(page).toContain('playbackBgmAudioRef');
    expect(page).toContain('createBufferBgmPlayer(context,');
    expect(page).toContain('playbackBgmAudioRef.current?.setVolume(volume)');
    expect(page).not.toContain('new Audio(option.audioSrc)');
    const previewHandler = page.slice(page.indexOf('const playSelectedBgm'), page.indexOf('const pauseSelectedBgm'));
    expect(previewHandler).toContain('startInternalChapterBgm(context, option.id)');
    expect(previewHandler).not.toContain('youtubePlayerRef.current.loadVideoById');
    expect(playback).toContain('onInput={(event) => onVolumeChange(Number(event.currentTarget.value))}');
  });

  it.each(bgmTracks)('%s 음원을 Git 정적 파일이 아닌 R2 스트리밍 API로 요청한다', (track) => {
    expect(page).toContain(`audioSrc: '/api/bgm/${track}?v=3'`);
  });
});
