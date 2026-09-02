import { env } from 'cloudflare:workers';
import { ensureDbSchema, getD1 } from '@/db';
import { GIFT_BGM_CATALOG, type GiftBgmId } from '@/lib/gift-policy';
import { authenticateRequest } from '@/lib/supabase-auth';
import { createStoredZip } from '@/lib/zip';

type RouteContext = { params: Promise<{ id: string }> };
type GiftDownloadRow = { id: string; title: string; bgm_id: GiftBgmId; bgm_volume: number; sender_nickname: string };
type GiftRecordingRow = { position: number; book: string; chapter: number; verse: number; verse_text: string; object_key: string; mime_type: string; size_bytes: number; duration_seconds: number };

function audioExtension(mimeType: string) {
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || '말씀선물';
}

export async function GET(request: Request, context: RouteContext) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  await ensureDbSchema();
  const { id } = await context.params;
  const gift = await getD1().prepare(`SELECT gifts.id, gifts.title, gifts.bgm_id, gifts.bgm_volume, user_profiles.nickname AS sender_nickname
    FROM gifts
    JOIN user_profiles ON user_profiles.owner_key = gifts.sender_key
    WHERE gifts.id = ? AND gifts.recipient_key = ?`)
    .bind(id, user.id)
    .first<GiftDownloadRow>();
  if (!gift) return Response.json({ error: '선물을 찾을 수 없습니다.' }, { status: 404 });

  const recordingResult = await getD1().prepare(`SELECT position, book, chapter, verse, verse_text, object_key, mime_type, size_bytes, duration_seconds
    FROM gift_recordings WHERE gift_id = ? ORDER BY position`)
    .bind(id)
    .all<GiftRecordingRow>();

  const bgm = GIFT_BGM_CATALOG[gift.bgm_id] ?? GIFT_BGM_CATALOG.none;
  const info = [
    `말씀 선물: ${gift.title}`,
    `보낸 사람: ${gift.sender_nickname}`,
    `BGM: ${bgm.name}`,
    `BGM 음량: ${gift.bgm_volume}%`,
    '',
    ...recordingResult.results.map((recording) => `${recording.position + 1}. ${recording.book} ${recording.chapter}${recording.book === '시편' ? '편' : '장'} ${recording.verse}절 — ${recording.verse_text}`),
  ].join('\n');
  const entries = [{ name: '선물정보.txt', data: new TextEncoder().encode(info) }];

  for (const recording of recordingResult.results) {
    const object = await env.FILES.get(recording.object_key);
    if (!object) return Response.json({ error: '선물 음성 파일을 찾을 수 없습니다.' }, { status: 404 });
    const reference = `${recording.book}-${recording.chapter}-${recording.verse}`;
    entries.push({
      name: `${String(recording.position + 1).padStart(3, '0')}-${safeName(reference)}.${audioExtension(recording.mime_type)}`,
      data: new Uint8Array(await object.arrayBuffer()),
    });
  }

  if (bgm.objectKey) {
    const bgmObject = await env.FILES.get(bgm.objectKey);
    if (bgmObject) entries.push({ name: `BGM-${safeName(bgm.name)}.mp3`, data: new Uint8Array(await bgmObject.arrayBuffer()) });
  }

  const archive = createStoredZip(entries);
  const filename = `${safeName(gift.title)}-말씀선물.zip`;
  return new Response(archive, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `attachment; filename="verse-gift.zip"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': String(archive.byteLength),
      'Content-Type': 'application/zip',
    },
  });
}
