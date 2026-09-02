'use client';

import { useEffect, useState } from 'react';
import { Check, LoaderCircle, Mail, Search, UserCheck, UserPlus, Users, X } from 'lucide-react';

type Relationship = 'none' | 'friend' | 'incoming' | 'outgoing';

type FriendPerson = {
  userId: string;
  nickname: string;
  emailHint: string;
  relationship: Relationship;
};

type FriendsPayload = {
  profile: { nickname: string; email: string } | null;
  friends: FriendPerson[];
  incoming: FriendPerson[];
  outgoing: FriendPerson[];
  results: FriendPerson[];
};

const emptyPayload: FriendsPayload = { profile: null, friends: [], incoming: [], outgoing: [], results: [] };

async function requestFriends(url = '/api/friends', init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json() as FriendsPayload & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? '친구 정보를 불러오지 못했어요.');
  return payload;
}

export function FriendsPanel() {
  const [data, setData] = useState<FriendsPayload>(emptyPayload);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [nickname, setNickname] = useState('');
  const [editingNickname, setEditingNickname] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const refresh = async () => {
    const payload = await requestFriends();
    setData(payload);
    setNickname(payload.profile?.nickname ?? '');
    return payload;
  };

  useEffect(() => {
    let active = true;
    void requestFriends()
      .then((payload) => {
        if (!active) return;
        setData(payload);
        setNickname(payload.profile?.nickname ?? '');
      })
      .catch((error: Error) => active && setMessage(error.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const searchFriends = async (event?: { preventDefault(): void }) => {
    event?.preventDefault();
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setMessage('이메일 또는 닉네임을 2자 이상 입력해 주세요.');
      return;
    }
    setSearching(true);
    setMessage('');
    try {
      const payload = await requestFriends(`/api/friends?q=${encodeURIComponent(normalizedQuery)}`);
      setData(payload);
      setSearched(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '친구를 검색하지 못했어요.');
    } finally {
      setSearching(false);
    }
  };

  const saveNickname = async () => {
    setBusyUserId('profile');
    setMessage('');
    try {
      await requestFriends('/api/friends', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname }),
      });
      await refresh();
      setEditingNickname(false);
      setMessage('닉네임을 저장했어요.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '닉네임을 저장하지 못했어요.');
    } finally {
      setBusyUserId(null);
    }
  };

  const runAction = async (action: 'request' | 'accept' | 'reject' | 'remove', person: FriendPerson) => {
    setBusyUserId(person.userId);
    setMessage('');
    try {
      await requestFriends('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId: person.userId }),
      });
      await refresh();
      if (searched && query.trim().length >= 2) {
        const payload = await requestFriends(`/api/friends?q=${encodeURIComponent(query.trim())}`);
        setData(payload);
      }
      setMessage(action === 'request' ? '친구 요청을 보냈어요.' : action === 'accept' ? '친구가 되었어요.' : action === 'reject' ? '요청을 거절했어요.' : '친구 관계를 해제했어요.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '친구 요청을 처리하지 못했어요.');
    } finally {
      setBusyUserId(null);
    }
  };

  const actionFor = (person: FriendPerson) => {
    const busy = busyUserId === person.userId;
    if (person.relationship === 'friend') return <span className="friend-status connected"><UserCheck size={14} /> 친구</span>;
    if (person.relationship === 'outgoing') return <span className="friend-status"><Check size={14} /> 요청 보냄</span>;
    if (person.relationship === 'incoming') return <div className="friend-inline-actions"><button type="button" disabled={busy} onClick={() => void runAction('accept', person)}>{busy ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />} 수락</button><button className="subtle" type="button" disabled={busy} onClick={() => void runAction('reject', person)}><X size={14} /> 거절</button></div>;
    return <button type="button" disabled={busy} onClick={() => void runAction('request', person)}>{busy ? <LoaderCircle className="spin" size={14} /> : <UserPlus size={14} />} 친구 요청</button>;
  };

  if (loading) return <section className="friends-section"><div className="friends-loading"><LoaderCircle className="spin" size={28} /><strong>친구 목록을 불러오고 있어요</strong></div></section>;

  return (
    <section className="friends-section" aria-labelledby="friends-title">
      <div className="friends-heading">
        <div><p className="eyebrow">함께 간직하는 말씀</p><h2 id="friends-title">친구</h2><p className="muted">이메일이나 닉네임으로 찾아 친구 요청을 보내세요.</p></div>
        <span><Users size={16} /> {data.friends.length}명</span>
      </div>

      <div className="friend-profile-card">
        <div className="friend-avatar">{(data.profile?.nickname || '말').slice(0, 1)}</div>
        <div><small>내 친구 검색 이름</small>{editingNickname ? <input aria-label="내 닉네임" value={nickname} maxLength={20} onChange={(event) => setNickname(event.target.value)} /> : <strong>{data.profile?.nickname ?? '닉네임 없음'}</strong>}<span>{data.profile?.email}</span></div>
        {editingNickname ? <div className="friend-profile-actions"><button type="button" disabled={busyUserId === 'profile'} onClick={() => void saveNickname()}>{busyUserId === 'profile' ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />} 저장</button><button className="subtle" type="button" disabled={busyUserId === 'profile'} onClick={() => { setNickname(data.profile?.nickname ?? ''); setEditingNickname(false); }}>취소</button></div> : <button type="button" onClick={() => setEditingNickname(true)}>닉네임 수정</button>}
      </div>

      <form className="friend-search" onSubmit={(event) => void searchFriends(event)}>
        <label htmlFor="friend-query"><Search size={18} /><input id="friend-query" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이메일 또는 닉네임" autoComplete="off" /></label>
        <button type="submit" disabled={searching}>{searching ? <LoaderCircle className="spin" size={17} /> : <Search size={17} />} 찾기</button>
      </form>
      {message && <output className="friend-message" aria-live="polite">{message}</output>}

      {data.incoming.length > 0 && <div className="friend-group request-group"><div className="friend-group-title"><div><small>FRIEND REQUESTS</small><h3>받은 요청</h3></div><span>{data.incoming.length}</span></div><div className="friend-list">{data.incoming.map((person) => <article key={person.userId}><div className="friend-avatar small">{person.nickname.slice(0, 1)}</div><div><strong>{person.nickname}</strong><small><Mail size={11} /> {person.emailHint}</small></div>{actionFor(person)}</article>)}</div></div>}

      {searched && <div className="friend-group"><div className="friend-group-title"><div><small>SEARCH RESULTS</small><h3>검색 결과</h3></div><span>{data.results.length}</span></div>{data.results.length ? <div className="friend-list">{data.results.map((person) => <article key={person.userId}><div className="friend-avatar small">{person.nickname.slice(0, 1)}</div><div><strong>{person.nickname}</strong><small><Mail size={11} /> {person.emailHint}</small></div>{actionFor(person)}</article>)}</div> : <div className="friend-empty"><Search size={24} /><strong>일치하는 사용자가 없어요</strong><p>이메일은 전체 주소를 정확히 입력해 주세요.</p></div>}</div>}

      <div className="friend-group"><div className="friend-group-title"><div><small>MY FRIENDS</small><h3>내 친구</h3></div><span>{data.friends.length}</span></div>{data.friends.length ? <div className="friend-list">{data.friends.map((person) => <article key={person.userId}><div className="friend-avatar small">{person.nickname.slice(0, 1)}</div><div><strong>{person.nickname}</strong><small><Mail size={11} /> {person.emailHint}</small></div><button className="subtle" type="button" disabled={busyUserId === person.userId} onClick={() => void runAction('remove', person)}>{busyUserId === person.userId ? <LoaderCircle className="spin" size={14} /> : <X size={14} />} 친구 해제</button></article>)}</div> : <div className="friend-empty"><Users size={26} /><strong>아직 추가한 친구가 없어요</strong><p>위 검색창에서 첫 친구를 찾아보세요.</p></div>}</div>

      {data.outgoing.length > 0 && <div className="friend-group compact"><div className="friend-group-title"><div><small>PENDING</small><h3>보낸 요청</h3></div><span>{data.outgoing.length}</span></div><div className="friend-list">{data.outgoing.map((person) => <article key={person.userId}><div className="friend-avatar small">{person.nickname.slice(0, 1)}</div><div><strong>{person.nickname}</strong><small><Mail size={11} /> {person.emailHint}</small></div><span className="friend-status"><Check size={14} /> 수락 대기</span></article>)}</div></div>}
    </section>
  );
}
