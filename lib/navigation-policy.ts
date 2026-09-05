export type OnboardingStep = 'welcome' | 'projectHome' | 'projects' | 'bible' | 'schedule' | 'cards' | 'giftStudio' | 'app';

export type NavigationRoute =
  | 'home'
  | 'journeys'
  | 'daily-reading'
  | 'bible'
  | 'schedule'
  | 'cards'
  | 'gift-studio'
  | 'recording'
  | 'library'
  | 'gifts'
  | 'friends';

const navigationRoutes = new Set<NavigationRoute>([
  'home',
  'journeys',
  'daily-reading',
  'bible',
  'schedule',
  'cards',
  'gift-studio',
  'recording',
  'library',
  'gifts',
  'friends',
]);

export function getNavigationHash(route: NavigationRoute) {
  return `#${route}`;
}

export function parseNavigationRoute(hash: string): NavigationRoute {
  const candidate = hash.replace(/^#/, '') as NavigationRoute;
  return navigationRoutes.has(candidate) ? candidate : 'home';
}

export function getBackStep(step: OnboardingStep): OnboardingStep {
  if (step === 'projects') return 'welcome';
  return 'welcome';
}
