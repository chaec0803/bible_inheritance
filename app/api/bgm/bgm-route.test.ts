import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const route = readFileSync(new URL('./[track]/route.ts', import.meta.url), 'utf8');

describe('BGM streaming API', () => {
  it('supports byte-range playback with public caching', () => {
    expect(route).toContain("'Accept-Ranges': 'bytes'");
    expect(route).toContain("status: range ? 206 : 200");
    expect(route).toContain("'Content-Type': 'audio/mpeg'");
    expect(route).toContain("'Cache-Control': 'public, max-age=31536000, immutable'");
  });

  it('is read-only after R2 bootstrap', () => {
    expect(route).not.toContain('export async function PUT');
    expect(route).not.toContain('BGM_UPLOAD_TOKEN');
  });
});
