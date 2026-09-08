export const recordingStages = ['microphone', 'audio-graph', 'recorder-create', 'recorder-start', 'recorder-runtime', 'capture-empty', 'local-save', 'local-read', 'local-delete', 'upload', 'library-load', 'audio-load', 'audio-play', 'bgm-play'] as const;
export type RecordingStage = typeof recordingStages[number];
const errorNames = ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'OverconstrainedError', 'SecurityError', 'NotSupportedError', 'InvalidStateError', 'QuotaExceededError', 'AbortError', 'DataError', 'UnknownError', 'TypeError', 'Error'];
export type RecordingDiagnostic = {
  stage: RecordingStage; errorName?: string; status?: number; mediaCode?: number;
  readyState?: number; networkState?: number; sizeBytes?: number; requestId?: string;
  online?: boolean; visibility?: string; browser?: string;
};

/** Explicit allowlist: never retain URLs, voices, verse text, account IDs, or raw error messages. */
export function sanitizeRecordingDiagnostic(input: unknown): RecordingDiagnostic | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  if (!recordingStages.includes(value.stage as RecordingStage)) return null;
  const result: RecordingDiagnostic = { stage: value.stage as RecordingStage };
  if (typeof value.errorName === 'string' && errorNames.includes(value.errorName)) result.errorName = value.errorName;
  for (const key of ['status', 'mediaCode', 'readyState', 'networkState', 'sizeBytes'] as const) {
    if (typeof value[key] === 'number' && Number.isSafeInteger(value[key]) && value[key] >= 0 && value[key] <= 1_000_000_000) result[key] = value[key];
  }
  if (typeof value.requestId === 'string' && /^[a-f0-9-]{36}$/.test(value.requestId)) result.requestId = value.requestId;
  if (typeof value.online === 'boolean') result.online = value.online;
  if (value.visibility === 'visible' || value.visibility === 'hidden') result.visibility = value.visibility;
  if (typeof value.browser === 'string' && /^(Safari|Chrome|Firefox|Edge|iOS|Other)(\/\d{1,3}(\.\d{1,3}){0,2})?$/.test(value.browser)) result.browser = value.browser;
  return result;
}

let sent = 0;
let windowStarted = 0;
const recent = new Map<string, number>();
export function reportRecordingFailure(stage: RecordingStage, error?: unknown, details: Omit<RecordingDiagnostic, 'stage'> = {}) {
  if (typeof window === 'undefined') return;
  try {
    const nested = error && typeof error === 'object' && 'error' in error ? error.error : error;
    const errorName = nested && typeof nested === 'object' && 'name' in nested ? String(nested.name) : undefined;
    const ua = navigator.userAgent;
    const match = ua.match(/(Edg|CriOS|Chrome|FxiOS|Firefox|Version)\/(\d+(?:\.\d+){0,2})/);
    const iosVersion = ua.match(/OS (\d+)_(\d+)/);
    const browser = /iPhone|iPad|iPod/.test(ua) ? `iOS${iosVersion ? `/${iosVersion[1]}.${iosVersion[2]}` : ''}` : match ? `${({ Edg: 'Edge', CriOS: 'Chrome', Chrome: 'Chrome', FxiOS: 'Firefox', Firefox: 'Firefox', Version: 'Safari' } as Record<string, string>)[match[1]]}/${match[2]}` : 'Other';
    const event = sanitizeRecordingDiagnostic({ stage, errorName, ...details, online: navigator.onLine, visibility: document.visibilityState, browser })!;
    const now = Date.now();
    const key = JSON.stringify(event);
    if (now - (recent.get(key) ?? 0) < 5_000) return;
    if (now - windowStarted >= 60_000) { sent = 0; windowStarted = now; recent.clear(); }
    if (sent >= 20) return;
    recent.set(key, now);
    sent++;
    console.warn('recording_diagnostic', event);
    try {
      const previous = JSON.parse(localStorage.getItem('verse-recording-diagnostics') ?? '[]');
      const entries = Array.isArray(previous) ? previous.slice(-49) : [];
      localStorage.setItem('verse-recording-diagnostics', JSON.stringify([...entries, { time: now, ...event }]));
    } catch { /* Storage failures must still reach the server when online. */ }
    void fetch('/api/recording-diagnostics', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event), keepalive: true,
    }).catch(() => undefined);
  } catch { /* Diagnostics must never interrupt recording or playback. */ }
}

export function reportAudioElementFailure(audio: HTMLAudioElement) {
  reportRecordingFailure('audio-load', undefined, { mediaCode: audio.error?.code, readyState: audio.readyState, networkState: audio.networkState });
}
