import { describe, expect, it } from 'vitest';
import { parseDraftRecipientIds, presentDraft } from './shared';

describe('선물 초안 수신자 저장 모델', () => {
  it('recipient_keys_json 하나에서 중복 없는 수신자를 복원한다', () => {
    expect(parseDraftRecipientIds({ recipient_keys_json: '["friend-1","friend-2","friend-1"]' }))
      .toEqual(['friend-1', 'friend-2']);
  });

  it('잘못된 JSON은 빈 수신자 목록으로 처리한다', () => {
    expect(parseDraftRecipientIds({ recipient_keys_json: '{broken' })).toEqual([]);
  });

  it('대표 수신자는 저장하지 않고 첫 번째 수신자에서 파생한다', () => {
    const draft = presentDraft({
      id: 'draft-1', recipient_keys_json: '["friend-1","friend-2"]', recipient_nickname: '친구',
      title: '선물', bgm_id: 'none', bgm_volume: 0, created_at: 1, updated_at: 2,
    }, []);
    expect(draft).toMatchObject({ recipientUserId: 'friend-1', recipientCount: 2 });
  });
});
