import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../db/schema.ts', import.meta.url), 'utf8');
const panelUrl = new URL('./gifts-panel.tsx', import.meta.url);
const dialogUrl = new URL('./gift-send-dialog.tsx', import.meta.url);
const panel = existsSync(panelUrl) ? readFileSync(panelUrl, 'utf8') : '';
const dialog = existsSync(dialogUrl) ? readFileSync(dialogUrl, 'utf8') : '';

describe('말씀 선물 UI·데이터 회귀', () => {
  it('듣기 탭에서 현재 이어듣기 묶음과 선택한 BGM을 친구에게 보낸다', () => {
    expect(page).toContain('선물하기');
    expect(page).toContain('playbackQueue.map((item) => item.id)');
    expect(page).toContain('bgmVolume={volume}');
    expect(dialog).toContain("fetch('/api/gifts'");
    expect(dialog).toContain("fetch('/api/friends'");
  });

  it('선물 탭에서 받은 선물을 이어듣고 다운로드하고 삭제한다', () => {
    expect(page).toContain("navigateTo('gifts')");
    expect(page).toContain("appTab === 'gifts' && <GiftsPanel");
    expect(panel).toContain('이어듣기');
    expect(panel).toContain('다운로드');
    expect(panel).toContain("method: 'DELETE'");
  });

  it('미개봉 선물은 열기 전까지 내용과 재생 기능을 잠근다', () => {
    expect(panel).toContain('선물 열기');
    expect(panel).toContain("method: 'PATCH'");
    expect(panel).toContain('gift.openedAt');
    expect(panel).toContain('openingGiftId');
  });

  it('선물과 선물 속 녹음은 발신자·수신자·순서를 영구 저장한다', () => {
    expect(schema).toContain("sqliteTable(\n  'gifts'");
    expect(schema).toContain("sqliteTable(\n  'gift_recordings'");
    expect(schema).toContain("index('idx_gifts_recipient_created')");
    expect(schema).toContain("uniqueIndex('idx_gifts_one_unopened_per_pair')");
    expect(schema).toContain("openedAt: integer('opened_at')");
    expect(schema).toContain("uniqueIndex('idx_gift_recordings_position')");
  });
});
