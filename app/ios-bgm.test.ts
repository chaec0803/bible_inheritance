import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const bgmTracks = ['aeternum', 'unto-thee', 'the-kings-return'];

describe('아이폰 이어듣기 BGM', () => {
  it('YouTube 대신 앱 내부 음원을 같은 Web Audio 출력으로 연결한다', () => {
    expect(page).toContain("audioSrc: '/api/bgm/aeternum?v=1'");
    expect(page).toContain('createMediaElementSource(audio)');
    expect(page).toContain('context.createBufferSource()');
    expect(page).toContain('source.connect(gain).connect(context.destination)');
    expect(page).toContain('playbackBgmGainRef.current.gain.value = volume / 100');
    const previewHandler = page.slice(page.indexOf('const playSelectedBgm'), page.indexOf('const pauseSelectedBgm'));
    expect(previewHandler).toContain('startInternalChapterBgm(context, option.id)');
    expect(previewHandler).not.toContain('youtubePlayerRef.current.loadVideoById');
  });

  it.each(bgmTracks)('%s 음원을 Git 정적 파일이 아닌 R2 스트리밍 API로 요청한다', (track) => {
    expect(page).toContain(`audioSrc: '/api/bgm/${track}?v=1'`);
  });
});
