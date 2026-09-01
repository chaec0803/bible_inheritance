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

  it('이어듣기 목록에서 절을 선택해도 목록을 유지한다', () => {
    const jumpHandler = page.slice(page.indexOf('const jumpToChapterRecording'), page.indexOf('const playSelectedBgm'));
    expect(jumpHandler).not.toContain('setPlaybackListOpen(false)');
    expect(jumpHandler).not.toContain('stopChapterPlayback()');
    expect(jumpHandler).toContain('setChapterPaused(false)');
    expect(page).toContain('setPlaybackListOpen((current) => !current)');
  });
});
