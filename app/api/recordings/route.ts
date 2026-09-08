import { withRecordingDiagnostics } from '@/lib/recording-server-diagnostics';
import { env } from 'cloudflare:workers';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { ensureDbSchema, getDb } from '@/db';
import { recordings } from '@/db/schema';
import { CURRENT_DATA_VERSION } from '@/lib/data-version';
import { isRecordingMutationLocked } from '@/lib/recording-lock-server';
import { authenticateRequest } from '@/lib/supabase-auth';

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

function formText(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

async function handleGET(request: Request, context: unknown, phase: (name: string) => void) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const ownerKey = user.id;
  phase('schema');
  await ensureDbSchema();
  phase('metadata-read');

  const rows = await getDb()
    .select({
      id: recordings.id,
      projectId: recordings.projectId,
      projectTitle: recordings.projectTitle,
      recordingGroupId: recordings.recordingGroupId,
      recordingMode: recordings.recordingMode,
      book: recordings.book,
      chapter: recordings.chapter,
      verse: recordings.verse,
      verseText: recordings.verseText,
      bgmId: recordings.bgmId,
      reverb: recordings.reverb,
      mimeType: recordings.mimeType,
      sizeBytes: recordings.sizeBytes,
      durationSeconds: recordings.durationSeconds,
      createdAt: recordings.createdAt,
    })
    .from(recordings)
    .where(and(eq(recordings.ownerKey, ownerKey), eq(recordings.dataVersion, CURRENT_DATA_VERSION)))
    .orderBy(desc(recordings.createdAt));

  return Response.json({ recordings: rows });
}

async function handlePOST(request: Request, context: unknown, phase: (name: string) => void) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const ownerKey = user.id;
  phase('schema');
  await ensureDbSchema();
  phase('metadata-read');

  phase('upload-body');
  const formData = await request.formData();
  const audio = formData.get('audio');
  if (!(audio instanceof File) || audio.size === 0) {
    return Response.json({ error: '저장할 음성 파일이 없습니다.' }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: '한 번의 녹음은 25MB까지 저장할 수 있어요.' }, { status: 413 });
  }

  const book = formText(formData, 'book', 30) || '시편';
  const projectId = formText(formData, 'projectId', 100) || 'legacy';
  const projectTitle = formText(formData, 'projectTitle', 100) || '이전 녹음';
  const recordingGroupId = formText(formData, 'recordingGroupId', 100) || null;
  const recordingMode = formText(formData, 'recordingMode', 20) === 'continuous' ? 'continuous' : 'verse';
  const chapter = Number(formText(formData, 'chapter', 4));
  const verse = Number(formText(formData, 'verse', 4));
  const verseText = formText(formData, 'verseText', 1000);
  const bgmId = formText(formData, 'bgmId', 80) || 'none';
  const reverb = formText(formData, 'reverb', 40) || '원음';
  const durationSeconds = Math.max(1, Number(formText(formData, 'durationSeconds', 8)) || 1);
  const requestedRecordingId = formText(formData, 'clientRecordingId', 64);
  const clientRecordingId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedRecordingId)
    ? requestedRecordingId
    : null;

  if (!Number.isInteger(chapter) || chapter < 1 || !Number.isInteger(verse) || verse < 1 || !verseText) {
    return Response.json({ error: '구절 정보가 올바르지 않습니다.' }, { status: 400 });
  }

  const id = clientRecordingId ?? crypto.randomUUID();
  const objectKey = `${ownerKey}/${id}`;
  const mimeType = audio.type || 'audio/webm';
  const createdAt = Date.now();
  phase('metadata-read');
  const existing = await getDb()
    .select({ id: recordings.id, objectKey: recordings.objectKey })
    .from(recordings)
    .where(and(eq(recordings.ownerKey, ownerKey), eq(recordings.dataVersion, CURRENT_DATA_VERSION), eq(recordings.projectId, projectId), eq(recordings.book, book), eq(recordings.chapter, chapter), eq(recordings.verse, verse)));

  if (clientRecordingId && existing.some((item) => item.id === clientRecordingId)) {
    return Response.json({ id: clientRecordingId, alreadySaved: true }, { status: 200 });
  }

  if (await isRecordingMutationLocked(ownerKey, { projectId, book, chapter, verse })) {
    return Response.json({ error: '완료된 말씀은 더 이상 수정할 수 없어요.' }, { status: 409 });
  }

  phase('object-write');
  await env.FILES.put(objectKey, audio.stream(), {
    httpMetadata: { contentType: mimeType },
    customMetadata: { recordingId: id },
  });

  try {
    phase('metadata-write');
    await getDb().insert(recordings).values({
      id,
      ownerKey,
      dataVersion: CURRENT_DATA_VERSION,
      projectId,
      projectTitle,
      recordingGroupId,
      recordingMode,
      book,
      chapter,
      verse,
      verseText,
      bgmId,
      reverb,
      objectKey,
      mimeType,
      sizeBytes: audio.size,
      durationSeconds,
      createdAt,
    });
  } catch (error) {
    await env.FILES.delete(objectKey);
    throw error;
  }

  if (existing.length) {
    phase('metadata-write');
    await getDb().delete(recordings).where(inArray(recordings.id, existing.map((item) => item.id)));
    await Promise.all(existing.map((item) => env.FILES.delete(item.objectKey)));
  }

  return Response.json({ id, createdAt }, { status: 201 });
}

export const GET = withRecordingDiagnostics("library-get", handleGET);

export const POST = withRecordingDiagnostics("library-post", handlePOST);
