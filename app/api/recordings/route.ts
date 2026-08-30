import { env } from 'cloudflare:workers';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { recordings } from '@/db/schema';

const OWNER_HEADER = 'x-verse-legacy-owner';
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

function readOwnerKey(request: Request) {
  const ownerKey = request.headers.get(OWNER_HEADER)?.trim() ?? '';
  return /^[a-f0-9-]{20,80}$/i.test(ownerKey) ? ownerKey : null;
}

function formText(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export async function GET(request: Request) {
  const ownerKey = readOwnerKey(request);
  if (!ownerKey) return Response.json({ error: '보관함 식별 정보가 없습니다.' }, { status: 401 });

  const rows = await getDb()
    .select({
      id: recordings.id,
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
    .where(eq(recordings.ownerKey, ownerKey))
    .orderBy(desc(recordings.createdAt));

  return Response.json({ recordings: rows });
}

export async function POST(request: Request) {
  const ownerKey = readOwnerKey(request);
  if (!ownerKey) return Response.json({ error: '보관함 식별 정보가 없습니다.' }, { status: 401 });

  const formData = await request.formData();
  const audio = formData.get('audio');
  if (!(audio instanceof File) || audio.size === 0) {
    return Response.json({ error: '저장할 음성 파일이 없습니다.' }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: '한 번의 녹음은 25MB까지 저장할 수 있어요.' }, { status: 413 });
  }

  const book = formText(formData, 'book', 30) || '시편';
  const chapter = Number(formText(formData, 'chapter', 4));
  const verse = Number(formText(formData, 'verse', 4));
  const verseText = formText(formData, 'verseText', 1000);
  const bgmId = formText(formData, 'bgmId', 80) || 'none';
  const reverb = formText(formData, 'reverb', 40) || '원음';
  const durationSeconds = Math.max(1, Number(formText(formData, 'durationSeconds', 8)) || 1);

  if (!Number.isInteger(chapter) || chapter < 1 || !Number.isInteger(verse) || verse < 1 || !verseText) {
    return Response.json({ error: '구절 정보가 올바르지 않습니다.' }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const objectKey = `${ownerKey}/${id}`;
  const mimeType = audio.type || 'audio/webm';
  const createdAt = Date.now();

  await env.FILES.put(objectKey, audio.stream(), {
    httpMetadata: { contentType: mimeType },
    customMetadata: { recordingId: id },
  });

  try {
    await getDb().insert(recordings).values({
      id,
      ownerKey,
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

  return Response.json({ id, createdAt }, { status: 201 });
}
