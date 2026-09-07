import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const playback = readFileSync(new URL('./continuous-playback-view.tsx', import.meta.url), 'utf8');
const bgmTracks = ['aeternum', 'unto-thee', 'the-kings-return'];

describe('아이폰 이어듣기 BGM', () => {
  it('앱 내부 BGM을 iOS에서도 안정적인 전용 audio 요소로 재생한다', () => {
    expect(page).toContain("audioSrc: '/api/bgm/aeternum?v=3'");
    expect(page).toContain('createMediaElementSource(audio)');
    expect(page).toContain('playbackBgmAudioRef');
    expect(page).toContain('chapterBgmGainController.connect(bgmAudio, volume)');
    expect(page).toContain('chapterBgmGainController.setVolume(volume)');
    expect(page).toContain('await bgmAudio.play()');
    const previewHandler = page.slice(page.indexOf('const playSelectedBgm'), page.indexOf('const pauseSelectedBgm'));
    expect(previewHandler).toContain('startInternalChapterBgm(context, option.id)');
    expect(previewHandler).not.toContain('youtubePlayerRef.current.loadVideoById');
    expect(playback).toContain('onInput={(event) => onVolumeChange(Number(event.currentTarget.value))}');
  });

  it.each(bgmTracks)('%s 음원을 Git 정적 파일이 아닌 R2 스트리밍 API로 요청한다', (track) => {
    expect(page).toContain(`audioSrc: '/api/bgm/${track}?v=3'`);
  });
});
