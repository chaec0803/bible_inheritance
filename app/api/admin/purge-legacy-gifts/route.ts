import { env } from 'cloudflare:workers';
import { ensureDbSchema, getD1 } from '@/db';

export async function DELETE(request: Request) {
  const token = env.GIFT_PURGE_TOKEN;
  if (!token || request.headers.get('authorization') !== `Bearer ${token}`) {
    return Response.json({ error: '찾을 수 없습니다.' }, { status: 404 });
  }

  await ensureDbSchema();
  const legacyRecordings = await getD1().prepare(`SELECT gift_id, object_key
    FROM gift_recordings
    WHERE source_recording_id IS NULL AND object_key IS NOT NULL`)
    .all<{ gift_id: string; object_key: string }>();
  const legacyGiftIds = new Set(legacyRecordings.results.map((recording) => recording.gift_id));

  for (let offset = 0; offset < legacyRecordings.results.length; offset += 500) {
    await env.FILES.delete(legacyRecordings.results.slice(offset, offset + 500).map((recording) => recording.object_key));
  }

  const d1 = getD1();
  await d1.batch([
    d1.prepare('DELETE FROM gift_recordings WHERE source_recording_id IS NULL'),
    d1.prepare('DELETE FROM gifts WHERE NOT EXISTS (SELECT 1 FROM gift_recordings WHERE gift_recordings.gift_id = gifts.id)'),
  ]);
  return Response.json({ deletedGifts: legacyGiftIds.size, deletedAudioFiles: legacyRecordings.results.length });
}
