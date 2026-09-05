import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const panel = readFileSync(new URL('./gifts-panel.tsx', import.meta.url), 'utf8');
const modal = readFileSync(new URL('./gift-arrival-modal.tsx', import.meta.url), 'utf8');

describe('앱 전역 말씀 선물 도착 경험', () => {
  it('앱 시작·포커스 복귀·15초 주기로 전용 도착 API를 확인한다', () => {
    expect(page).toContain("fetch('/api/gifts/arrivals')");
    expect(page).toContain('window.setInterval(() => void pollGiftArrivals(), 15_000)');
    expect(page).toContain("window.addEventListener('focus', handleFocus)");
    expect(page).toContain("document.addEventListener('visibilitychange', handleVisibility)");
  });

  it('일반 녹음 화면과 선물 녹음 플로우에서는 도착 모달을 보류한다', () => {
    expect(page).toContain("onboardingStep === 'giftStudio'");
    expect(page).toContain("onboardingStep === 'app' && appTab === 'recording'");
    expect(page).toContain('canShowGiftArrival(giftArrivals, giftArrivalBlocked)');
  });

  it('여러 선물은 한 모달로 묶고 명확한 선물 CTA를 제공한다', () => {
    expect(modal).toContain('새로운 말씀 선물이 도착했어요');
    expect(modal).toContain("multiple ? '선물함에서 확인하기' : '선물 열어보기'");
    expect(modal).toContain('describeGiftArrivals(arrivals)');
  });

  it('단일 선물 CTA는 받은 선물함에서 해당 선물을 바로 연다', () => {
    expect(page).toContain('initialReceivedGiftId={selectedReceivedGiftId}');
    expect(page).toContain("fetch(`/api/gifts/${arrivals[0].id}/open`, { method: 'PATCH' })");
    expect(panel).toContain('initialReceivedGiftId');
    expect(panel).toContain('setJustOpenedGiftId(initialGift.id)');
    expect(panel).toContain('initialGift.hasLetter');
    expect(panel).toContain('setLetterPopupGiftId(initialGift.id)');
  });
});
