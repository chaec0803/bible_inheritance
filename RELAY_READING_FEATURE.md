# 친구 그룹 이어읽기

## 목적

여러 친구나 가족이 전원 승낙한 뒤 정해진 순서로 배정된 말씀을 녹음하고, 모든 turn을 끝내면 하나의 이어읽기로 듣는다.

## 상태의 source of truth

서버의 `relay_projects`, `relay_participants`, `relay_turns`만 상태를 소유한다. 클라이언트는 다음 값을 조회해 그대로 렌더링하며 별도 relay 상태 머신을 저장하지 않는다.

- `project.status`
- `participant.inviteStatus`
- `project.currentTurnIndex`
- `turn.memberKey`, `turn.completedAt`
- `canRecord`
- `currentTurnRecording`

DB는 기존 4개 relay 테이블만 사용하며 notification, progress, relay audio 테이블을 추가하지 않는다. 음성은 기존 `recordings`에 `relay:{projectId}:turn:{turnIndex}` context로 저장한다.

## 사용자 흐름

1. `이어읽기` 메뉴에서 저장된 그룹을 고르거나 새 그룹을 만든다.
2. 말씀 범위, BGM, rotation, 초대 메시지를 정한다.
3. shared `buildRelayTurns` 결과로 turn별 배분을 미리 본다.
4. 제안 후 모든 참여자가 승낙할 때까지 `PENDING_INVITES`로 기다린다. 한 명이 거절하면 `CANCELLED`다.
5. 마지막 승낙으로 `IN_PROGRESS`가 되며, 서버가 `canRecord=true`를 반환한 현재 담당자만 녹음한다.
6. 기존 녹음 화면에서 배정 범위만 읽고, 저장 후 프로젝트로 돌아간다.
7. 서버가 `currentTurnRecording.complete=true`를 반환하면 `이번 차례 완료`를 실행한다. 응답 후 항상 project를 refetch한다.
8. 마지막 turn이 끝나면 `COMPLETED`가 되고, participant는 turn/passage 순서로 녹음과 공통 BGM을 이어 듣는다.

## 서버 API

- `GET/POST /api/friend-groups`
- `GET/POST /api/relay-projects`
- `GET /api/relay-projects/:projectId`
- `GET /api/relay-invites`
- `POST /api/relay-projects/:projectId/accept`
- `POST /api/relay-projects/:projectId/decline`
- `POST /api/relay-projects/:projectId/turns/:turnIndex/complete`
- `GET /api/relay-projects/:projectId/recordings`
- 기존 `POST/PUT/DELETE /api/recordings`

## 안전 규칙

- 녹음 권한은 UI가 아닌 서버가 판정한다.
- 현재 turn 담당자만 배정 범위를 생성·교체·삭제할 수 있다.
- 지난 turn, 미래 turn, 완료 turn은 immutable하다.
- 일반 녹음과 선물 녹음은 relay context가 있을 때만 분기하므로 기존 동작을 유지한다.
- 다른 사용자의 relay 음성은 완료된 프로젝트 participant에게만 재생을 허용한다.
- mutation이 stale 상태로 실패하면 클라이언트는 현재 project를 refetch한다.

## Beta 비범위

WebSocket, deadline, skip, 자동 재배정, 중간 멤버 변경, 실제 음원 파일 merge는 포함하지 않는다. 화면 진입, mutation 성공/실패, app focus에서 서버 상태를 새로 조회한다.
