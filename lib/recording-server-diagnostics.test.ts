import { afterEach, expect, it, vi } from 'vitest';
import { withRecordingDiagnostics } from './recording-server-diagnostics';
afterEach(() => vi.restoreAllMocks());
it('correlates object storage failure without exposing provider exception text', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const route = withRecordingDiagnostics('audio-get', async (_request, _context, phase) => {
    phase('object-head');
    throw new Error('secret object key');
  });
  const response = await route(new Request('https://example.test'));
  expect(response.status).toBe(500);
  const event = JSON.parse(log.mock.calls[0][0]);
  expect(event).toMatchObject({ phase: 'object-head', status: 500, requestId: response.headers.get('X-Recording-Request-Id') });
  expect(JSON.stringify(event)).not.toContain('secret');
});
