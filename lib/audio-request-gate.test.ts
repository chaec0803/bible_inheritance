import { describe, expect, it } from 'vitest';
import { createLatestAudioRequestGate } from './audio-request-gate';

describe('BGM 단일 재생 요청 정책', () => {
  it('나중에 선택한 곡만 현재 요청으로 인정한다', () => {
    const gate = createLatestAudioRequestGate();
    const first = gate.begin();
    const second = gate.begin();
    expect(gate.isCurrent(first)).toBe(false);
    expect(gate.isCurrent(second)).toBe(true);
  });

  it('정지 후 늦게 끝난 로딩 요청을 무효화한다', () => {
    const gate = createLatestAudioRequestGate();
    const loading = gate.begin();
    gate.cancel();
    expect(gate.isCurrent(loading)).toBe(false);
  });

  it('빠르게 세 곡을 눌러도 마지막 곡 하나만 시작할 수 있다', async () => {
    const gate = createLatestAudioRequestGate();
    const started: string[] = [];
    const load = async (name: string, delay: number) => {
      const request = gate.begin();
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (gate.isCurrent(request)) started.push(name);
    };
    await Promise.all([load('A', 20), load('B', 10), load('C', 1)]);
    expect(started).toEqual(['C']);
  });
});
