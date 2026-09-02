'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { BookOpen, LoaderCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase-browser';

type AuthGateProps = {
  children: (session: Session, signOut: () => Promise<void>) => ReactNode;
};

async function syncServerSession(session: Session | null) {
  await fetch('/api/auth/session', {
    method: session ? 'POST' : 'DELETE',
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
  });
}

export function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      await syncServerSession(data.session);
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      void syncServerSession(nextSession).then(() => {
        if (!active) return;
        setSession(nextSession);
        setLoading(false);
      });
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  const submitEmail = async (event: { preventDefault(): void }) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setSubmitting(false);
    if (result.error) return setMessage(result.error.message);
    if (mode === 'signup' && !result.data.session) setMessage('확인 이메일을 보냈어요. 이메일의 링크를 눌러 가입을 완료해 주세요.');
  };

  const signInWithGoogle = async () => {
    setSubmitting(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) { setMessage(error.message); setSubmitting(false); }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    await syncServerSession(null);
  };

  if (loading) return <main className="auth-shell"><LoaderCircle className="spin" /><p>로그인 정보를 확인하고 있어요.</p></main>;
  if (session) return <>{children(session, signOut)}</>;

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand"><span><BookOpen size={24} /></span><div><strong>말씀유산</strong><small>VERSE LEGACY</small></div></div>
        <div><p className="eyebrow">목소리로 간직하는 말씀</p><h1>{mode === 'login' ? '다시 만나 반가워요' : '말씀 여정을 시작해요'}</h1><p className="muted">로그인하면 어느 기기에서든 내 녹음과 말씀 여정을 이어갈 수 있어요.</p></div>
        <div className="social-login-buttons">
          <button className="google-login-button" type="button" onClick={() => void signInWithGoogle()} disabled={submitting}>Google로 계속하기</button>
        </div>
        <div className="auth-divider"><span>또는 이메일로</span></div>
        <form onSubmit={(event) => void submitEmail(event)}>
          <label><span>이메일</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label><span>비밀번호</span><input type="password" minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <button className="auth-submit" type="submit" disabled={submitting}>{submitting && <LoaderCircle className="spin" size={16} />}{mode === 'login' ? '로그인' : '회원가입'}</button>
        </form>
        {message && <output className="auth-message">{message}</output>}
        <button className="auth-mode-button" type="button" onClick={() => { setMode((current) => current === 'login' ? 'signup' : 'login'); setMessage(''); }}>{mode === 'login' ? '처음이신가요? 회원가입' : '이미 계정이 있나요? 로그인'}</button>
      </section>
    </main>
  );
}
