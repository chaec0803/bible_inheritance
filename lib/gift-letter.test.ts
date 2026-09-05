import { describe, expect, it } from 'vitest';
import { decodeGiftLetterAudio, normalizeGiftLetter } from './gift-letter';

describe('말씀 선물 편지 정책', () => {
  it('편지 없음과 공백이 정리된 텍스트 편지를 허용한다', () => {
    expect(normalizeGiftLetter(undefined)).toEqual({ type: 'none' });
    expect(normalizeGiftLetter({ type: 'text', text: '  늘 사랑해요.  ' })).toEqual({ type: 'text', text: '늘 사랑해요.' });
  });

  it('텍스트와 음성을 섞거나 제한을 넘긴 편지를 거절한다', () => {
    expect(normalizeGiftLetter({ type: 'text', text: 'x'.repeat(501) })).toBeNull();
    expect(normalizeGiftLetter({ type: 'voice', dataUrl: 'data:audio/webm;base64,AQID', mimeType: 'audio/webm', sizeBytes: 3, durationSeconds: 91 })).toBeNull();
    expect(normalizeGiftLetter({ type: 'both', text: '안녕', dataUrl: 'x' })).toBeNull();
    expect(normalizeGiftLetter({ type: 'text', text: '안녕', dataUrl: 'data:audio/webm;base64,AQID' })).toBeNull();
    expect(normalizeGiftLetter({ type: 'voice', text: '안녕', dataUrl: 'data:audio/webm;base64,AQID', mimeType: 'audio/webm', sizeBytes: 3, durationSeconds: 3 })).toBeNull();
  });

  it('손상된 base64 음성은 안전하게 거절한다', () => {
    const letter = normalizeGiftLetter({ type: 'voice', dataUrl: 'data:audio/webm;base64,###', mimeType: 'audio/webm', sizeBytes: 3, durationSeconds: 3 });
    expect(letter?.type === 'voice' ? decodeGiftLetterAudio(letter) : undefined).toBeNull();
  });

  it('유효한 음성 편지를 원래 바이트로 복원한다', () => {
    const letter = normalizeGiftLetter({ type: 'voice', dataUrl: 'data:audio/webm;base64,AQID', mimeType: 'audio/webm', sizeBytes: 3, durationSeconds: 4 });
    expect(letter?.type).toBe('voice');
    if (letter?.type === 'voice') expect([...decodeGiftLetterAudio(letter)!]).toEqual([1, 2, 3]);
  });
});
