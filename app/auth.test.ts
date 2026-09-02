import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const gate = readFileSync(new URL('./auth-gate.tsx', import.meta.url), 'utf8');
const recordingsRoute = readFileSync(new URL('./api/recordings/route.ts', import.meta.url), 'utf8');
const audioRoute = readFileSync(new URL('./api/recordings/[id]/audio/route.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

describe('Supabase account authentication', () => {
  it('offers email, Google, and Kakao sign-in but not Apple sign-in', () => {
    expect(gate).toContain("signInWithPassword");
    expect(gate).toContain("signUp({ email, password })");
    expect(gate).toContain("signInWithSocial('google')");
    expect(gate).toContain("'google' | 'kakao'");
    expect(gate).toContain("signInWithSocial('kakao')");
    expect(gate).not.toContain("provider: 'apple'");
  });

  it('synchronizes the Supabase access token into an HttpOnly server session', () => {
    expect(gate).toContain("fetch('/api/auth/session'");
    expect(gate).toContain('session.access_token');
  });

  it('isolates browser journey state when the signed-in account changes', () => {
    expect(page).toContain("window.localStorage.getItem('verse-legacy-active-user') !== userId");
    expect(page).toContain("window.localStorage.setItem('verse-legacy-active-user', userId)");
  });

  it('derives recording ownership only from verified Supabase authentication', () => {
    expect(recordingsRoute).toContain('await authenticateRequest(request)');
    expect(audioRoute.match(/await authenticateRequest\(request\)/g)).toHaveLength(3);
    expect(recordingsRoute).not.toContain("request.headers.get(OWNER_HEADER)");
    expect(audioRoute).not.toContain("searchParams.get('owner')");
  });

  it('keeps the sign-up heading on one line on narrow phones', () => {
    expect(styles).toContain('.auth-card h1');
    expect(styles).toContain('white-space: nowrap');
    expect(styles).toContain('@media (max-width: 420px)');
  });
});
