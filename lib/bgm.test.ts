import { describe, expect, it } from 'vitest';
import { getBgmObjectKey } from './bgm';

describe('BGM R2 object allowlist', () => {
  it('maps the three public track ids to fixed R2 keys', () => {
    expect(getBgmObjectKey('aeternum')).toBe('bgm/aeternum.mp3');
    expect(getBgmObjectKey('unto-thee')).toBe('bgm/unto-thee.mp3');
    expect(getBgmObjectKey('the-kings-return')).toBe('bgm/the-kings-return.mp3');
  });

  it('rejects unknown ids and path traversal', () => {
    expect(getBgmObjectKey('unknown')).toBeNull();
    expect(getBgmObjectKey('../recording')).toBeNull();
  });
});
