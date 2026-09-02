import { describe, expect, it } from 'vitest';
import { createStoredZip } from './zip';

describe('선물 다운로드 ZIP', () => {
  it('UTF-8 파일 이름과 원본 바이트를 압축 없이 묶는다', () => {
    const zip = createStoredZip([
      { name: '선물정보.txt', data: new TextEncoder().encode('시편 23편') },
      { name: '01-시편-23-1.webm', data: new Uint8Array([1, 2, 3, 4]) },
    ]);
    expect(Array.from(zip.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(new TextDecoder().decode(zip)).toContain('선물정보.txt');
    expect(Array.from(zip.slice(-22, -18))).toEqual([0x50, 0x4b, 0x05, 0x06]);
  });
});
