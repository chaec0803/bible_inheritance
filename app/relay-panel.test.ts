import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const panel = readFileSync(join(process.cwd(), 'app/relay-panel.tsx'), 'utf8');
const playback = readFileSync(join(process.cwd(), 'app/continuous-playback-view.tsx'), 'utf8');
const page = readFileSync(join(process.cwd(), 'app/page.tsx'), 'utf8').replace(/\s+/g, ' ');
const styles = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8').replace(/\s+/g, ' ');

describe('이어읽기 UI 회귀', () => {
  it('서버 상태별 대기·취소·녹음·완료 화면을 갖는다', () => {
    expect(panel).toContain("view.kind === 'invites_pending'");
    expect(panel).toContain("view.kind === 'waiting'");
    expect(panel).toContain("view.kind === 'recordable'");
    expect(panel).toContain("view.kind === 'cancelled'");
    expect(panel).toContain("view.kind === 'completed'");
  });
  it('다른 사람 차례 대기는 새로고침으로 오해되는 회전 아이콘을 사용하지 않는다', () => {
    expect(panel).toContain('<Hourglass size={32}');
    expect(panel).not.toContain('<RotateCcw size={32}');
  });
  it('초대 응답·차례 완료 후 프로젝트를 refetch한다', () => {
    expect(panel).toContain("method: 'POST'");
    expect(panel).toContain('await openProject(project.id)');
    expect(panel).toContain('/complete');
  });
  it('완료 요청은 busy 상태에서 재진입하지 않는다', () => {
    const handler = panel.slice(panel.indexOf('const completeTurn'), panel.indexOf('const openRelayPlayback'));
    expect(handler).toContain('if (busy || !project || project.currentTurnIndex === null) return;');
    expect(panel).toContain('disabled={busy || !project.currentTurnRecording?.complete}');
  });
  it('기존 범위 선택과 shared turn 배분을 재사용한다', () => {
    expect(panel).toContain('<BibleRangePicker');
    expect(panel).toContain('buildRelayTurns');
  });
  it('canRecord 서버 값으로만 녹음 진입을 표시한다', () => {
    expect(panel).toContain('getRelayProjectView(project)');
    expect(panel).toContain('onStartRecording(latestProject, latestTurn)');
    expect(panel).toContain('openRelayPlayback(project)');
  });

  it('초대 상세에 그룹 이름을 표시한다', () => {
    expect(panel).toContain('{project.groupName}');
  });

  it('초대 상세에서 전체 말씀 범위와 rotation을 명시한다', () => {
    expect(panel).toContain('전체 말씀 범위');
    expect(panel).toContain('rotation');
    expect(panel).toContain('project.rotation');
    expect(panel).toContain('relayScopeLabel(project.scope)');
  });

  it('진행 정보를 현재 round와 그룹 내 내 turn으로만 표시한다', () => {
    expect(panel).toContain('현재 round');
    expect(panel).toContain('내 turn');
    expect(panel).toContain('내가 다음 읽을 말씀');
    expect(panel).not.toContain('<small>rotation</small>');
    expect(panel).not.toContain('<small>전체 turn</small>');
  });

  it('남은 내 turn이 없으면 배정 확인 중 대신 내 차례 완료를 표시한다', () => {
    expect(panel).toContain("nextReadingTurn ? passageLabel(nextReadingTurn.passages) : '내 차례 모두 완료'");
    expect(panel).not.toContain('passageLabel(nextReadingTurn?.passages ?? [])');
  });

  it('진행 중과 완료 후 재생이 같은 sequential player를 사용한다', () => {
    expect(panel).toContain('이어읽기 프로젝트 메뉴');
    expect(panel).toContain('<strong>녹음</strong>');
    expect(panel).toContain('<strong>듣기</strong>');
    expect(panel).toContain('openRelayPlayback(project)');
    expect(panel).not.toContain('openCompletedPlayback');
  });

  it('녹음 메뉴는 서버 canRecord만 즉시 진입시키고 나머지는 상태 안내 모달을 연다', () => {
    expect(panel).toContain('const handleRecordAction');
    expect(panel).toContain('await openProject(project.id)');
    expect(panel).toContain('latestProject.canRecord && latestTurn');
    expect(panel).toContain('onStartRecording(latestProject, latestTurn)');
    expect(panel).toContain('relay-recording-status-modal');
    expect(panel).toContain('아직 모두의 답을 기다리고 있어요.');
    expect(panel).toContain('함께 읽기를 모두 완성했어요.');
    expect(panel).toContain('님의 차례를 기다리고 있어요.');
  });

  it('듣기 화면은 현재 목소리·말씀·전체 위치와 재생 조작을 표시한다', () => {
    expect(playback).toContain('CONTINUOUS PLAYBACK');
    expect(playback).toContain('님의 목소리');
    expect(playback).toContain('onTogglePlayback');
    expect(playback).toContain('onSelect(itemIndex)');
  });

  it('Home용 우리 말씀 여정은 내 말씀 여정과 같은 단일 진입 컴포넌트다', () => {
    expect(panel).toContain('export function RelayHomeJourneys');
    expect(panel).toContain('우리 말씀 여정');
    expect(panel).toContain('className="word-card-library-entry journey-library-entry"');
    expect(panel).toContain('onClick={onOpenList}');
    expect(panel).not.toContain('className="relay-home-list"');
  });

  it('매일 말씀 읽기 바로 다음 Home option으로 함께 말씀 이어읽기를 시작한다', () => {
    expect(page).toContain('<strong>함께 말씀 이어읽기</strong>');
    expect(page).toContain('onClick={openRelayCreate}');
    expect(panel).toContain('initialCreate');
    expect(panel).toContain('else if (!initialCreate && initialCreateStartedRef.current)');
    expect(panel).toContain('setCreating(false)');
  });

  it('우리 말씀 여정 목록은 진행 중과 완료를 나누고 각 카드가 상세로 열린다', () => {
    expect(panel).toContain('id="relay-ongoing-title">진행 중');
    expect(panel).toContain('id="relay-completed-title">완료');
    expect(panel).toContain("item.status !== 'completed' && item.status !== 'cancelled'");
    expect(panel).toContain("item.status === 'completed'");
    expect(panel).toContain('openProject(item.id)');
    expect(panel).toContain('className="journey-status-sections relay-journey-status-sections"');
    expect(panel).toContain('running-project-list');
  });

  it('취소된 제안도 목록의 종료 구역에서 확인할 수 있다', () => {
    expect(panel).toContain("item.status === 'cancelled'");
    expect(panel).toContain('id="relay-cancelled-title">종료');
    expect(panel).toContain('cancelledProjects.length');
  });

  it('일반 및 relay 이어듣기는 같은 ContinuousPlaybackView를 사용한다', () => {
    expect(page).toContain('<ContinuousPlaybackView');
    expect(panel).toContain('<ContinuousPlaybackView');
    expect(playback).toContain('CONTINUOUS PLAYBACK');
    expect(playback).toContain('continuous-player-list-trigger');
    expect(playback).toContain('continuous-player-volume');
    expect(playback).toContain('readerName');
  });

  it('모바일에서도 목록 버튼이 고정 헤더 아래에 가려지지 않는다', () => {
    expect(styles).toContain('@media (max-width: 760px) { .relay-screen { width: calc(100% - 16px); margin-top: 76px;');
  });
});
