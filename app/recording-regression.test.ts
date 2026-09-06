import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8').replace(/\s+/g, ' ');
const recordingsRoute = readFileSync(new URL('./api/recordings/route.ts', import.meta.url), 'utf8');
const audioRoute = readFileSync(new URL('./api/recordings/[id]/audio/route.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./globals.css', import.meta.url), 'utf8').replace(/\s+/g, ' ');

function functionBody(startMarker: string, endMarker: string) {
  return page.slice(page.indexOf(startMarker), page.indexOf(endMarker));
}

describe('녹음·저장·수정 회귀', () => {
  it('일반 녹음은 공통 세션 하나가 recorder, stream, AudioContext를 소유한다', () => {
    expect(page).toContain('createRecordingSession({');
    expect(page).toContain('recordingSessionRef');
    expect(page).not.toContain('mediaRecorderRef');
    expect(page).not.toContain('recordingAudioContextRef');
    expect(page).not.toContain('streamRef');
    expect(page).not.toContain('discardRecordingRef');
  });

  it('리버브 선택과 효과 처리를 제공하지 않고 원음으로 녹음한다', () => {
    expect(page).not.toContain("const reverbOptions =");
    expect(page).not.toContain("const [reverb, setReverb]");
    expect(page).not.toContain('<legend>리버브</legend>');
    expect(page).not.toContain("formData.append('reverb'");
    expect(page).not.toContain('createRecordingAudioGraph(stream, reverb)');
  });

  it('범위 녹음을 보관함에서 확인한 뒤 여정을 저장해 완료할 수 있다', () => {
    expect(page).toContain('여정 저장하기');
    expect(page).toContain('recordingCompleteJourneyIds.has(activeProject.id)');
    expect(page).toContain('requestJourneyCompletion');
    expect(page).toContain('setConfirmJourneyCompletion(true)');
    expect(page).toContain('saveCompletedJourney(Date.now());');
  });

  it('이어 녹음 타이머와 절별 녹음 타이머가 동시에 실행되지 않는다', () => {
    expect(page).toContain("if (!recording || recordingMode !== 'continuous') return;");
    expect(page).toContain("if (!recording || recordingMode === 'continuous') return;");
  });

  it('이어 녹음 종료 시 현재 절 경계를 포함해 절마다 저장한다', () => {
    const stopHandler = functionBody('const stopContinuousAndSaveCurrent', 'useEffect(() => {');
    expect(stopHandler).toContain('verseIndex');
    expect(stopHandler).toContain('recordingSessionRef.current.stop()');

    const saveHandler = functionBody('const saveCompletedContinuousVerses', 'const startRecording');
    expect(saveHandler).toContain('boundaries.map');
    expect(saveHandler).toContain("formData.append('recordingGroupId'");
    expect(saveHandler).toContain("formData.append('recordingMode', 'continuous')");
    expect(saveHandler).toContain("fetch('/api/recordings', { method: 'POST'");
  });

  it('다음 절 이동은 불필요한 전체 화면 상태 갱신 없이 즉시 반영한다', () => {
    const moveHandler = functionBody('const moveContinuousVerse', 'const completeContinuousVerse');
    expect(moveHandler).toContain('flushSync(() => setVerseIndex(safeIndex))');
    expect(moveHandler).not.toContain('setContinuousBoundaries');
  });

  it('여기까지 녹음은 저장 처리 전에 즉시 종료 상태를 보여준다', () => {
    const stopHandler = functionBody('const stopContinuousAndSaveCurrent', 'useEffect(() => {');
    expect(stopHandler).toContain('setRecording(false)');
    expect(stopHandler).toContain('setSavingLibrary(true)');
    expect(stopHandler.indexOf('setRecording(false)')).toBeLessThan(stopHandler.indexOf('recordingSessionRef.current.stop()'));
  });

  it('이어 녹음 종료 조작은 타이머 아래에 있고 모바일 화면에서 항상 보인다', () => {
    const recorder = functionBody('<section className="recording-card"', '<aside className="sound-panel"');
    expect(recorder.indexOf('className="timer"')).toBeLessThan(recorder.indexOf('aria-label="이어 녹음 진행"'));
    expect(styles).toContain('@media (max-width: 720px)');
    expect(styles).toContain('.continuous-record-actions { position: sticky; bottom: 82px; z-index: 20;');
  });

  it('녹음은 무압축 WAV가 아니라 고음질 MP4로 압축해 저장한다', () => {
    expect(page).toContain('encodeAudioBufferSegmentAsMp4');
    expect(page).toContain("{ type: 'audio/mp4' }");
    expect(page).toContain('.mp4`');
    expect(page).not.toContain('encodeAudioBufferAsWav(decoded');
  });

  it('저장·마이크 요청 중에는 녹음 버튼을 다시 누를 수 없다', () => {
    const toggleHandler = functionBody('const toggleRecording', 'const resetTake');
    expect(toggleHandler).toContain('if (savingLibrary || requestingMic) return;');
    expect(page).toContain('disabled={requestingMic || savingLibrary}');
  });

  it('취소/다시 녹음은 임시 녹음을 버리고 저장 상태를 해제한다', () => {
    const resetHandler = functionBody('const resetTake', 'const saveVerse');
    expect(resetHandler).toContain('recordingSessionRef.current?.dispose()');
    expect(resetHandler).toContain('recordingSessionRef.current = null');
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

  it('절별 수정은 기존 파일을 즉시 지운 뒤 같은 절의 수정 모드로 이동한다', () => {
    const retakeHandler = functionBody('const startRetake', 'const startFullRetake');
    expect(retakeHandler).toContain("method: 'DELETE'");
    expect(retakeHandler).toContain('setReplacingRecording(item)');
    expect(retakeHandler).toContain("setRecordingMode('verse')");
    expect(audioRoute).toContain('eq(recordings.ownerKey, ownerKey)');
  });

  it('완료된 여정과 장은 녹음·수정·전체 삭제를 잠근다', () => {
    expect(page).toContain('currentUnitLocked');
    expect(page).toContain('완료된 말씀은 더 이상 수정할 수 없어요');
    expect(page).toContain('selectedLibraryUnitLocked');
    expect(recordingsRoute).toContain('isRecordingMutationLocked');
    expect(audioRoute).toContain('isRecordingMutationLocked');
  });

  it('필요한 절을 모두 녹음해도 완료하기 전에는 여정을 잠그지 않는다', () => {
    expect(page).toContain("const completedJourneyIds = useMemo(() => new Set(activeProjects.filter((project) => project.completedAt).map((project) => project.id))");
    expect(page).toContain('recordingCompleteJourneyIds.has(activeProject.id)');
  });

  it('진행 중·완료된 말씀 읽기 모두 삭제 동작을 눈에 보이게 제공한다', () => {
    expect(page).toContain('말씀 읽기 삭제');
    expect(page).toContain('완료된 말씀 삭제');
    expect(page).toContain('quitDailyJourney(confirmQuitJourneyOpen)');
  });

  it('완료된 말씀을 절이 아니라 말씀 묶음 단위로 하나 이상 선택해 선물한다', () => {
    expect(page).toContain('completedGiftProjectIds');
    expect(page).toContain('선택한 말씀');
    expect(page).not.toContain('절 선물 선택');
  });

  it('전체 재녹음 안내는 선택 범위의 첫 절을 정확히 표시한다', () => {
    const fullRetakeHandler = functionBody('const startFullRetake', 'const quitDailyJourney');
    expect(fullRetakeHandler).toContain('${passageStartVerse}절부터 새로 녹음해 주세요.');
  });
});

describe('이어듣기·목록 UI 회귀', () => {
  it('성경 읽기의 범위 지정은 날짜 일정이 없는 자유 읽기로 만든다', () => {
    const rangeHandler = functionBody('const startBibleRange', 'const finishOnboarding');
    expect(rangeHandler).toContain("kind: 'free'");
    expect(rangeHandler).toContain('duration: 0');
    expect(rangeHandler).not.toContain("kind: 'guided'");
    expect(page).toContain("activeProject && activeProject.kind !== 'free'");
  });

  it('매일 말씀 여정은 전체 녹음을 이어듣고 목록에 말씀 위치를 모두 표시한다', () => {
    expect(page).toContain("activeProject && activeProject.kind !== 'free'");
    expect(page).toContain('orderJourneyRecordings');
    expect(page).toContain('{item.book} {item.chapter}');
    expect(page).toContain('{item.verse}절');
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
