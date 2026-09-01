import { env } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';
import { ensureDbSchema, getDb } from '@/db';
import { recordings } from '@/db/schema';
import { CURRENT_DATA_VERSION } from '@/lib/data-version';
import { parseByteRange } from '@/lib/http-range';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const ownerKey = new URL(request.url).searchParams.get('owner')?.trim() ?? '';
  if (!/^[a-f0-9-]{20,80}$/i.test(ownerKey)) {
    return Response.json({ error: '재생 권한이 없습니다.' }, { status: 401 });
  }
  await ensureDbSchema();

  const { id } = await context.params;
  const [recording] = await getDb()
    .select({ objectKey: recordings.objectKey, mimeType: recordings.mimeType })
    .from(recordings)
    .where(and(eq(recordings.id, id), eq(recordings.ownerKey, ownerKey), eq(recordings.dataVersion, CURRENT_DATA_VERSION)))
    .limit(1);

  if (!recording) return Response.json({ error: '녹음을 찾을 수 없습니다.' }, { status: 404 });

  const metadata = await env.FILES.head(recording.objectKey);
  if (!metadata) return Response.json({ error: '음성 파일을 찾을 수 없습니다.' }, { status: 404 });
  const range = parseByteRange(request.headers.get('range'), metadata.size);
  const object = await env.FILES.get(recording.objectKey, range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined);
  if (!object) return Response.json({ error: '음성 파일을 찾을 수 없습니다.' }, { status: 404 });

  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    'Content-Disposition': 'inline',
    'Content-Length': String(range ? range.end - range.start + 1 : metadata.size),
    'Content-Type': recording.mimeType,
    ETag: object.httpEtag,
  });
  object.writeHttpMetadata(headers);
  if (range) headers.set('Content-Range', `bytes ${range.start}-${range.end}/${metadata.size}`);

  return new Response(object.body, { headers, status: range ? 206 : 200 });
}

export async function PUT(request: Request, context: RouteContext) {
  const ownerKey = request.headers.get('x-verse-legacy-owner')?.trim() ?? '';
  if (!/^[a-f0-9-]{20,80}$/i.test(ownerKey)) {
    return Response.json({ error: '교체 권한이 없습니다.' }, { status: 401 });
  }
  await ensureDbSchema();

  const { id } = await context.params;
  const [existing] = await getDb()
    .select({ objectKey: recordings.objectKey })
    .from(recordings)
    .where(and(eq(recordings.id, id), eq(recordings.ownerKey, ownerKey), eq(recordings.dataVersion, CURRENT_DATA_VERSION)))
    .limit(1);

  if (!existing) return Response.json({ error: '교체할 녹음을 찾을 수 없습니다.' }, { status: 404 });

  const formData = await request.formData();
  const audio = formData.get('audio');
  if (!(audio instanceof File) || audio.size === 0) {
    return Response.json({ error: '새 녹음 파일이 없습니다.' }, { status: 400 });
  }
  if (audio.size > 25 * 1024 * 1024) {
    return Response.json({ error: '한 번의 녹음은 25MB까지 저장할 수 있어요.' }, { status: 413 });
  }

  const readText = (key: string, maxLength: number) => {
    const value = formData.get(key);
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
  };
  const book = readText('book', 30) || '시편';
  const projectId = readText('projectId', 100) || 'legacy';
  const projectTitle = readText('projectTitle', 100) || '이전 녹음';
  const recordingGroupId = readText('recordingGroupId', 100) || null;
  const recordingMode = readText('recordingMode', 20) === 'continuous' ? 'continuous' : 'verse';
  const chapter = Number(readText('chapter', 4));
  const verse = Number(readText('verse', 4));
  const verseText = readText('verseText', 1000);
  const bgmId = readText('bgmId', 80) || 'none';
  const reverb = readText('reverb', 40) || '원음';
  const durationSeconds = Math.max(1, Number(readText('durationSeconds', 8)) || 1);

  if (!Number.isInteger(chapter) || chapter < 1 || !Number.isInteger(verse) || verse < 1 || !verseText) {
    return Response.json({ error: '구절 정보가 올바르지 않습니다.' }, { status: 400 });
  }

  const replacementObjectKey = `${ownerKey}/${id}-replacement-${crypto.randomUUID()}`;
  const mimeType = audio.type || 'audio/webm';
  const createdAt = Date.now();

  await env.FILES.put(replacementObjectKey, audio.stream(), {
    httpMetadata: { contentType: mimeType },
    customMetadata: { recordingId: id },
  });

  try {
    await getDb()
      .update(recordings)
      .set({
        book,
        dataVersion: CURRENT_DATA_VERSION,
        projectId,
        projectTitle,
        recordingGroupId,
        recordingMode,
        chapter,
        verse,
        verseText,
        bgmId,
        reverb,
        objectKey: replacementObjectKey,
        mimeType,
        sizeBytes: audio.size,
        durationSeconds,
        createdAt,
      })
      .where(and(eq(recordings.id, id), eq(recordings.ownerKey, ownerKey), eq(recordings.dataVersion, CURRENT_DATA_VERSION)));
  } catch (error) {
    await env.FILES.delete(replacementObjectKey);
    throw error;
  }

  await env.FILES.delete(existing.objectKey);
  return Response.json({ id, createdAt });
}

export async function DELETE(request: Request, context: RouteContext) {
  const ownerKey = request.headers.get('x-verse-legacy-owner')?.trim() ?? '';
  if (!/^[a-f0-9-]{20,80}$/i.test(ownerKey)) {
    return Response.json({ error: '삭제 권한이 없습니다.' }, { status: 401 });
  }
  await ensureDbSchema();

  const { id } = await context.params;
  const [existing] = await getDb()
    .select({ objectKey: recordings.objectKey })
    .from(recordings)
    .where(and(eq(recordings.id, id), eq(recordings.ownerKey, ownerKey), eq(recordings.dataVersion, CURRENT_DATA_VERSION)))
    .limit(1);

  if (!existing) return Response.json({ error: '삭제할 녹음을 찾을 수 없습니다.' }, { status: 404 });

  await getDb().delete(recordings).where(and(eq(recordings.id, id), eq(recordings.ownerKey, ownerKey), eq(recordings.dataVersion, CURRENT_DATA_VERSION)));
  await env.FILES.delete(existing.objectKey);
  return Response.json({ id });
}
