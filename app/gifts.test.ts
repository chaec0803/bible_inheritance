import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../db/schema.ts', import.meta.url), 'utf8');
const panelUrl = new URL('./gifts-panel.tsx', import.meta.url);
const dialogUrl = new URL('./gift-send-dialog.tsx', import.meta.url);
const panel = existsSync(panelUrl) ? readFileSync(panelUrl, 'utf8') : '';
const dialog = existsSync(dialogUrl) ? readFileSync(dialogUrl, 'utf8') : '';
const deleteRoute = readFileSync(new URL('./api/gifts/[id]/route.ts', import.meta.url), 'utf8');
const letterComposer = readFileSync(new URL('./gift-letter-composer.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

describe('말씀 선물 UI·데이터 회귀', () => {
  it('듣기 탭에서 현재 이어듣기 묶음과 선택한 BGM을 친구에게 보낸다', () => {
    expect(page).toContain('선물하기');
    expect(page).toContain('giftQueue.map((item) => item.id)');
    expect(page).toContain('bgmVolume={volume}');
    expect(dialog).toContain("fetch('/api/gifts'");
    expect(dialog).toContain("fetch('/api/friends'");
  });

  it('완료된 말씀 선물 전송창에서 BGM과 음량을 다시 선택한다', () => {
    expect(dialog).toContain('selectedBgmId');
    expect(dialog).toContain('selectedBgmVolume');
    expect(dialog).toContain('선물 BGM');
    expect(dialog).toContain('BGM 음량 낮추기');
    expect(dialog).toContain('BGM 음량 높이기');
  });

  it('편지 없이 보내거나 텍스트·음성 편지 중 하나를 선택해 덧붙인다', () => {
    expect(dialog).toContain('<GiftLetterComposer');
    expect(letterComposer).toContain('편지 없이');
    expect(letterComposer).toContain('텍스트 편지');
    expect(letterComposer).toContain('음성 편지');
    expect(letterComposer).toContain('녹음 시작');
    expect(letterComposer).toContain("onClick={() => selectType('voice')}");
    expect(letterComposer).toContain('음성 편지 확정');
    expect(letterComposer).toContain('재녹음');
    expect(letterComposer).toContain('<audio controls');
  });

  it('음성 편지도 공용 녹음 세션만 사용하고 종료 시 자원을 정리한다', () => {
    expect(letterComposer).toContain('createRecordingSession({');
    expect(letterComposer).toContain('useRef<RecordingSession | null>(null)');
    expect(letterComposer).toContain('recordingSessionRef.current?.dispose()');
    expect(letterComposer).toContain('capture.durationMs');
    expect(letterComposer).not.toContain('new MediaRecorder');
    expect(letterComposer).not.toContain('createRecordingAudioGraph');
    expect(letterComposer).not.toContain('streamRef');
    expect(letterComposer).not.toContain('chunksRef');
  });

  it('전송 완료 안내에는 사용자가 입력한 선물 이름을 표시한다', () => {
    expect(dialog).toContain('onSent(selectedFriends.length === 1');
    expect(page).toContain('onSent={(nickname, sentTitle) =>');
    expect(page).toContain('‘${sentTitle}’ 녹음과 BGM');
  });

  it('카카오톡처럼 여러 친구를 누적 선택하고 칩에서 해제한다', () => {
    expect(dialog).toContain('selectedUserIds');
    expect(dialog).toContain('selectedFriends.map');
    expect(dialog).toContain('gift-selected-friends');
    expect(dialog).toContain('선택 {selectedFriends.length}');
    expect(dialog).toContain('`${selectedFriends.length}명에게 보내기`');
    expect(dialog).toContain('recipientUserIds: selectedFriends.map');
  });

  it('진행 중 듣기 화면에는 선물 버튼을 두지 않고 완료를 먼저 확인한다', () => {
    expect(page).toContain('여정을 완료하면 선물할 수 있어요');
    expect(page).toContain('완료된 장만 선택할 수 있어요');
    expect(page).toContain('giftableFreeChapterGroups');
    expect(page).toContain('evaluateGiftSelection');
    expect(page).not.toContain('className="chapter-gift-trigger"');
    expect(page).toContain('여정을 완료하시겠습니까?');
  });

  it('선물 탭에서 받은 선물을 이어듣고 MP3로 다운로드하고 삭제한다', () => {
    expect(page).toContain("navigateTo('gifts')");
    expect(page).toContain("appTab === 'gifts' && (");
    expect(page).toContain('<GiftsPanel');
    expect(panel).toContain('들어보기');
    expect(panel).toContain('다운로드');
    expect(panel).toContain('createGiftMp3');
    expect(panel).toContain('MP3 만드는 중');
    expect(panel).not.toContain('/download`} download');
    expect(panel).toContain("method: 'DELETE'");
  });

  it('아이폰에서도 받은 선물 BGM을 GainNode와 input 이벤트로 즉시 조절한다', () => {
    expect(panel).toContain('createBrowserBgmGainController');
    expect(panel).toContain('bgmGainController.connect(bgmAudio, selectedVolume)');
    expect(panel).toContain('bgmGainController.setVolume(nextVolume)');
    expect(panel).toContain('aria-label={`${gift.title} BGM 음량`} onInput=');
    expect(panel).not.toContain('bgmRef.current.volume =');
  });

  it('받은 선물과 보낸 선물을 탭으로 나누고 개봉 상태를 표시한다', () => {
    expect(panel).toContain('받은 선물');
    expect(panel).toContain('보낸 선물');
    expect(panel).toContain('sentGifts');
    expect(panel).toContain('recipientNickname');
    expect(panel).toContain('열어봄');
    expect(panel).toContain('열어보기 전');
    expect(panel).toContain('window.setInterval');
    expect(panel).toContain('보낸 선물 삭제');
    expect(panel).toContain('받는 사람의 선물은 그대로 유지돼요');
  });

  it('보낸 선물 삭제는 브라우저 시스템 확인창 대신 말씀유산 모달을 사용한다', () => {
    expect(panel).not.toMatch(/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/);
    expect(panel).toContain('confirmDeleteSentGift');
    expect(panel).toContain('gift-sent-delete-title');
    expect(panel).toContain('받는 사람의 선물은 그대로 유지돼요');
  });

  it('방금 보낸 선물로 진입하면 보낸 선물 탭과 해당 상세를 바로 연다', () => {
    expect(panel).toContain('initialSentGiftId?: string | null');
    expect(panel).toContain("useState<'received' | 'sent'>(initialSentGiftId ? 'sent' : 'received')");
    expect(panel).toContain('useState<string | null>(initialSentGiftId ?? null)');
  });

  it('받은 사람이 BGM 음량을 조절하고 감사 인사를 보낼 수 있다', () => {
    expect(panel).toContain('선물 BGM 음량');
    expect(panel).toContain('받은 선물 BGM 음량 낮추기');
    expect(panel).toContain('받은 선물 BGM 음량 높이기');
    expect(panel).toContain('giftVolumes');
    expect(panel).toContain('bgmGainController.connect(bgmAudio, selectedVolume)');
    expect(panel).toContain('bgmVolume: giftVolumes[gift.id] ?? gift.bgmVolume');
    expect(panel).toContain('감사 인사 보내기');
    expect(panel).toContain('THANK_YOU_TEMPLATES');
    expect(panel).toContain('/thank-you`');
  });

  it('모바일에서 감사편지 입력 시 브라우저가 화면을 자동 확대하지 않는다', () => {
    expect(styles).toMatch(/\.gift-thank-you-custom textarea\s*\{[^}]*font-size:\s*16px/);
  });

  it('보낸 사람은 개봉 시각과 감사 인사를 확인할 수 있다', () => {
    expect(panel).toContain('열어본 시간');
    expect(panel).toContain('thankYouNote');
    expect(panel).toContain('감사 인사가 도착했어요');
    expect(panel).toContain('newlyOpened');
    expect(panel).toContain('newlyThanked');
  });

  it('미개봉 선물은 열기 전까지 내용과 재생 기능을 잠근다', () => {
    expect(panel).toContain('선물 열기');
    expect(panel).toContain("method: 'PATCH'");
    expect(panel).toContain('gift.openedAt');
    expect(panel).toContain('openingGiftId');
  });

  it('선물을 열면 쪽지 안내 팝업을 먼저 거치고 확인 후 선물 상세를 보여준다', () => {
    expect(panel).toContain('letterPopupGiftId');
    expect(panel).toContain('함께 온 쪽지가 있습니다');
    expect(panel).toContain('쪽지 열기');
    expect(panel).toContain('쪽지 다시 열기');
    expect(panel).toContain('gift-letter-popup-title');
    expect(panel).toContain('setDetailGiftId(letterPopupGiftId)');
    expect(panel).toContain('setLetterPopupGiftId(null)');
    expect(panel).toContain('/letter/open`');
    expect(panel).toContain('/letter/audio`');
    expect(panel).toContain('letterOpenedAt');
  });

  it('받은 선물 재생 동작은 이어듣기 대신 들어보기로 안내한다', () => {
    expect(panel).toContain('들어보기');
    expect(panel).not.toContain('이어듣기');
  });

  it('오래 걸리는 MP3 생성 뒤에는 사용자가 직접 저장하고 모바일 공유 저장도 선택할 수 있다', () => {
    expect(panel).toContain('downloadReady');
    expect(panel).toContain('MP3 파일 저장');
    expect(panel).toContain('download={downloadReady.filename}');
    expect(panel).not.toContain('target="_blank"');
    expect(panel).not.toContain('link.click()');
    expect(panel).toContain('navigator.canShare');
    expect(panel).toContain('navigator.share');
    expect(panel).toContain('공유해서 저장');
  });

  it('재생 시작 직후 일시정지로 발생한 AbortError가 플레이어를 종료하지 않는다', () => {
    expect(panel).toContain('isPlaybackPauseInterruption(error)');
    expect(panel).toContain('if (isPlaybackPauseInterruption(error)) return;');
  });

  it('마지막 선물 녹음이 끝나면 잠시 완료 상태를 보여준 뒤 플레이어를 닫는다', () => {
    expect(panel).toContain('PLAYBACK_AUTO_CLOSE_DELAY_MS');
    expect(panel).toContain('playbackCloseTimerRef.current = window.setTimeout');
    expect(panel).toContain('bgmRef.current?.pause()');
  });

  it('선물을 열면 읽은 목록으로 갑자기 보내지 않고 그 자리에서 상세와 녹음 목록을 연다', () => {
    expect(panel).toContain('justOpenedGiftId');
    expect(panel).toContain("title: '방금 열어본 선물'");
    expect(panel).toContain('setDetailGiftId(gift.id)');
    expect(panel).toContain("current.includes(gift.id) ? current : [...current, gift.id]");
  });

  it('선물과 선물 속 녹음은 발신자·수신자·순서를 영구 저장한다', () => {
    expect(schema).toContain("sqliteTable(\n  'gifts'");
    expect(schema).toContain("sqliteTable(\n  'gift_recordings'");
    expect(schema).toContain("index('idx_gifts_recipient_created')");
    expect(schema).toContain("uniqueIndex('idx_gifts_one_unopened_per_pair')");
    expect(schema).toContain("openedAt: integer('opened_at')");
    expect(schema).toContain("recipientDeletedAt: integer('recipient_deleted_at')");
    expect(schema).toContain("thankYouNote: text('thank_you_note')");
    expect(schema).toContain("thankedAt: integer('thanked_at')");
    expect(schema).toContain("letterType: text('letter_type')");
    expect(schema).toContain("letterOpenedAt: integer('letter_opened_at')");
    expect(schema).toContain("uniqueIndex('idx_gift_recordings_position')");
    expect(schema).toContain("sourceRecordingId: text('source_recording_id')");
  });

  it('받은 사람이 선물을 삭제해도 보낸 선물 기록은 남긴다', () => {
    expect(deleteRoute).toContain('UPDATE gifts SET recipient_deleted_at');
    expect(deleteRoute).not.toContain("prepare('DELETE FROM gifts");
    expect(panel).not.toContain('recipientDeletedAt');
    expect(panel).not.toContain('선물함에서 삭제됨');
  });
});
