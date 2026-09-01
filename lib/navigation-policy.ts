export type OnboardingStep = 'welcome' | 'projectHome' | 'projects' | 'bible' | 'schedule' | 'cards' | 'app';

export function getBackStep(step: OnboardingStep): OnboardingStep {
  if (step === 'projects') return 'welcome';
  return 'welcome';
}
