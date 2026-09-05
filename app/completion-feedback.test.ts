import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('완료 피드백과 재생 제어', () => {
  it('주요 녹음 완료 유형을 공통 완료 모달로 안내한다', () => {
    expect(page).toContain('`${currentVerseNumber}절 수정 완료`');
    expect(page).toContain('절 녹음 완료`');
    expect(page).toContain("title: '하루 읽기 완료'");
    expect(page).toContain('completion-modal');
  });

  it('새 여정을 여는 순간 이전 본문의 저장 상태로 1일차 완료 처리하지 않는다', () => {
    expect(page).not.toContain('if (currentPassageComplete) completed.add(0);');
    expect(page).toContain('const activePassageComplete = passageVerses.length > 0 && passageVerses.every');
    expect(page).toContain('if (activePassageComplete) completed.add(0);');
  });

  it('이어듣기에 일시정지와 재개 제어가 있다', () => {
    expect(page).toContain('pauseChapterPlayback');
    expect(page).toContain('resumeChapterPlayback');
    expect(page).toContain("chapterPaused ? '계속 듣기' : '일시정지'");
  });

  it('아이폰의 일시적인 오디오 중단이 이어듣기 모달을 닫지 않는다', () => {
    expect(page).toContain('if (chapterPlayingRef.current) {');
    expect(page).toContain('chapterPausedRef.current = true;');
    expect(page).not.toContain('if (chapterPlayingRef.current) stopChapterPlayback();');
  });

  it('저장 중에는 로딩 상태를 표시하고 재실행을 막는다', () => {
    expect(page).toContain("disabled={requestingMic || savingLibrary}");
    expect(page).toContain("savingLibrary ? '녹음 저장 중'");
    expect(page).toContain('if (savingLibrary || requestingMic) return;');
  });

  it('장과 하루 읽기 완료 후 보관함으로 바로 이동할 수 있다', () => {
    expect(page).toContain('showLibraryAction: true');
    expect(page).toContain('보관함 가기');
    expect(page).toContain('openLibraryFromCompletion');
    expect(page).toContain('setEarnedCard(null);');
  });

  it('보관함으로 이동해도 방금 받은 말씀카드를 닫지 않는다', () => {
    const handler = page.slice(page.indexOf('const openLibraryFromCompletion'), page.indexOf('const openLibraryVerse'));
    expect(handler).toContain('revealQueuedWordCard()');
    expect(handler).toContain('openLibraryTab()');
    expect(handler).not.toContain('setEarnedCard(null)');
  });

  it('하루 완료 안내와 새 말씀카드를 겹치지 않고 차례로 보여 준다', () => {
    expect(page).toContain('const [queuedEarnedCard, setQueuedEarnedCard]');
    expect(page).toContain('const revealQueuedWordCard = () =>');
    expect(page).toContain('setQueuedEarnedCard(card);');
    expect(page).not.toContain('if (result.created)\n      setCompletionModal({');
  });

  it('서버의 카드 지급 상태를 복원하기 전에는 완료 모달을 다시 만들지 않는다', () => {
    const completionEffect = page.slice(
      page.indexOf("useEffect(() => {\n    if (!userStateReady || !displayedProjectDayComplete"),
      page.indexOf('const prepareChapterAudio'),
    );
    expect(completionEffect).toContain('if (!userStateReady || !displayedProjectDayComplete');
    expect(completionEffect).toContain('userStateReady,');
  });

  it('새 카드 지급 사실을 즉시 서버에 저장해 새로고침 후 다시 지급하지 않는다', () => {
    const awardHandler = page.slice(
      page.indexOf('const awardDailyWordCard'),
      page.indexOf('const revealQueuedWordCard'),
    );
    expect(awardHandler).toContain('wordCardAwards: result.awards');
    expect(awardHandler).toContain('void saveUserState({');
  });

  it('말씀카드는 닫기 버튼뿐 아니라 바깥 영역과 Esc로도 닫을 수 있다', () => {
    expect(page).toContain('event.target === event.currentTarget');
    expect(page).toContain("event.key === 'Escape'");
    expect(page).toContain('closeWordCard();');
  });

  it('말씀카드의 닫기·뒤집기·상세·간직하기 조작을 모두 연결한다', () => {
    const modal = page.slice(page.indexOf('{earnedCard &&'), page.indexOf('{notice &&'));
    expect(modal).toContain('aria-label="말씀 카드 닫기"');
    expect(modal).toContain('onClick={closeWordCard}');
    expect(modal).toContain('setWordCardFlipped((current) => !current)');
    expect(modal).toContain('setWordCardExpanded((current) => !current)');
    expect(modal).toContain('() => void collectEarnedWordCard()');
  });

  it('이어듣기 목록에서 절을 선택해도 목록을 유지한다', () => {
    const jumpHandler = page.slice(page.indexOf('const jumpToChapterRecording'), page.indexOf('const playSelectedBgm'));
    expect(jumpHandler).not.toContain('setPlaybackListOpen(false)');
    expect(jumpHandler).not.toContain('stopChapterPlayback()');
    expect(jumpHandler).toContain('setChapterPaused(false)');
    expect(page).toContain('setPlaybackListOpen((current) => !current)');
  });
});
