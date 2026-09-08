# 아이폰 녹음·BGM 개선 및 pull 리뷰

작성일: 2026-09-08 · 검토 버전: `956ebc3`

수정 후속 기록: 같은 날 아래 리뷰의 1번(중간 절 저장 실패 누락)과 2번(시작 실패 시 마이크 정리)을 수정했다. 일반·선물 녹음은 실패한 저장 작업을 최종 검사까지 유지하고 실패한 절의 재녹음을 안내한다. 연속 녹음은 recorder 생성 또는 시작 실패 시 자원을 정리하며, 다음 절 시작 실패 시 기존 절은 종료·저장할 수 있도록 유지한다. 회귀 테스트 6개를 추가해 전체 645개 테스트가 통과했다. 아래 리뷰 본문은 수정 전 상태에 대한 기록이다.

이번 변경은 **목소리를 자연스럽게 보존하고, 작은 녹음 소리를 키우며, 아이폰에서 배경음악의 크기를 조절할 수 있도록 하는 작업**이다. 녹음 저장과 재생 흐름도 함께 개선했다. 다만 실제 아이폰에서 이전 버전과 비교 청취한 결과는 확인되지 않아, “음질 개선을 위한 구현을 했다”와 “음질 개선이 입증됐다”는 구분해야 한다.

**무엇을 바꿨는가**

| 개선 목적 | 코드에서 확인한 노력 | 사용자가 기대할 수 있는 변화와 한계 |
| --- | --- | --- |
| 목소리의 자연스러움 보존 | 마이크의 자동 음량 조절·에코 제거·잡음 억제 요청을 모두 끔. 녹음 경로를 마이크 → 고정 증폭 → 녹음으로 단순화 | 말소리를 자동으로 눌러 조절하는 영향을 줄이려는 변경. 주변 잡음도 더 그대로 들어올 수 있음 |
| 작은 녹음 소리 보완 | 녹음 신호를 일괄 2배, 약 +6dB 증폭 | 작은 목소리가 더 잘 들릴 수 있음. 큰 소리도 함께 키우므로 소리 깨짐 방지 보완 필요 |
| 아이폰 BGM 음량 조절 | 음악 재생 요소에 별도 Web Audio 음량 조절기(GainNode)를 연결 | 아이폰에서 일반적인 오디오 volume 조절이 반영되지 않는 문제를 해결하려는 구현. 목소리와 음악을 별도로 조절 |
| 목소리와 음악의 균형 | 음악 슬라이더 값을 제곱해 적용. 예: 50% → 신호 배율 0.25, 10% → 0.01 | 낮은 설정에서 음악을 더 작게 깔 수 있음. 이 숫자는 사람이 느끼는 음량의 백분율은 아님 |
| 녹음 저장 중 손실·대기 줄이기 | 연속 녹음에서 마이크 연결을 유지하면서 절마다 녹음 파일을 생성. 다음 절 녹음기를 먼저 시작하고 이전 것을 종료 | 절을 넘길 때 저장 완료를 기다리지 않도록 함. 실제 절 경계의 끊김·중복 여부는 기기에서 확인 필요 |
| 불필요한 재변환 줄이기 | 일반·선물 연속 녹음은 브라우저가 만든 파일을 그대로 저장하도록 변경 | 저장할 때 다시 잘라 압축하는 단계를 줄임. 이것은 무압축·무손실 녹음을 뜻하지 않음 |
| 저장 안정성 | 연속 녹음 파일을 기기 내 IndexedDB에 먼저 보관하고 업로드 큐에서 최대 3개씩 전송 | 서버 전송이 실패해도 기기 저장에 성공한 파일은 재전송 가능. 기기 저장 자체가 실패하는 경로는 아래 보완 필요 |
| 선물 파일의 음악 균형 | MP3 내보내기에도 같은 BGM 음량 계산식을 적용. 44.1kHz 스테레오, 192kbps MP3 생성 | 앱과 내려받은 파일이 같은 음악 배율을 사용. 기기별 체감 음량이나 합산 신호의 깨짐까지 보장하지는 않음 |
| 모바일 재생 호환성 | 선물 초안 오디오에 부분 요청(Range) 응답 추가. 재생 중단 오류와 자원 정리 처리 보강 | 오디오 일부를 요청하는 재생 흐름과 일시정지·재시작을 지원. 음색 개선과는 별개의 안정성 작업 |

기존 일반 녹음도 이미 48kHz·16bit·모노 입력을 요청하고 256kbps 녹음을 설정했다. 따라서 이 수치를 이번에 처음 높였다고 설명하면 부정확하다. 현재 일반 녹음과 선물 연속 녹음에는 256kbps 설정이 있지만, 선물의 한 절 재녹음과 음성 쪽지에는 같은 설정이 명시되어 있지 않다. 또한 입력의 `ideal` 값은 요청값이므로 실제 기기에서 반드시 그대로 적용된다는 뜻은 아니다.

BGM 원본 음악 파일의 교체·리마스터링은 이번 diff에서 확인되지 않았다. BGM 관련 핵심은 음악 자체의 해상도를 높이는 작업보다 **목소리를 가리지 않도록 재생 크기와 제어 방식을 개선하는 작업**이다. `lib/audio-mp4.ts`에 MP4 변환 함수가 남아 있지만 현재 앱의 녹음 저장 경로에서는 호출하지 않는다.

주요 구현 근거: [녹음 입력·증폭](/Users/anniechang/Documents/Projects/bible_inheritance/lib/recording-audio.ts:5), [BGM 조절](/Users/anniechang/Documents/Projects/bible_inheritance/lib/browser-bgm-gain.ts:24), [BGM 배율](/Users/anniechang/Documents/Projects/bible_inheritance/lib/audio-volume.ts:1), [절별 연속 녹음](/Users/anniechang/Documents/Projects/bible_inheritance/lib/segmented-recording-session.ts:112), [기기 저장·전송 큐](/Users/anniechang/Documents/Projects/bible_inheritance/lib/recording-upload-queue.ts:37), [MP3 생성](/Users/anniechang/Documents/Projects/bible_inheritance/lib/gift-mp3.ts:63).

**리뷰에서 발견한 보완 사항**

1. **[P1] 중간 절의 기기 저장 실패가 최종 완료 검사에서 사라진다.** 일반 녹음의 `trackContinuousCapture`는 성공·실패와 관계없이 완료된 Promise를 대기 목록에서 삭제한다. 절 이동에서는 반환값을 기다리지 않는다. 따라서 중간 절의 IndexedDB 저장이 실패한 뒤 마지막 절이 정상 저장되면, 종료 시 `Promise.all`과 업로드 큐에는 실패한 절이 남아 있지 않다. 반면 완료 절 목록에는 그 절을 이미 추가했으므로 모든 절을 저장했다는 안내가 나올 수 있다. 선물 녹음에도 같은 실패 추적 누락 패턴이 있다. 실패 기록을 세션 끝까지 보존하고 누락된 절을 복구하거나 완료를 막아야 한다. [일반 녹음](/Users/anniechang/Documents/Projects/bible_inheritance/app/page.tsx:813), [선물 녹음](/Users/anniechang/Documents/Projects/bible_inheritance/app/gift-studio.tsx:395).

2. **[P2] 녹음 시작 실패 후에도 마이크 연결이 남는다.** 연속 녹음은 recorder를 `activeRecorders`에 먼저 등록한 뒤 `start()`를 호출한다. 이 호출이 예외를 던지면 inactive recorder가 목록에 남는다. 이후 `dispose()`도 inactive 항목을 제거하지 않으므로 목록이 비어야 실행되는 마이크·AudioContext 정리가 진행되지 않는다. 실제 함수를 가짜 recorder와 연결해 시작 예외를 재현했을 때 `dispose()` 후에도 마이크 stop과 context close가 모두 0회였다. 실패한 recorder를 목록에서 제거하고 시작 실패 시 자원을 정리해야 한다. [시작 처리](/Users/anniechang/Documents/Projects/bible_inheritance/lib/segmented-recording-session.ts:97).

3. **[P2] 고정 2배 증폭에 큰 소리 보호가 없다.** 입력 크기와 관계없이 모든 샘플에 2를 곱한다. 예를 들어 입력 피크가 0.7이면 출력은 1.4가 되어 일반적인 정규화 오디오 범위 ±1을 넘는다. 가까이서 크게 읽는 경우 인코딩·재생 과정에서 소리가 깨질 위험이 있다. 현재 경로에는 피크 검사나 증폭량 조절이 없다. 입력 여유에 따라 증폭량을 낮추거나 큰 피크만 보호하는 처리를 마련하고, 큰 목소리 녹음으로 검증해야 한다. 이는 코드상 신호 범위 검토이며 실기기 청취로 재현한 결과는 아니다. [증폭 적용](/Users/anniechang/Documents/Projects/bible_inheritance/lib/recording-audio.ts:42).

**검증 결과와 범위**

- 마지막 pull의 reflog 기준 `a96bc6b..956ebc3`: 33개 커밋, 160개 파일. 선물 초안·음성 편지·복수 수신자·친구 차단·이어읽기·화면 이동·DB 변경도 포함한다. 리뷰는 녹음·BGM·저장 실패 경로를 중심으로 관련 재생·API·이동 변경을 확인했다. 모든 새 기능을 실환경에서 검증한 것은 아니다.
- 현재 checkout에서 Vitest **85개 파일, 639개 테스트 통과**. TypeScript `--noEmit --incremental false`, oxlint `app lib db`도 통과했다.
- 시작 예외 후 자원 정리 누락은 실제 세션 함수를 사용한 가짜 recorder로 재현했다. 중간 저장 실패 누락은 해당 Promise 추적 패턴을 격리 실행해 최종 대기가 성공하는 것을 확인했다. 실제 아이폰·IndexedDB 장애를 발생시킨 실기기 테스트는 아니다.
- `pnpm test`는 의존성 설치 과정에서 `protobufjs` 빌드 스크립트 허용 설정 문제로 중단됐다. 설치된 로컬 Vitest·TypeScript·oxlint 실행 파일을 직접 사용해 위 검사를 수행했다. 설치 도중 자동 추가된 저장소 설정은 원복했다.
- 저장소의 BrowserStack 결과는 `--list` 실행 기록이며, 실제 결과 배열은 비어 있고 iPhone 15 Pro·16 Pro 항목 모두 skipped다. **실기기 테스트 통과의 증거로 사용할 수 없다.** 테스트 코드의 BGM 검증도 슬라이더 숫자와 화면 상태를 확인하며 실제 소리 크기를 측정하지 않는다. [기록](/Users/anniechang/Documents/Projects/bible_inheritance/qa/browserstack/artifacts/browserstack/results.json:1), [QA 코드](/Users/anniechang/Documents/Projects/bible_inheritance/qa/browserstack/real-iphone.spec.ts:52).
- 프로덕션 빌드, 배포, 실제 아이폰 비교 청취는 이번 리뷰에서 수행하지 않았다. 제품 코드는 수정하지 않았다.

**다음 확인은 실제 소리를 기준으로 해야 한다.** 같은 아이폰·거리·문장·시스템 볼륨으로 이전 버전과 현재 버전을 각각 녹음해 작은 목소리, 보통 목소리, 큰 목소리를 비교하면 된다. BGM 0·10·50·100%에서 목소리가 묻히는지 확인하고, 이어폰 유무에 따른 음악의 마이크 유입도 들어봐야 한다. 절 전환 직전·직후 발음 누락, 저장 실패 뒤 누락된 절 표시, MP3 다운로드 후 목소리와 음악의 균형까지 확인하면 구현의 효과를 사용자 경험으로 검증할 수 있다.
