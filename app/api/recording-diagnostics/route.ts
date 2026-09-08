import { authenticateRequest } from '@/lib/supabase-auth';
import { sanitizeRecordingDiagnostic } from '@/lib/recording-diagnostics';

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return new Response(null, { status: 403 });
  if (!await authenticateRequest(request)) return new Response(null, { status: 401 });
  // Bound the body while reading, including chunked requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2048) { await reader.cancel(); return new Response(null, { status: 413 }); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let data: unknown;
  try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { return new Response(null, { status: 400 }); }
  const event = sanitizeRecordingDiagnostic(data);
  if (!event) return new Response(null, { status: 400 });
  console.error(JSON.stringify({ event: 'recording_client_failure', time: Date.now(), ...event }));
  return new Response(null, { status: 204 });
}
