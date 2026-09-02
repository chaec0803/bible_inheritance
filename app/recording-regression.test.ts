import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const recordingsRoute = readFileSync(new URL('./api/recordings/route.ts', import.meta.url), 'utf8');
const audioRoute = readFileSync(new URL('./api/recordings/[id]/audio/route.ts', import.meta.url), 'utf8');

function functionBody(startMarker: string, endMarker: string) {
  return page.slice(page.indexOf(startMarker), page.indexOf(endMarker));
}

describe('녹음·저장·수정 회귀', () => {
  it('이어 녹음 타이머와 절별 녹음 타이머가 동시에 실행되지 않는다', () => {
    expect(page).toContain("if (!recording || recordingMode !== 'continuous') return;");
    expect(page).toContain("if (!recording || recordingMode === 'continuous') return;");
  });

  it('이어 녹음 종료 시 현재 절 경계를 포함해 절마다 저장한다', () => {
    const stopHandler = functionBody('const stopContinuousAndSaveCurrent', 'useEffect(() => {');
    expect(stopHandler).toContain('verseIndex');
    expect(stopHandler).toContain('mediaRecorderRef.current.stop()');

    const saveHandler = functionBody('const saveCompletedContinuousVerses', 'const startRecording');
    expect(saveHandler).toContain('boundaries.map');
    expect(saveHandler).toContain("formData.append('recordingGroupId'");
    expect(saveHandler).toContain("formData.append('recordingMode', 'continuous')");
    expect(saveHandler).toContain("fetch('/api/recordings', { method: 'POST'");
  });

  it('저장·마이크 요청 중에는 녹음 버튼을 다시 누를 수 없다', () => {
    const toggleHandler = functionBody('const toggleRecording', 'const resetTake');
    expect(toggleHandler).toContain('if (savingLibrary || requestingMic) return;');
    expect(page).toContain('disabled={requestingMic || savingLibrary}');
  });

  it('취소/다시 녹음은 임시 녹음을 버리고 저장 상태를 해제한다', () => {
    const resetHandler = functionBody('const resetTake', 'const saveVerse');
    expect(resetHandler).toContain('discardRecordingRef.current = true');
    expect(resetHandler).toContain('mediaRecorderRef.current?.stop()');
    expect(resetHandler).toContain('next[verseIndex] = null');
    expect(resetHandler).toContain('index === verseIndex ? false : value');
  });

  it('같은 여정·책·장·절을 저장하면 이전 파일을 새 파일로 교체한다', () => {
    expect(recordingsRoute).toContain('eq(recordings.projectId, projectId)');
    expect(recordingsRoute).toContain('eq(recordings.book, book)');
    expect(recordingsRoute).toContain('eq(recordings.chapter, chapter)');
    expect(recordingsRoute).toContain('eq(recordings.verse, verse)');
    expect(recordingsRoute).toContain('await Promise.all(existing.map((item) => env.FILES.delete(item.objectKey)))');
  });

  it('절별 수정은 기존 파일을 먼저 지운 뒤 같은 절의 수정 모드로 이동한다', () => {
    const retakeHandler = functionBody('const startRetake', 'const startFullRetake');
    expect(retakeHandler).toContain("method: 'DELETE'");
    expect(retakeHandler).toContain("setRecordingMode('verse')");
    expect(retakeHandler).toContain('setReplacingRecording(item)');
    expect(audioRoute).toContain('eq(recordings.ownerKey, ownerKey)');
  });

  it('전체 재녹음 안내는 선택 범위의 첫 절을 정확히 표시한다', () => {
    const fullRetakeHandler = functionBody('const startFullRetake', 'const quitDailyJourney');
    expect(fullRetakeHandler).toContain('${passageStartVerse}절부터 새로 녹음해 주세요.');
  });
});

describe('이어듣기·목록 UI 회귀', () => {
  it('매일 말씀 여정은 전체 녹음을 이어듣고 목록에 말씀 위치를 모두 표시한다', () => {
    expect(page).toContain("activeProject && activeProject.kind !== 'free'");
    expect(page).toContain('orderJourneyRecordings');
    expect(page).toContain("<span>{item.book} {item.chapter}{item.book === '시편' ? '편' : '장'} · {item.verse}절</span>");
  });

  it('이어듣기 목록 버튼은 토글되고 절을 눌러도 열린 상태를 유지한다', () => {
    expect(page).toContain('setPlaybackListOpen((current) => !current)');
    const jumpHandler = functionBody('const jumpToChapterRecording', 'const playSelectedBgm');
    expect(jumpHandler).not.toContain('setPlaybackListOpen(false)');
    expect(page).toContain('continuous-player-list');
  });

  it('이어듣기는 일시정지·재개·종료를 제공한다', () => {
    expect(page).toContain('pauseChapterPlayback');
    expect(page).toContain('resumeChapterPlayback');
    expect(page).toContain("chapterPaused ? '계속 듣기' : '일시정지'");
    expect(page).toContain('onClick={stopChapterPlayback}');
  });

  it('보관함이 로그인 계정에 저장된다는 안내를 표시한다', () => {
    expect(page).toContain('로그인한 계정에 안전하게 저장');
    expect(page).not.toContain('현재는 이 브라우저에서 저장한 녹음만 보여요');
  });

  it('친구 메뉴는 데스크톱과 모바일에서 사용할 수 있다', () => {
    expect(page).toContain('onClick={openFriendsTab}');
    expect(page).not.toContain('가족 기능 준비 중');
  });
});
