import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const relay = readFileSync(new URL('./relay-panel.tsx', import.meta.url), 'utf8');

describe('navigation performance regressions', () => {
  it('초기 hash route를 timeout 뒤에 적용해 기본 화면을 먼저 노출하지 않는다', () => {
    expect(page).not.toContain('const initialRouteTimer = window.setTimeout(() => applyNavigationRoute(initialRoute), 0)');
    expect(page).toContain('applyNavigationRoute(initialRoute);');
  });

  it('relay project 선택 즉시 detail shell로 전환하고 목록 refresh가 detail paint를 막지 않는다', () => {
    expect(relay).toContain('setOpeningProject(summary);');
    expect(relay).toContain('if (openingProject)');
    expect(relay).not.toContain('setProject(payload.project);\n      await refreshList();');
  });

  it('relay 녹음은 본문 fetch 전에 recording shell로 이동한다', () => {
    expect(page).toContain("setRelayRecording(null);\n    setRelayRecordingLoading(true);\n    navigateTo('recording');");
    expect(page).toContain("appTab === 'recording' && relayRecordingLoading");
  });

  it('smooth scroll animation으로 route paint를 지연하지 않는다', () => {
    expect(page).not.toContain("window.scrollTo({ top: 0, behavior: 'smooth' });");
  });
});
