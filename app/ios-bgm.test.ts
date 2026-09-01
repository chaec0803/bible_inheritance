import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const bgmFiles = ['still-waters.wav', 'peaceful-morning.wav', 'breath-of-word.wav'];

describe('아이폰 이어듣기 BGM', () => {
  it('YouTube 대신 앱 내부 음원을 같은 Web Audio 출력으로 연결한다', () => {
    expect(page).toContain("audioSrc: '/bgm/still-waters.wav'");
    expect(page).toContain('createMediaElementSource(audio)');
    expect(page).toContain('context.createBufferSource()');
    expect(page).toContain('source.connect(gain).connect(context.destination)');
  });

  it.each(bgmFiles)('%s 음원이 유효한 WAV 파일이다', (file) => {
    const url = new URL(`../public/bgm/${file}`, import.meta.url);
    expect(readFileSync(url).subarray(0, 4).toString()).toBe('RIFF');
    expect(statSync(url).size).toBeGreaterThan(1_000_000);
  });
});
