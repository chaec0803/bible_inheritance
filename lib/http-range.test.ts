import { describe, expect, it } from 'vitest';
import { parseByteRange } from './http-range';

describe('parseByteRange', () => {
  it('parses a bounded byte range', () => expect(parseByteRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 }));
  it('parses an open-ended range', () => expect(parseByteRange('bytes=90-', 100)).toEqual({ start: 90, end: 99 }));
  it('parses a suffix range', () => expect(parseByteRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 }));
  it('rejects an invalid range', () => expect(parseByteRange('bytes=100-120', 100)).toBeNull());
});
