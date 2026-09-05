import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const gate = readFileSync(new URL('./auth-gate.tsx', import.meta.url), 'utf8');
const recordingsRoute = readFileSync(new URL('./api/recordings/route.ts', import.meta.url), 'utf8');
const audioRoute = readFileSync(new URL('./api/recordings/[id]/audio/route.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');
const browserAuth = readFileSync(new URL('../lib/supabase-browser.ts', import.meta.url), 'utf8');
const serverAuth = readFileSync(new URL('../lib/supabase-auth.ts', import.meta.url), 'utf8');

describe('Supabase account authentication', () => {
  it('offers email and Google sign-in without Kakao or Apple sign-in', () => {
    expect(gate).toContain("signInWithPassword");
    expect(gate).toContain("signUp({ email, password })");
    expect(gate).toContain("provider: 'google'");
    expect(gate).not.toContain("provider: 'kakao'");
    expect(gate).not.toContain('카카오로 계속하기');
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

  it('uses Sites simulated identity locally when Supabase browser settings are absent', () => {
    expect(browserAuth).not.toContain("throw new Error('Supabase 브라우저 설정이 없습니다.')");
    expect(gate).toContain('/signin-with-chatgpt?return_to=/');
    expect(gate).toContain("fetch('/api/auth/session')");
  });

  it('accepts only platform-authenticated Sites headers as the server fallback', () => {
    expect(serverAuth).toContain("request.headers.get('oai-authenticated-user-id')");
    expect(serverAuth).toContain("request.headers.get('oai-authenticated-user-email')");
  });

  it('prefers a verified Supabase session over the local Sites fallback identity', () => {
    const tokenLookup = serverAuth.indexOf('const token = readAccessToken(request)');
    const sitesLookup = serverAuth.indexOf("const sitesUserId = request.headers.get('oai-authenticated-user-id')");
    expect(tokenLookup).toBeGreaterThan(-1);
    expect(sitesLookup).toBeGreaterThan(tokenLookup);
    expect(serverAuth).toContain('if (token) return null');
  });
});
