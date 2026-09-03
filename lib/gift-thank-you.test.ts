import { describe, expect, it } from 'vitest';
import { THANK_YOU_TEMPLATES, normalizeThankYouNote } from './gift-thank-you';

describe('선물 감사 인사 정책', () => {
  it('바로 선택할 수 있는 감사 인사 템플릿을 제공한다', () => {
    expect(THANK_YOU_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    expect(THANK_YOU_TEMPLATES.every((note) => note.length > 0)).toBe(true);
  });

  it('직접 쓴 인사의 공백을 정리하고 300자로 제한한다', () => {
    expect(normalizeThankYouNote('  말씀 선물   정말 고마워요!  ')).toBe('말씀 선물 정말 고마워요!');
    expect(normalizeThankYouNote('가'.repeat(301))).toBeNull();
    expect(normalizeThankYouNote('   ')).toBeNull();
  });
});
