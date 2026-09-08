# 로컬 스크롤 UI 회귀 테스트

로컬 Sites 테스트 계정으로 실행한다. 운영 로그인·녹음·선물 전송은 사용하지 않는다. 친구 선택창 테스트만 30명의 가상 친구 응답을 주입한다.

1. Google Chrome 및 Playwright WebKit을 준비한다.
2. 로컬 테스트용 서버를 실행한다. `.env.local` 파일을 변경할 필요는 없다.

```sh
NEXT_PUBLIC_SUPABASE_URL='' NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='' ./node_modules/.bin/vinext dev --host 127.0.0.1
```

3. 별도 터미널에서 실행한다.

```sh
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/verse-ui-qa/browsers ./node_modules/.bin/playwright install webkit
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/verse-ui-qa/browsers ./node_modules/.bin/playwright test -c qa/ui/playwright.config.ts
```

결과 JSON·스크린샷·실패 trace는 `/private/tmp/verse-ui-qa`에 저장한다.

검사 범위: Chrome/WebKit 데스크톱, Chrome 모바일, WebKit 모바일 390×844 및 375×667. 긴 읽기 계획, 가로 넘침, 뒤쪽 화면 숨김, 홈·친구·녹음·보관함 이동, 모달 배경 스크롤 잠금·해제, 하단 빠른 이동 버튼 겹침을 확인한다. 긴 계획은 Chrome 라이트·WebKit 다크 모드로 확인한다.

WebKit 모바일 자동화는 휠 입력을 지원하지 않는다. 해당 설정에서는 프로그램으로 스크롤 위치 이동과 CSS 스크롤 잠금을 확인한다. 휠 입력 검사는 Chrome과 데스크톱 WebKit에서 수행한다. 실제 아이폰 Safari의 손가락 스와이프·주소창 크기 변화·바운스는 이 테스트가 대체하지 않는다.

`audio.spec.ts`는 6초짜리 합성 WAV 두 개와 녹음 목록을 응답 fixture로 사용한다. BGM 0%·30%에서 BGM 404가 발생해도 첫 절의 실제 `currentTime`이 증가하고 다음 절로 넘어가는지 확인한다. 정상 BGM일 때 일시정지·재개와 음량 0→30% 변경도 확인하며, 재생 API를 가짜 성공으로 대체하지 않는다. 실제 사용자 녹음·운영 R2 데이터는 사용하지 않는다.

2026-09-08 후속 수정: 기존 코드는 BGM 404 때 0%·30% 모두 첫 절의 재생 시간이 0초에 머무는 것을 재현했다. 수정본은 목소리와 BGM 시작을 별도로 처리하고, BGM 0%에서는 음악 재생을 생략한다. BGM 실패는 목소리를 정지하지 않으며, 종료된 재생의 지연 오류를 현재 재생에 적용하지 않는다. 실제 아이폰의 동일 오류 원인을 서버 로그만으로 확정한 것은 아니며, 테스트 음원으로 재현한 실패 경로를 수정한 결과다.

BGM 재생은 목소리와 같은 AudioContext의 반복 AudioBufferSourceNode를 사용한다. 음악용 HTMLAudioElement를 매번 생성하지 않으며, 사용자 탭에서 context.resume()을 먼저 호출하고 다운로드·디코딩 후 음악을 시작한다. 정지 중 완료된 다운로드가 음악을 뒤늦게 켜지 않도록 취소 세대를 검사하고, 교체/종료 시 노드를 해제한다. 0% 음량 변경은 디코딩을 반복하지 않는다.

정상 BGM 테스트는 GainNode 뒤의 AnalyserNode로 실제 음악 신호를 측정한다. `BGM_QA_DIR`에 `aeternum.mp3`, `unto-thee.mp3`, `the-kings-return.mp3`를 준비하면 합성 음악 대신 해당 파일을 사용한다. 이번 검증에서는 운영 BGM API에서 받은 원본 MP3 3곡을 사용했다. 서버 응답은 모두 200, Aeternum bytes=0-1 요청은 206/2바이트였다. 이는 실제 아이폰에서 수집한 오류 로그에 의한 원인 확정은 아니다. WebKit과 Chrome에서 차단될 수 있는 별도 미디어 재생 경로를 제거하고 실제 음악 출력을 검증한 것이다.
