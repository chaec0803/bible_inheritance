import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

function zIndex(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{[^}]*z-index:\\s*(\\d+)`, 's'));
  return Number(match?.[1] ?? -1);
}

describe('삭제 확인창 레이어', () => {
  it('완료 목록 오버레이가 열려 있어도 삭제 확인창 버튼이 터치를 받는다', () => {
    const blockingRule = css.match(/\.app-shell\.onboarding-open\s*>\s*([^{]+){\s*pointer-events:\s*none;/)?.[1] ?? '';
    expect(blockingRule).toContain(':not(.confirm-retake-backdrop)');
  });

  it('말씀 여정 전체 일정과 떠 있는 홈 버튼보다 위에서 터치를 받는다', () => {
    expect(zIndex('.confirm-retake-backdrop')).toBeGreaterThan(zIndex('.onboarding-overlay'));
    expect(zIndex('.confirm-retake-backdrop')).toBeGreaterThan(zIndex('.floating-home-button'));
  });
});

describe('말씀 선물 도착 모달 레이어', () => {
  it('어느 화면에서도 클릭을 받고 기존 주요 모달보다 위에 표시한다', () => {
    const blockingRule = css.match(/\.app-shell\.onboarding-open\s*>\s*([^{]+){\s*pointer-events:\s*none;/)?.[1] ?? '';
    expect(blockingRule).toContain(':not(.gift-arrival-backdrop)');
    expect(zIndex('.gift-arrival-backdrop')).toBeGreaterThan(zIndex('.continuous-player-backdrop'));
  });
});

describe('완료된 말씀 이어듣기 레이어', () => {
  it('완료 목록 오버레이의 뒤쪽 클릭 차단에서 이어듣기 모달을 제외한다', () => {
    const blockingRule = css.match(/\.app-shell\.onboarding-open\s*>\s*([^{]+){\s*pointer-events:\s*none;/)?.[1] ?? '';
    expect(blockingRule).toContain(':not(.continuous-player-backdrop)');
  });

  it('완료 목록 화면과 떠 있는 버튼보다 위에 모달을 표시한다', () => {
    expect(zIndex('.continuous-player-backdrop')).toBeGreaterThan(zIndex('.onboarding-overlay'));
    expect(zIndex('.continuous-player-backdrop')).toBeGreaterThan(zIndex('.floating-route-actions'));
  });

  it('삭제 버튼은 전체 폭 주요 버튼이 아니라 작은 보조 동작으로 표시한다', () => {
    const compactDeleteRule = css.match(/\.continuous-player-modal\s*>\s*\.completed-journey-delete\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(compactDeleteRule).toContain('width: auto');
    expect(compactDeleteRule).toContain('min-height: 34px');
  });
});

describe('하루 읽기 완료 모달 레이어', () => {
  it('홈이나 선물 화면이 열려 있어도 완료 모달 버튼이 터치를 받는다', () => {
    const blockingRule = css.match(/\.app-shell\.onboarding-open\s*>\s*([^{]+){\s*pointer-events:\s*none;/)?.[1] ?? '';
    expect(blockingRule).toContain(':not(.completion-modal-backdrop)');
  });

  it('홈 화면과 떠 있는 버튼보다 위에 완료 모달을 표시한다', () => {
    expect(zIndex('.completion-modal-backdrop')).toBeGreaterThan(zIndex('.onboarding-overlay'));
    expect(zIndex('.completion-modal-backdrop')).toBeGreaterThan(zIndex('.floating-route-actions'));
  });
});

describe('선물 전송 완료와 보낸 선물 동작 크기', () => {
  it('완료 목록 오버레이가 열려 있어도 선물 전송 모달의 모든 버튼이 터치를 받는다', () => {
    const blockingRule = css.match(/\.app-shell\.onboarding-open\s*>\s*([^{]+){\s*pointer-events:\s*none;/)?.[1] ?? '';
    expect(blockingRule).toContain(':not(.gift-dialog-backdrop)');
  });

  it('단일 확인 버튼을 모달 가운데에 배치한다', () => {
    const actions = css.match(/\.gift-send-success-actions\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(actions).toContain('grid-template-columns: 1fr');
    expect(actions).toContain('justify-items: center');
  });

  it('보낸 선물 삭제는 카드 전체 폭이 아닌 작은 보조 버튼이다', () => {
    const button = css.match(/\.sent-gift-card\s*>\s*\.completed-journey-delete\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(button).toContain('width: auto');
    expect(button).toContain('min-height: 32px');
    expect(button).toContain('margin: 10px 0 0 auto');
  });
});

describe('말씀카드 모달 레이어', () => {
  it('홈 오버레이가 열려 있어도 말씀카드의 모든 버튼이 터치를 받는다', () => {
    const blockingRule = css.match(/\.app-shell\.onboarding-open\s*>\s*([^{]+){\s*pointer-events:\s*none;/)?.[1] ?? '';
    expect(blockingRule).toContain(':not(.word-card-modal-backdrop)');
  });

  it('홈 화면과 떠 있는 버튼보다 위에 말씀카드를 표시한다', () => {
    expect(zIndex('.word-card-modal-backdrop')).toBeGreaterThan(zIndex('.onboarding-overlay'));
    expect(zIndex('.word-card-modal-backdrop')).toBeGreaterThan(zIndex('.floating-route-actions'));
  });
});

describe('토스트 색상', () => {
  it('패딩 가장자리에 초록색 강조 띠를 두지 않는다', () => {
    const toastRule = css.match(/\.toast\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(toastRule).not.toContain('border-left: 5px solid #4f7b69');
    expect(toastRule).toContain('border: 1px solid #d7ad55');
  });

  it('일반 토스트와 선물 토스트에 그림자를 사용하지 않는다', () => {
    const toastRule = css.match(/\.toast\s*\{([^}]*)\}/)?.[1] ?? '';
    const giftToastRule = css.match(/\.gift-studio-message\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(toastRule).toContain('box-shadow: none');
    expect(giftToastRule).toContain('box-shadow: none');
  });
});

describe('친구 모달 레이어', () => {
  it('친구 선택 모달은 온보딩 오버레이와 떠 있는 버튼보다 위에 표시한다', () => {
    expect(zIndex('.friend-picker-backdrop')).toBeGreaterThan(zIndex('.onboarding-overlay'));
    expect(zIndex('.friend-picker-backdrop')).toBeGreaterThan(zIndex('.floating-route-actions'));
    expect(zIndex('.friend-picker-backdrop')).toBeGreaterThan(zIndex('.floating-home-button'));
  });

  it('친구 상세와 친구 해제 확인창도 떠 있는 버튼 위에서 터치를 받는다', () => {
    expect(zIndex('.friend-detail-backdrop')).toBeGreaterThan(zIndex('.onboarding-overlay'));
    expect(zIndex('.friend-detail-backdrop')).toBeGreaterThan(zIndex('.floating-route-actions'));
    expect(zIndex('.friend-remove-confirm-backdrop')).toBeGreaterThan(zIndex('.friend-detail-backdrop'));
  });
});

describe('차단 모달 레이어와 모바일 안전 영역', () => {
  it('차단 확인창과 차단 관리 모달을 떠 있는 버튼과 오버레이 위에 표시한다', () => {
    expect(zIndex('.friend-block-confirm-backdrop')).toBeGreaterThan(zIndex('.onboarding-overlay'));
    expect(zIndex('.friend-block-confirm-backdrop')).toBeGreaterThan(zIndex('.floating-route-actions'));
    expect(zIndex('.friend-block-confirm-backdrop')).toBeGreaterThan(zIndex('.friend-detail-backdrop'));
    expect(zIndex('.friend-blocked-backdrop')).toBeGreaterThan(zIndex('.floating-home-button'));
  });

  it('상세·확인·차단 관리 모달이 모바일 화면 밖으로 잘리지 않는다', () => {
    for (const selector of ['.friend-detail-modal', '.friend-block-confirm-modal', '.friend-blocked-modal']) {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const declarations = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
      expect(declarations).toContain('max-height');
      expect(declarations).toContain('dvh');
      expect(declarations).toContain('overflow-y: auto');
    }
  });
});

describe('모든 중앙 모달 정렬', () => {
  it('native dialog의 기본 inset에 밀리지 않도록 양쪽 자동 여백을 강제한다', () => {
    const centeredRule = css.match(/\/\* Center every modal[^]*?([^{}]+)\s*\{\s*margin:\s*auto;/)?.[1] ?? '';
    for (const selector of [
      '.gift-arrival-modal',
      '.continuous-player-modal',
      '.friend-detail-modal',
      '.friend-block-confirm-modal',
      '.friend-blocked-modal',
      '.friend-remove-confirm-modal',
      '.friend-picker-modal',
      '.gift-dialog',
      '.gift-delete-dialog',
      '.gift-thank-you-dialog',
      '.gift-draft-resume-dialog',
      '.gift-send-error-dialog',
      '.completion-modal',
      '.headphone-modal',
      '.word-card-modal',
      '.confirm-retake-dialog',
      '.gift-letter-popup',
    ]) expect(centeredRule).toContain(selector);
  });

  it('아래에서 올라오는 시트는 중앙 모달 정렬 규칙에서 제외한다', () => {
    const centeredRule = css.match(/\/\* Center every modal[^]*?([^{}]+)\s*\{\s*margin:\s*auto;/)?.[1] ?? '';
    expect(centeredRule).not.toContain('.recording-manage-sheet');
    expect(centeredRule).not.toContain('.chapter-menu-sheet');
  });
});
