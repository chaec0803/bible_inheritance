import { describe, expect, it } from 'vitest';
import { CURRENT_DATA_VERSION, getLegacyStorageKeysToClear } from './data-version';

describe('새 계정 베타 데이터 세대', () => {
  it('이전 베타의 로컬 데이터는 첫 진입 때 모두 초기화한다', () => {
    expect(getLegacyStorageKeysToClear([
      'verse-legacy-owner',
      'verse-legacy-active-projects',
      'verse-legacy-word-card-awards',
      'verse-legacy-theme',
      'unrelated-key',
    ], 'old-beta')).toEqual([
      'verse-legacy-owner',
      'verse-legacy-active-projects',
      'verse-legacy-word-card-awards',
    ]);
  });

  it('이미 현재 데이터 세대면 다시 초기화하지 않는다', () => {
    expect(getLegacyStorageKeysToClear(['verse-legacy-owner'], CURRENT_DATA_VERSION)).toEqual([]);
  });
});
