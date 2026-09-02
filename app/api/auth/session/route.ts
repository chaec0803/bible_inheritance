import { authenticateRequest, readAccessToken } from '@/lib/supabase-auth';
import { ensureUserProfile } from '@/lib/friend-server';

const COOKIE = 'verse-legacy-session';

export async function POST(request: Request) {
  const token = readAccessToken(request);
  const user = await authenticateRequest(request);
  if (!token || !user) return Response.json({ error: '로그인 세션이 올바르지 않습니다.' }, { status: 401 });
  await ensureUserProfile(user);

  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return Response.json(
    { user },
    {
      headers: {
        'Set-Cookie': `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=3600`,
      },
    },
  );
}

export async function DELETE(request: Request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=0` },
  });
}
