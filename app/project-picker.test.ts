import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('매일 말씀 읽기 선택 화면', () => {
  it('화면에 처음 들어갈 때 선택된 코스가 없다', () => {
    expect(page).toContain("useState('');");
    expect(page).toContain("setSelectedTemplateId(''); setOnboardingStep('projects')");
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
});
