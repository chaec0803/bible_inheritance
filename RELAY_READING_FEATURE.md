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

1. Home의 `함께 말씀 이어읽기`에서 저장된 그룹을 고르거나 새 그룹을 만든다.
2. 말씀 범위, BGM, rotation, 초대 메시지를 정한다.
3. shared `buildRelayTurns` 결과로 turn별 배분을 미리 본다.
4. 제안 후 모든 참여자가 승낙할 때까지 `PENDING_INVITES`로 기다린다. 한 명이 거절하면 `CANCELLED`다.
5. 마지막 승낙으로 `IN_PROGRESS`가 되며, 서버가 `canRecord=true`를 반환한 현재 담당자만 녹음한다.
6. 기존 녹음 화면에서 배정 범위만 읽고, 저장 후 프로젝트로 돌아간다.
7. 서버가 `currentTurnRecording.complete=true`를 반환하면 `이번 차례 완료`를 실행한다. 응답 후 항상 project를 refetch한다.
8. 마지막 turn이 끝나면 `COMPLETED`가 되고, participant는 turn/passage 순서로 녹음과 공통 BGM을 이어 듣는다.

## Home inbox와 프로젝트 분류

- Home에는 `내 말씀 여정`과 같은 visual language의 `우리 말씀 여정` 단일 진입 카드를 둔다.
- 카드 아이콘의 작은 빨간 숫자 badge는 다음 두 개수의 합이다.
  - 현재 사용자가 아직 응답하지 않은 `PENDING_INVITES` 초대
  - `IN_PROGRESS`이며 현재 사용자에게 `canRecord=true`인 프로젝트
- badge는 별도 notification row나 DB 상태를 만들지 않고 기존 project/participant/turn 조회 결과에서 계산한다.
- Home에 머물 때는 15초마다, 앱이 다시 visible 상태가 될 때는 즉시 새로 조회한다.
- `우리 말씀 여정` 목록은 프로젝트를 중복 없이 다음 구역으로 나눈다.
  1. `승인 대기 중`: `PENDING_INVITES`
  2. `내 차례`: `IN_PROGRESS && canRecord`
  3. `진행 중`: `IN_PROGRESS && !canRecord`
  4. `완료`: `COMPLETED`
  5. `종료`: `CANCELLED`

## 참여자 dropdown

- 프로젝트 상세에서 참여자 카드를 항상 나열하지 않고, 겹친 순서 아바타와 `참여자 N명`만 기본으로 보여준다.
- 요약을 누르면 native `details/summary`로 구현한 소형 dropdown이 열린다. 이를 위한 React 상태는 추가하지 않는다.
- dropdown은 참여자를 `position ASC`로 표시하고 순서 번호, nickname, 초대 상태를 보여준다.
- 현재 turn의 `memberKey`와 같은 참여자 row만 sage 계열 배경으로 강조한다.
- 인원이 많으면 페이지가 늘어나지 않고 dropdown 내부만 세로 scroll한다. 긴 nickname은 말줄임 처리한다.

## 녹음과 듣기 UI

- 프로젝트 상세의 핵심 동작은 기존 toolbar 패턴의 `녹음 / 듣기`다.
- `canRecord=true`면 기존 말씀 녹음 UI로 바로 진입한다. 다른 사람 차례면 대기 모달을 표시하고 미래 turn 선녹음은 허용하지 않는다.
- `듣기`는 기존 `ContinuousPlaybackView`와 목록/재생/BGM control을 공유한다. relay 전용 player를 두지 않는다.
- `IN_PROGRESS`에서도 완료 turn과 현재 turn에 실제 저장된 녹음까지 `turnIndex ASC → 말씀 순서 ASC`로 재생한다. 미래 turn은 제외한다.
- relay 재생에서는 현재 낭독자 이름만 기존 이어듣기 metadata에 추가한다.

## 서버 API

- `GET/POST /api/friend-groups`
- `GET/POST /api/relay-projects`
- `GET /api/relay-projects/:projectId`
- `DELETE /api/relay-projects/:projectId` (creator only)
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
- 다른 사용자의 relay 음성은 해당 프로젝트 participant에게만 재생을 허용한다. `IN_PROGRESS`에서도 현재까지 저장된 유효 녹음은 재생할 수 있다.
- mutation이 stale 상태로 실패하면 클라이언트는 현재 project를 refetch한다.

## 초대 전 순서 변경

- 생성 wizard에서 선택한 그룹의 참여자 전체(creator 포함)를 위/아래로 이동할 수 있다.
- 변경된 순서는 `memberKeys`로 생성 API에 전달되며, 서버는 저장된 그룹과 멤버 집합이 정확히 같은지 검증한다.
- 검증된 순서 하나로 participant position, rotation turn, 말씀 배분 preview를 모두 만든다.
- 프로젝트가 생성되어 초대가 발송된 뒤에는 순서 변경 API나 UI를 제공하지 않는다.

## 프로젝트 삭제

- `PENDING_INVITES`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` 모두 creator만 삭제할 수 있다.
- 확인 모달을 거치며 삭제 중에는 버튼을 잠가 중복 요청을 막는다.
- 삭제 시 `relay:{projectId}:turn:%` 녹음의 R2 object와 recording row, relay turns, participants, project를 정리한다.
- 재사용 가능한 friend group과 일반/선물 녹음은 유지한다.
- 성공 후 상세를 닫고 `우리 말씀 여정` 목록을 다시 조회한다.

## Beta 비범위

WebSocket, deadline, skip, 자동 재배정, 중간 멤버 변경, 실제 음원 파일 merge는 포함하지 않는다. 화면 진입, mutation 성공/실패, app focus에서 서버 상태를 새로 조회한다.
