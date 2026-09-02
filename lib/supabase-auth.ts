import { env } from 'cloudflare:workers';

type SupabaseEnv = typeof env & {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
};

export type AuthenticatedUser = { id: string; email?: string };

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get('cookie') ?? '';
  for (const part of cookie.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
}

export function readAccessToken(request: Request) {
  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  return bearer || readCookie(request, 'verse-legacy-session');
}

export async function authenticateRequest(request: Request): Promise<AuthenticatedUser | null> {
  const token = readAccessToken(request);
  const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key } = env as SupabaseEnv;
  if (!token || !url || !key) return null;

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const user = (await response.json()) as { id?: string; email?: string };
  return typeof user.id === 'string' ? { id: user.id, email: user.email } : null;
}
