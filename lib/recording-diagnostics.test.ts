import { afterEach, describe, expect, it, vi } from 'vitest';
import { sanitizeRecordingDiagnostic } from './recording-diagnostics';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('recording diagnostics', () => {
  it('keeps useful codes and removes raw messages, URLs, identity and audio data', () => {
    expect(sanitizeRecordingDiagnostic({ stage: 'upload', status: 413, errorName: 'TypeError', sizeBytes: 99, message: 'private text', url: 'https://secret', userId: 'private', audio: 'base64', browser: 'Safari/26.0' })).toEqual({ stage: 'upload', status: 413, errorName: 'TypeError', sizeBytes: 99, browser: 'Safari/26.0' });
    expect(sanitizeRecordingDiagnostic({ stage: 'arbitrary-private-text' })).toBeNull();
  });

  it('retains an offline failure locally and sends only bounded, deduplicated diagnostics', async () => {
    vi.resetModules();
    const { reportRecordingFailure } = await import('./recording-diagnostics');
    const values = new Map<string, string>();
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', { onLine: false, userAgent: 'iPhone' });
    vi.stubGlobal('document', { visibilityState: 'hidden' });
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value) });
    const fetcher = vi.fn().mockRejectedValue(new TypeError('offline'));
    vi.stubGlobal('fetch', fetcher);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    reportRecordingFailure('microphone', new DOMException('private device name', 'NotAllowedError'));
    reportRecordingFailure('microphone', new DOMException('private device name', 'NotAllowedError'));
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledOnce();
    const entries = JSON.parse(values.get('verse-recording-diagnostics')!);
    expect(entries[0]).toMatchObject({ stage: 'microphone', errorName: 'NotAllowedError', online: false, visibility: 'hidden' });
    expect(JSON.stringify(entries)).not.toContain('private');
    for (let status = 400; status < 450; status++) reportRecordingFailure('upload', undefined, { status });
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(20);
  });
});
