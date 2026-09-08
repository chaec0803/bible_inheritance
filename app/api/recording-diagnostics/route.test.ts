import { afterEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'test' }));
vi.mock('@/lib/supabase-auth', () => ({ authenticateRequest: auth }));
import { POST } from './route';
afterEach(() => { vi.restoreAllMocks(); auth.mockResolvedValue({ id: 'test' }); });
const request = (data: unknown) => new Request('https://example.test/api/recording-diagnostics', { method: 'POST', body: JSON.stringify(data) });

describe('diagnostic ingestion', () => {
  it('logs sanitized failure details, not caller supplied content', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect((await POST(request({ stage: 'audio-load', mediaCode: 4, message: 'secret', userId: 'private' }))).status).toBe(204);
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ event: 'recording_client_failure', stage: 'audio-load', mediaCode: 4 });
    expect(log.mock.calls[0][0]).not.toContain('secret');
    expect(log.mock.calls[0][0]).not.toContain('private');
  });
  it('rejects unauthenticated, invalid and oversized bodies', async () => {
    expect((await POST(request({ stage: 'unknown' }))).status).toBe(400);
    expect((await POST(request({ stage: 'upload', extra: 'x'.repeat(3000) }))).status).toBe(413);
    auth.mockResolvedValue(null);
    expect((await POST(request({ stage: 'upload' }))).status).toBe(401);
  });
});
