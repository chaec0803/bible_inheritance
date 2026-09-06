import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8').replace(/\s+/g, ' ');
const studioUrl = new URL('./gift-studio.tsx', import.meta.url);
const studio = existsSync(studioUrl) ? readFileSync(studioUrl, 'utf8') : '';
const styles = readFileSync(new URL('./globals.css', import.meta.url), 'utf8').replace(/\s+/g, ' ');
const inProgressGifts = readFileSync(new URL('./in-progress-gifts.tsx', import.meta.url), 'utf8');
const draftDetailRoute = readFileSync(new URL('./api/gift-drafts/[id]/route.ts', import.meta.url), 'utf8');
const draftsRoute = readFileSync(new URL('./api/gift-drafts/route.ts', import.meta.url), 'utf8');
const recordingAudioUrl = new URL('../lib/recording-audio.ts', import.meta.url);
const recordingAudio = existsSync(recordingAudioUrl)
  ? readFileSync(recordingAudioUrl, 'utf8')
  : '';
const navigationPolicy = readFileSync(
  new URL('../lib/navigation-policy.ts', import.meta.url),
  'utf8',
);
const schema = readFileSync(
  new URL('../db/schema.ts', import.meta.url),
  'utf8',
);
const dbIndex = readFileSync(
  new URL('../db/index.ts', import.meta.url),
  'utf8',
);

function block(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  return start < 0 ? '' : source.slice(start, end < 0 ? undefined : end);
}

describe('말씀 골라 선물하기 진입점', () => {
  it('홈에 큰 메인 메뉴로 말씀 선물하기를 제공한다', () => {
    expect(page).toContain('말씀 선물하기');
    expect(page).toContain(
      '오늘, 마음에 떠오른 말씀을 소중한 사람에게 목소리로 전해 보세요.',
    );
    expect(page).toContain('말씀 골라 선물하기');
    expect(page).toContain('className="gift-start-card"');
    expect(page).toContain("navigateTo('gift-studio')");
  });

  it('성경 읽기와 진행 중 여정에는 선물 진입 버튼을 두지 않는다', () => {
    expect(page).toContain('const openGiftStudio');
    expect(page).not.toContain('className="bible-gift-entry"');
    expect(page).not.toContain('className="journey-gift-entry"');
    expect(page).toContain('giftStudioScope');
  });

  it('선물하기는 앱 탭이 아닌 전용 화면 경로로 열린다', () => {
    expect(navigationPolicy).toContain("'gift-studio'");
    expect(navigationPolicy).toContain("'giftStudio'");
    expect(page).toContain("onboardingStep === 'giftStudio'");
    expect(page).toContain('<GiftStudio');
  });
});

describe('말씀 골라 선물하기 흐름', () => {
  it('기존 앱과 같은 전체 화면 카드와 단계형 레이아웃을 사용한다', () => {
    expect(studio).toContain('className="gift-studio-shell"');
    expect(studio).toContain('className="gift-studio-progress"');
    expect(studio).toContain('className="gift-studio-workspace"');
    expect(studio).toContain('className="gift-studio-primary"');
    expect(studio).toContain('className="gift-studio-summary"');
  });

  it('친구 → 말씀 → 녹음 → 쪽지와 전송 순서로 진행한다', () => {
    expect(studio).toContain('GIFT_STUDIO_STEPS');
    expect(studio).toContain("useState<GiftStudioStep>('friend')");
    expect(studio).toContain('어떤 말씀을 선물할까요?');
    expect(studio).toContain("'letter'");
    expect(studio).not.toContain("'preview',");
    expect(studio).not.toContain("'music',");
  });

  it('전송 성공 확인 후 방금 보낸 선물을 펼친 보낸 선물함으로 이동한다', () => {
    expect(studio).toContain('선물을 보냈습니다!');
    expect(studio).toContain('onSent(sendSuccessGiftId)');
    expect(page).toContain('selectedSentGiftId');
    expect(page).toContain('initialSentGiftId={selectedSentGiftId}');
  });

  it('친구 선택은 페이지형 카드 목록이 아니라 공용 모달로 띄운다', () => {
    expect(studio).toContain("from './friend-picker-modal'");
    expect(studio).toContain('<FriendPickerModal');
    expect(studio).toContain('friendPickerOpen');
    expect(studio).toContain('친구 선택하기');
    expect(studio).not.toContain('gift-friend-grid');
    expect(studio).not.toContain('<h2>누구에게 선물할까요?</h2>');
  });

  it('여러 친구를 칩으로 관리하고 수신자 수만큼 포장한다', () => {
    expect(studio).toContain('initialSelectedFriends={selectedFriends}');
    expect(studio).toContain('setSelectedFriends(friends)');
    expect(studio).toContain('선택 {selectedFriends.length}/30');
    expect(studio).toContain('selectedFriends.filter');
    expect(studio).toContain('recipientUserIds: selectedFriends.map');
    expect(studio).toContain('개 선물 포장 중');
  });

  it('한 장 읽기 또는 공용 범위 지정으로 말씀을 고른다', () => {
    expect(studio).toContain('한 장 읽기');
    expect(studio).toContain('범위 지정');
    expect(studio).toContain('BibleRangePicker');
  });

  it('범위 종류에 따라 서로 다른 선택 도구를 보여준다', () => {
    expect(studio).toContain('gift-single-chapter-fields');
    expect(studio).toContain('gift-multi-chapter-fields');
    expect(studio).toContain('시작 장');
    expect(studio).toContain('끝 장');
    expect(studio).toContain('className="gift-book-multi-picker"');
    expect(studio).toContain('selectedBookCodes');
    expect(studio).toContain('여러 권을 눌러 선택해 주세요');
    expect(studio).toContain('giftBookTestament');
    expect(studio).toContain('giftBookSearch');
    expect(studio).toContain('className="gift-selected-books"');
    expect(studio).toContain('성경 권 검색');
  });

  it('선택한 순서대로 한 절씩 녹음하고 다음 절로 이어간다', () => {
    expect(studio).toContain("fetch('/api/gift-drafts'");
    expect(studio).toContain("method: 'PUT'");
    expect(studio).toContain('/items/');
    expect(studio).toContain('nextPosition');
    expect(studio).toContain('getGiftDraftProgress');
  });

  it('기존 녹음 화면처럼 이어 녹음을 기본으로 하고 완료 후 절별 수정한다', () => {
    expect(studio).toContain("useState<'verse' | 'continuous'>");
    expect(studio).toContain("'continuous',");
    expect(studio).toContain('이어 녹음');
    expect(studio).toContain('다음 절로');
    expect(studio).toContain('continuousBoundariesRef');
    expect(studio).toContain(
      '녹음이 끝난 뒤 원하는 절만 다시 녹음할 수 있어요',
    );
    expect(studio).toContain('className="recording-card"');
    expect(studio).toContain('className={`waveform');
    expect(studio).toContain('className="timer"');
    expect(studio).toContain('className="continuous-record-actions"');
    expect(studio).toContain('recording-manage-sheet');
    expect(studio).toContain('className="recording-manage-backdrop"');
    expect(studio).not.toContain('<dialog open className="recording-manage-backdrop">');
  });

  it('다음 절로 넘어갈 때 업로드를 기다리지 않고 같은 마이크 세션으로 즉시 녹음한다', () => {
    expect(studio).toContain('existingSession');
    expect(studio).toContain('startRecording(optimisticDraft, { sourceStream, graph })');
    expect(studio.indexOf('startRecording(optimisticDraft, { sourceStream, graph })')).toBeLessThan(studio.indexOf('const uploadResponse = await fetch'));
    expect(studio).toContain('if (!continuing)');
    expect(studio).toContain('if (!uploadResponse.ok)');
    expect(studio).toContain('녹음을 저장하지 못했어요');
  });

  it('빠르게 넘긴 여러 절의 저장 요청은 순서대로 처리한다', () => {
    expect(studio).toContain('uploadQueueRef');
    expect(studio).toContain('uploadQueueRef.current.then');
    expect(studio).toContain('uploadQueueRef.current = uploadTask.catch');
  });

  it('다음 절 버튼을 누르는 즉시 본문을 먼저 바꾸고 중복 탭을 막는다', () => {
    const handlerStart = studio.indexOf('const finishCurrentVerseAndContinue');
    const handlerEnd = studio.indexOf('const bgmSrc', handlerStart);
    const handler = studio.slice(handlerStart, handlerEnd);
    expect(handler).toContain('advancingRef.current = true');
    expect(handler).toContain('setDraft(optimisticDraft)');
    expect(handler.indexOf('setDraft(optimisticDraft)')).toBeLessThan(handler.indexOf('recorderRef.current?.stop()'));
  });

  it('마지막 절 완료는 저장 후 검토 화면에 남고 사용자가 직접 쪽지 단계로 이동한다', () => {
    const handlerStart = studio.indexOf('const finishCurrentVerseAndContinue');
    const handlerEnd = studio.indexOf('const bgmSrc', handlerStart);
    const handler = studio.slice(handlerStart, handlerEnd);
    expect(handler).toContain('if (!hasNext) setSavingRecording(true)');
    expect(handler).not.toContain("setStep('preview')");
    expect(studio).toContain('녹음 저장 중');
    expect(studio).toContain("setSelectedGiftPosition(hydratedDraft.items.length - 1)");
    expect(studio).toContain('녹음 검토 화면에서 전체 미리듣기와 절별 수정을 할 수 있어요.');
    expect(studio).toContain('onClick={() => setStep(\'letter\')}');
  });

  it('현재 절까지 저장을 누르면 같은 자리에 즉시 로딩 상태를 표시한다', () => {
    const recorder = block(studio, 'if (draft && step === \'record\'', 'if (!draft)');
    expect(studio).toContain('const finishRecordingHere');
    expect(studio).toContain('setSavingRecording(true)');
    expect(recorder).toContain('현재 절 저장 중');
    expect(recorder).toContain('disabled={savingRecording}');
    expect(recorder).toContain('LoaderCircle className="spin"');
  });

  it('전체 미리 듣기와 구절별 재녹음을 제공한다', () => {
    expect(studio).toContain('전체 미리 듣기');
    expect(studio).toContain('이 절 다시 녹음');
    expect(studio).toContain('previewRef');
    expect(studio).toContain('처음부터 다시 녹음');
    expect(studio).toContain("action: 'reset-recordings'");
    expect(studio).toContain('confirmResetRecordings');
    expect(studio).toContain('녹음은 그대로 유지돼요');
  });

  it('이 절 수정 시 서버와 왼쪽 완료 목록을 즉시 동기화한다', () => {
    expect(studio).toContain("method: 'DELETE'");
    expect(studio).toContain('recorded: false');
    expect(studio).toContain('sourceRecordingId: null');
  });

  it('방금 녹음한 선물은 서버 메타데이터를 기다리지 않고 즉시 들을 수 있다', () => {
    expect(studio).toContain('URL.createObjectURL(recordingBlob)');
    expect(studio).toContain('localPreviewUrls[item.position]');
    expect(studio).toContain('toggleDraftItemPlayback(item)');
    expect(studio).not.toContain('controls\n                        src={`/api/gift-drafts/');
  });

  it('절별 재녹음 중에는 새 음성을 저장하며 녹음을 끝낼 수 있다', () => {
    const recorder = block(studio, 'if (draft && step === \'record\'', 'if (!draft)');
    expect(recorder).toContain("recording && recordingMode === 'verse'");
    expect(recorder).toContain('이 절 저장');
    expect(recorder).toContain('recorderRef.current?.stop()');
  });

  it('녹음하는 동안 현재 말씀과 다음 말씀 본문을 보여준다', () => {
    expect(studio).toContain('/data/bible/');
    expect(studio).toContain('hydrateVerseTexts');
    expect(studio).toContain('className="verse-paper continuous"');
    expect(studio).toContain('다음 말씀');
  });

  it('BGM과 음량을 고르고 초안에 저장한다', () => {
    expect(studio).toContain('aria-label="선물 녹음 음향 설정"');
    expect(studio).toContain('bgmVolume');
    expect(studio).toContain("method: 'PATCH'");
    expect(studio).toContain('GIFT_BGM_CATALOG');
    expect(studio).toContain('bgmPreviewRef');
    expect(studio).toContain('배경음악 재생');
    expect(studio).toContain('배경음악 일시정지');
    expect(studio).toContain('bgmPreviewError');
    expect(studio).toContain('BGM을 재생할 수 없어요');
  });

  it('배경음악은 녹음 단계에 하나만 놓고 설정 저장을 순서대로 처리한다', () => {
    expect(studio.match(/className="sound-panel gift-sound-panel"/g)).toHaveLength(1);
    expect(studio).toContain('musicSaveQueueRef.current.then');
    expect(studio).toContain('musicSaveQueueRef.current = saveTask.catch');
    expect(studio).toContain('onInput={(event) => updateGiftBgmVolume');
    const saveMusic = block(studio, 'const saveMusic', 'const saveTitle');
    expect(saveMusic.indexOf('setDraft')).toBeLessThan(saveMusic.indexOf("fetch(`/api/gift-drafts/"));
  });

  it('녹음을 중간에 끝내도 저장된 다음 절부터 이어 녹음한다', () => {
    expect(studio).toContain("setRecordingMode('continuous')");
    expect(studio).toContain("setStep('record')");
    expect(studio).toContain('절부터 이어 녹음할 수 있어요');
  });

  it('녹음 중 절 선택으로 저장 조작이 사라지거나 녹음이 고아 상태가 되지 않는다', () => {
    expect(studio).toContain('(recording || savingRecording) ? draft.nextPosition');
    expect(studio).toContain('disabled={recording || savingRecording}');
    expect(studio).toContain("recordingMode === 'continuous' && recording &&");
    expect(studio).not.toContain("!viewingRecordedItem && recordingMode === 'continuous' && recording");
    expect(studio).toContain('recordingSessionRef.current');
    expect(studio).toContain('recorder.onstop = null');
  });

  it('선물 녹음도 종료 조작을 타이머 아래 같은 위치에 표시한다', () => {
    const recorder = block(studio, 'if (draft && step === \'record\'', 'if (!draft)');
    expect(recorder.indexOf('className="timer"')).toBeLessThan(recorder.indexOf('aria-label="이어 녹음 진행"'));
  });

  it('선물 녹음의 시작 버튼과 BGM 선택 표시를 카드 기준으로 정렬한다', () => {
    expect(styles).toContain('.record-controls .record-button { margin-inline: auto; }');
    expect(styles).toContain('.music-select { width: 100%;');
    expect(styles).toContain('grid-template-columns: 34px minmax(0, 1fr) 14px');
  });

  it('새 선물 녹음 화면에는 녹음 대기 상세 목록을 다시 노출하지 않는다', () => {
    const recorder = block(studio, 'if (draft && step === \'record\'', '<audio ref={previewRef}');
    expect(recorder).not.toContain('gift-verse-list');
    expect(recorder).not.toContain('녹음 대기');
    expect(studio).toContain("{step === 'record' && (");
  });

  it('BGM을 선택한 선물 녹음 시작 전 이어폰 안내와 BGM 끄기 선택을 제공한다', () => {
    expect(studio).toContain('giftHeadphoneWarningOpen');
    expect(studio).toContain('이어폰이 연결되어 있나요?');
    expect(studio).toContain('이어폰 연결했어요');
    expect(studio).toContain('BGM 끄고 녹음');
    expect(studio).toContain("selectGiftBgm('none')");
    expect(studio).toContain('requestGiftRecording');
  });

  it('저장된 선물 녹음은 새 녹음 화면에서도 처음부터 다시 녹음할 수 있다', () => {
    const recorder = block(studio, 'if (draft && step === \'record\'', 'if (!draft)');
    expect(recorder).toContain('recording-manage-trigger');
    expect(recorder).toContain('녹음 관리');
    expect(recorder).toContain('처음부터 다시 녹음');
    expect(recorder).toContain('setConfirmResetRecordings(true)');
    expect(recorder).toContain('모두 지우고 다시 녹음');
    expect(recorder).toContain('resetAllRecordings');
  });

  it('전체 미리듣기 중에도 완료한 절을 선택해 수정할 수 있다', () => {
    const recorder = block(studio, 'if (draft && step === \'record\'', 'if (!draft)');
    expect(recorder).toContain('전체 미리 듣기');
    expect(recorder).toContain('fullPreviewVoiceRef');
    expect(recorder).toContain('fullPreviewBgmRef');
    expect(recorder).toContain("draft.nextPosition == null");
    expect(studio).toContain("setStep('record')");
    expect(studio).toContain("setStep('record');");
    expect(studio).not.toContain("setStep(hydratedDraft.nextPosition == null ? 'letter' : 'record')");
  });

  it('전체 미리듣기의 정상 종료를 재생 시작 실패로 안내하지 않는다', () => {
    expect(studio).toContain('fullPreviewRunRef');
    expect(studio).toContain('fullPreviewIndexRef');
    expect(studio).toContain('if (runId !== fullPreviewRunRef.current) return;');
    expect(studio).toContain("error instanceof DOMException && error.name === 'AbortError'");
  });

  it('쪽지 단계 버튼은 녹음 검토 카드 맨 아래 중앙의 다음 버튼으로 표시한다', () => {
    const recorder = block(studio, 'if (draft && step === \'record\'', 'if (!draft)');
    expect(recorder).toContain('gift-studio-next-letter');
    expect(recorder).toContain('다음 · 쪽지 덧붙이기');
    expect(recorder.indexOf('aria-label="음향 설정"')).toBeLessThan(recorder.indexOf('gift-recording-next-step'));
    expect(styles).toContain('.gift-recording-next-step { display: flex; justify-content: center;');
    expect(styles).toContain('.gift-studio-next-letter { width: min(390px, 100%); margin: 0 auto;');
  });

  it('쪽지 단계에서 상단 목소리 녹음 단계를 눌러 안전하게 뒤로 이동한다', () => {
    expect(studio).toContain("item === 'record' && step === 'letter' && draft");
    expect(studio).toContain("aria-label=\"목소리 녹음 단계로 돌아가기\"");
    expect(studio).toContain("onClick={() => setStep('record')}");
    expect(styles).toContain('grid-template-columns: repeat(4, 1fr)');
    expect(styles).toContain('.gift-step-back');
  });

  it('음악 선택 뒤 선택적인 편지를 덧붙여 함께 전송한다', () => {
    expect(studio).toContain('<GiftLetterComposer');
    expect(studio).toContain('body: JSON.stringify({ letter:');
    expect(studio).toContain("setLetter({ type: 'none' })");
  });

  it('전체 미리 듣기는 모든 녹음과 선택한 BGM을 설정 음량으로 함께 재생한다', () => {
    expect(studio).toContain('playFullGiftPreview');
    expect(studio).toContain('fullPreviewVoiceRef');
    expect(studio).toContain('fullPreviewBgmRef');
    expect(studio).toContain('toAudibleBgmGain(draft.bgmVolume)');
    expect(studio).toContain('handleFullPreviewEnded');
    expect(studio).toContain('미리 듣기 일시정지');
  });

  it('말씀 선택 뒤 녹음 전에 선물 이름을 직접 붙여 저장한다', () => {
    expect(studio).toContain('선물 이름');
    expect(studio).toContain('maxLength={100}');
    expect(studio).toContain('saveTitle');
    expect(studio).toContain('value={giftTitleEdited ? giftTitle : defaultGiftTitle()}');
    expect(studio).toContain('setGiftTitleEdited(true)');
    expect(studio).toContain("const resolvedGiftTitle = giftTitleEdited ? giftTitle.trim() : defaultGiftTitle()");
    expect(studio).not.toContain('value={giftTitle || defaultGiftTitle()}');
    expect(studio).toContain('title: resolvedGiftTitle');
    expect(studio).toContain("return `${name} ${scope.chapter}${name === '시편' ? '편' : '장'}`");
    expect(draftsRoute).toContain("typeof body?.title === 'string'");
    expect(draftDetailRoute).toContain('UPDATE gift_drafts SET title = ?');
  });

  it('녹음을 마치면 곧바로 선물을 보낸다', () => {
    expect(studio).toContain('/send');
    expect(studio).toContain('명에게 보내기');
    expect(studio).toContain('isGiftDraftSendable');
  });

  it('선물 전송 실패는 가려지는 토스트 대신 확인 가능한 경고 모달로 보여준다', () => {
    expect(studio).toContain('gift-send-error-dialog');
    expect(studio).toContain('선물을 보내지 못했어요');
    expect(studio).toContain('선물함 확인하기');
  });

  it('일반 안내 토스트는 잠시 표시한 뒤 자동으로 닫힌다', () => {
    expect(studio).toContain("window.setTimeout(() => setMessage(''), 4000)");
    expect(studio).toContain('window.clearTimeout(timeout)');
  });

  it('초안을 이어서 만들거나 버릴 수 있다', () => {
    expect(studio).toContain('<InProgressGifts');
    expect(inProgressGifts).toContain('진행 중인 선물');
    expect(inProgressGifts).toContain('이어서 만들기');
    expect(inProgressGifts).toContain('진행 중인 선물 삭제');
    expect(inProgressGifts).toContain('title="진행 중인 선물 삭제"');
    expect(studio).toContain('confirmDiscardDraft');
    expect(studio).toContain('초안을 삭제할까요?');
    expect(studio).toContain('삭제하면 녹음도 함께 사라지고 복구할 수 없어요.');
    expect(studio).toContain("method: 'DELETE'");
  });

  it('절 녹음 후 상세과 진행 중 카드의 친구·진행률을 함께 갱신한다', () => {
    expect(draftDetailRoute).toContain('recipient_nickname');
    expect(draftDetailRoute).toContain('JOIN user_profiles');
    expect(studio).toContain('setDrafts((currentDrafts) =>');
    expect(studio).toContain('candidate.id === hydratedDraft.id ? hydratedDraft : candidate');
  });

  it('마이크 녹음 처리는 일반 녹음과 같은 공용 모듈을 쓴다', () => {
    expect(recordingAudio).toContain(
      'export function createRecordingAudioGraph',
    );
    expect(recordingAudio).toContain('export function getSupportedMimeType');
    expect(recordingAudio).toContain('export function encodeAudioBufferAsWav');
    expect(page).toContain("from '@/lib/recording-audio'");
    expect(studio).toContain("from '@/lib/recording-audio'");
  });
});

describe('선물 초안 격리', () => {
  it('선물용 녹음은 보관함이나 말씀 여정에 저장하지 않는다', () => {
    expect(studio).not.toContain("'/api/recordings'");
    expect(studio).not.toContain('verse-legacy-active-projects');
    expect(studio).not.toContain('projectTitle');
  });

  it('선물 초안은 전송 전까지만 남는 별도 표에 보관한다', () => {
    expect(schema).toContain("sqliteTable(\n  'gift_drafts'");
    expect(schema).toContain("sqliteTable(\n  'gift_draft_items'");
    expect(schema).toContain("sentGiftId: text('sent_gift_id')");
    expect(schema).toContain("uniqueIndex('idx_gift_draft_items_position')");
    expect(dbIndex).toContain('CREATE TABLE IF NOT EXISTS gift_drafts');
    expect(dbIndex).toContain('CREATE TABLE IF NOT EXISTS gift_draft_items');
    expect(dbIndex).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_draft_items_position',
    );
  });

  it('선물 초안 절에는 여정·녹음 그룹 정보를 두지 않는다', () => {
    const draftItemTable = block(
      dbIndex,
      'CREATE TABLE IF NOT EXISTS gift_draft_items',
      ')`)',
    );
    expect(draftItemTable).not.toContain('project_id');
    expect(draftItemTable).not.toContain('recording_group_id');
    expect(draftItemTable).toContain('source_recording_id');
  });
});
