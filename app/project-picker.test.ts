import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('매일 말씀 읽기 선택 화면', () => {
  it('화면에 처음 들어갈 때 선택된 코스가 없다', () => {
    expect(page).toContain("useState('');");
    expect(page).toContain("setSelectedTemplateId(''); navigateTo('daily-reading')");
  });

  it('코스를 선택한 뒤에만 일정 서브탭을 연다', () => {
    expect(page).toContain("setSelectedTemplateId((current) => current === project.id ? '' : project.id)");
    expect(page).toContain('selectedTemplateId && <aside className="project-schedule-preview selected-schedule-subtab"');
    expect(page).toContain('style={{ gridRow: index * 2 + 1 }}');
    expect(page).toContain('style={{ gridRow: selectedVisibleTemplateIndex * 2 + 2 }}');
  });

  it('기간을 바꾸면 코스 선택을 초기화한다', () => {
    expect(page).toContain("setProjectDuration(7); setSelectedTemplateId('')");
    expect(page).toContain("setProjectDuration(14); setSelectedTemplateId('')");
  });

  it('추천 여정과 나만의 읽기 계획을 독립된 탭으로 제공한다', () => {
    expect(page).toContain('추천 여정');
    expect(page).toContain('나만의 읽기 계획');
    expect(page).toContain("projectPickerMode === 'custom'");
    expect(page).not.toContain('내가 직접 말씀 여정 만들기');
  });

  it('사용자 계획에서 다섯 가지 범위와 직접 정한 기간을 지원한다', () => {
    expect(page).toContain('한 권 읽기');
    expect(page).toContain('여러 권 읽기');
    expect(page).toContain('구약 통독');
    expect(page).toContain('신약 통독');
    expect(page).toContain('성경 통독');
    expect(page).toContain('customDurationDays');
    expect(page).toContain('buildCustomReadingPlan');
  });
});
