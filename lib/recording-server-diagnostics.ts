/** Server-only. Do not log request bodies, URLs, account IDs, or raw exception messages. */
export function withRecordingDiagnostics<C>(operation: string, handler: (request: Request, context: C, phase: (name: string) => void) => Promise<Response>) {
  return async (request: Request, context: C = undefined as C) => {
    const requestId = crypto.randomUUID();
    const started = Date.now();
    let phase = "authenticate";
    try {
      const response = await handler(request, context, name => { phase = name; });
      response.headers.set('X-Recording-Request-Id', requestId);
      if (!response.ok) console.error(JSON.stringify({ event: 'recording_server_failure', operation, phase, requestId, status: response.status, reason: response.headers.get('X-Recording-Error') ?? 'request-rejected', elapsedMs: Date.now() - started }));
      return response;
    } catch (error) {
      const errorName = error instanceof Error && /^[A-Za-z]{1,40}$/.test(error.name) ? error.name : 'UnknownError';
      console.error(JSON.stringify({ event: 'recording_server_failure', operation, phase, requestId, status: 500, errorName, elapsedMs: Date.now() - started }));
      return Response.json({ error: '녹음 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500, headers: { 'X-Recording-Request-Id': requestId } });
    }
  };
}
