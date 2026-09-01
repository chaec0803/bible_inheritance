import { stat } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const spriteSheets = [
  'public/cards/bible-character-sprite.webp',
  'public/cards/bible-character-sprite-v2.webp',
  'public/cards/bible-character-sprite-v3.webp',
];

describe('말씀카드 이미지 성능 예산', () => {
  it.each(spriteSheets)('%s는 500KB 이하 WebP다', async (path) => {
    const file = await stat(path);
    expect(file.size).toBeLessThanOrEqual(500 * 1024);
  });
});
