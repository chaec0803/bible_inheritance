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

  it('저장 중에는 로딩 상태를 표시하고 재실행을 막는다', () => {
    expect(page).toContain("disabled={requestingMic || savingLibrary}");
    expect(page).toContain("savingLibrary ? '녹음 저장 중'");
  });
});
