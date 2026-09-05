'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ban, Check, ChevronLeft, ChevronRight, Gift, LoaderCircle, Mail, Search, ShieldOff, TriangleAlert, UserCheck, UserPlus, Users, X } from 'lucide-react';
import { BLOCK_CONSEQUENCES } from '@/lib/friend-block';

type Relationship = 'none' | 'friend' | 'incoming' | 'outgoing' | 'blocked';

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
  blocked: FriendPerson[];
  results: FriendPerson[];
};

const emptyPayload: FriendsPayload = { profile: null, friends: [], incoming: [], outgoing: [], blocked: [], results: [] };

async function requestFriends(url = '/api/friends', init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json() as FriendsPayload & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? '친구 정보를 불러오지 못했어요.');
  return payload;
}

export function FriendsPanel({ onBack, onNotice, onGiftFriend }: {
  onBack: () => void;
  onNotice?: (message: string) => void;
  onGiftFriend?: (friend: FriendPerson) => void;
}) {
  const [data, setData] = useState<FriendsPayload>(emptyPayload);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [nickname, setNickname] = useState('');
  const [profileError, setProfileError] = useState('');
  const [editingNickname, setEditingNickname] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ userId: string; message: string } | null>(null);
  const [detailFriend, setDetailFriend] = useState<FriendPerson | null>(null);
  const [removeCandidate, setRemoveCandidate] = useState<FriendPerson | null>(null);
  const [blockCandidate, setBlockCandidate] = useState<FriendPerson | null>(null);
  const [blockedListOpen, setBlockedListOpen] = useState(false);

  const notify = (message: string) => onNotice?.(message);

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
      .catch((error: Error) => active && setLoadError(error.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const searchFriends = useCallback(async (event?: { preventDefault(): void }) => {
    event?.preventDefault();
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setSearchError('이메일 또는 닉네임을 2자 이상 입력해 주세요.');
      setSearched(false);
      return;
    }
    setSearching(true);
    setSearchError('');
    try {
      const payload = await requestFriends(`/api/friends?q=${encodeURIComponent(normalizedQuery)}`);
      setData(payload);
      setSearched(true);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : '친구를 검색하지 못했어요.');
    } finally {
      setSearching(false);
    }
  }, [query]);

  useEffect(() => {
    if (!query.trim()) return;
    const timer = window.setTimeout(() => void searchFriends(), 300);
    return () => clearTimeout(timer);
  }, [query, searchFriends]);

  const saveNickname = async () => {
    setBusyUserId('profile');
    setProfileError('');
    try {
      await requestFriends('/api/friends', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname }),
      });
      await refresh();
      setEditingNickname(false);
      notify('닉네임을 저장했어요.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : '닉네임을 저장하지 못했어요.');
    } finally {
      setBusyUserId(null);
    }
  };

  const runAction = async (action: 'request' | 'accept' | 'reject' | 'remove' | 'block' | 'unblock', person: FriendPerson) => {
    setBusyUserId(person.userId);
    setActionError(null);
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
      if (action === 'request') notify('친구 요청을 보냈어요.');
      else if (action === 'accept') notify('친구가 되었어요.');
      else if (action === 'reject') notify('요청을 거절했어요.');
      else if (action === 'block') notify('친구를 차단했어요.');
      else if (action === 'unblock') notify('차단을 해제했어요.');
      else notify('친구 관계를 해제했어요.');
      return true;
    } catch (error) {
      setActionError({ userId: person.userId, message: error instanceof Error ? error.message : '친구 요청을 처리하지 못했어요.' });
      return false;
    } finally {
      setBusyUserId(null);
    }
  };

  const confirmRemoveFriend = async () => {
    if (!removeCandidate) return;
    const removed = await runAction('remove', removeCandidate);
    if (!removed) return;
    setRemoveCandidate(null);
    setDetailFriend(null);
  };

  const confirmBlockFriend = async () => {
    if (!blockCandidate) return;
    const blocked = await runAction('block', blockCandidate);
    if (!blocked) return;
    setBlockCandidate(null);
    setDetailFriend(null);
  };

  const rowError = (person: FriendPerson) => actionError?.userId === person.userId
    ? <output className="friend-row-error" aria-live="polite">{actionError.message}</output>
    : null;

  const searchAction = (person: FriendPerson) => {
    const busy = busyUserId === person.userId;
    if (person.relationship === 'friend') return <span className="friend-status connected"><UserCheck size={14} /> 친구</span>;
    if (person.relationship === 'outgoing') return <span className="friend-status"><Check size={14} /> 수락 대기</span>;
    if (person.relationship === 'incoming') {
      return (
        <span className="friend-request-actions">
          <button type="button" disabled={busy} onClick={() => void runAction('accept', person)}>{busy ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />} 수락</button>
          <button className="subtle" type="button" disabled={busy} onClick={() => void runAction('reject', person)}><X size={14} /> 거절</button>
        </span>
      );
    }
    return <button className="friend-request-button" type="button" disabled={busy} onClick={() => void runAction('request', person)}>{busy ? <LoaderCircle className="spin" size={14} /> : <UserPlus size={14} />} 친구 요청</button>;
  };

  return (
    <section className="friends-section friends-screen" aria-labelledby="friends-title">
      <button className="section-route-back" type="button" onClick={onBack}><ChevronLeft size={17} /> 뒤로가기</button>

      <div className="friends-heading">
        <h2 id="friends-title">친구</h2>
        <span className="friend-count"><Users size={14} /> {data.friends.length}명</span>
      </div>

      <div className="friend-me-row">
        <span className="friend-row-avatar me" aria-hidden="true">{(data.profile?.nickname || '말').slice(0, 1)}</span>
        <div className="friend-row-body">
          {editingNickname ? (
            <input
              aria-label="내 닉네임"
              value={nickname}
              maxLength={20}
              aria-invalid={Boolean(profileError)}
              aria-describedby={profileError ? 'friend-profile-error' : undefined}
              onChange={(event) => { setNickname(event.target.value); setProfileError(''); }}
            />
          ) : <strong className="friend-row-name">{data.profile?.nickname ?? '닉네임 없음'}</strong>}
          <small className="friend-row-mail">{data.profile?.email ?? '내 계정'}</small>
          {profileError && <output id="friend-profile-error" className="friend-profile-error" aria-live="polite">{profileError}</output>}
        </div>
        {editingNickname ? (
          <span className="friend-me-actions">
            <button type="button" disabled={busyUserId === 'profile'} onClick={() => void saveNickname()}>{busyUserId === 'profile' ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />} 저장</button>
            <button className="subtle" type="button" disabled={busyUserId === 'profile'} onClick={() => { setNickname(data.profile?.nickname ?? ''); setProfileError(''); setEditingNickname(false); }}>취소</button>
          </span>
        ) : <button className="subtle" type="button" onClick={() => { setProfileError(''); setEditingNickname(true); }}>이름 수정</button>}
      </div>

      <form className="friend-search" onSubmit={(event) => void searchFriends(event)}>
        <label htmlFor="friend-query">
          {searching ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />}
          <input
            id="friend-query"
            type="search"
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              setSearchError('');
              if (!nextQuery.trim()) setSearched(false);
            }}
            placeholder="이메일 또는 닉네임"
            autoComplete="off"
            aria-invalid={Boolean(searchError)}
            aria-describedby={searchError ? 'friend-search-error' : undefined}
          />
        </label>
        {searchError && <output id="friend-search-error" className="friend-search-error" aria-live="polite">{searchError}</output>}
      </form>

      {data.incoming.length > 0 && (
        <section className="friend-request-strip" aria-label="받은 친구 요청">
          <p className="friend-strip-title">받은 요청 <span>{data.incoming.length}</span></p>
          {data.incoming.map((person) => (
            <div className="friend-row static" key={person.userId}>
              <span className="friend-row-avatar" aria-hidden="true">{person.nickname.slice(0, 1)}</span>
              <span className="friend-row-body">
                <strong className="friend-row-name">{person.nickname}</strong>
                <small className="friend-row-mail"><Mail size={11} /> {person.emailHint}</small>
                {rowError(person)}
              </span>
              <span className="friend-request-actions">
                <button type="button" disabled={busyUserId === person.userId} onClick={() => void runAction('accept', person)}>{busyUserId === person.userId ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />} 수락</button>
                <button className="subtle" type="button" disabled={busyUserId === person.userId} onClick={() => void runAction('reject', person)}><X size={14} /> 거절</button>
              </span>
            </div>
          ))}
        </section>
      )}

      {searched && (
        <section className="friend-result-strip" aria-label="검색 결과">
          <p className="friend-strip-title">검색 결과 <span>{data.results.length}</span></p>
          {data.results.length ? (
            <div className="friend-compact-list">
              {data.results.map((person) => (
                <div className="friend-row static" key={person.userId}>
                  <span className="friend-row-avatar" aria-hidden="true">{person.nickname.slice(0, 1)}</span>
                  <span className="friend-row-body">
                    <strong className="friend-row-name">{person.nickname}</strong>
                    <small className="friend-row-mail"><Mail size={11} /> {person.emailHint}</small>
                    {rowError(person)}
                  </span>
                  {searchAction(person)}
                </div>
              ))}
            </div>
          ) : <p className="friend-inline-empty"><Search size={15} /> 일치하는 사용자가 없어요. 이메일은 전체 주소를 정확히 입력해 주세요.</p>}
        </section>
      )}

      <div className="friend-list-heading"><h3>내 친구</h3><span>{data.friends.length}</span></div>
      {loading ? (
        <div className="friends-loading"><LoaderCircle className="spin" size={26} /><strong>친구 목록을 불러오고 있어요</strong></div>
      ) : loadError ? (
        <output className="friend-load-error" aria-live="polite"><TriangleAlert size={16} /> {loadError}</output>
      ) : data.friends.length ? (
        <div className="friend-compact-list">
          {data.friends.map((person) => (
            <button className="friend-row" type="button" onClick={() => setDetailFriend(person)} key={person.userId}>
              <span className="friend-row-avatar" aria-hidden="true">{person.nickname.slice(0, 1)}</span>
              <span className="friend-row-body">
                <strong className="friend-row-name">{person.nickname}</strong>
                <small className="friend-row-mail">{person.emailHint}</small>
              </span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : (
        <div className="friend-empty"><Users size={26} /><strong>아직 추가한 친구가 없어요</strong><p>위 검색창에서 첫 친구를 찾아보세요.</p></div>
      )}

      {data.outgoing.length > 0 && (
        <section className="friend-request-strip pending" aria-label="보낸 친구 요청">
          <p className="friend-strip-title">보낸 요청 <span>{data.outgoing.length}</span></p>
          {data.outgoing.map((person) => (
            <div className="friend-row static" key={person.userId}>
              <span className="friend-row-avatar" aria-hidden="true">{person.nickname.slice(0, 1)}</span>
              <span className="friend-row-body">
                <strong className="friend-row-name">{person.nickname}</strong>
                <small className="friend-row-mail"><Mail size={11} /> {person.emailHint}</small>
              </span>
              <span className="friend-status"><Check size={14} /> 수락 대기</span>
            </div>
          ))}
        </section>
      )}

      <button className="friend-blocked-entry" type="button" onClick={() => setBlockedListOpen(true)}>
        <ShieldOff size={13} /> 차단한 친구 관리{data.blocked.length ? ` (${data.blocked.length})` : ''}
      </button>

      {detailFriend && (
        <div className="friend-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailFriend(null); }}>
          <dialog className="friend-detail-modal" open aria-labelledby="friend-detail-title">
            <button className="friend-detail-close" type="button" onClick={() => setDetailFriend(null)} aria-label="친구 정보 닫기"><X size={19} /></button>
            <span className="friend-row-avatar large" aria-hidden="true">{detailFriend.nickname.slice(0, 1)}</span>
            <h3 id="friend-detail-title">{detailFriend.nickname}</h3>
            <p className="friend-detail-mail"><Mail size={13} /> {detailFriend.emailHint}</p>
            {actionError?.userId === detailFriend.userId && <output className="friend-row-error" aria-live="polite">{actionError.message}</output>}
            <div className="friend-detail-actions">
              <button className="friend-detail-gift" type="button" onClick={() => { setDetailFriend(null); onGiftFriend?.(detailFriend); }}>
                <Gift size={16} /> 선물하기
              </button>
              <button className="friend-detail-block" type="button" onClick={() => setBlockCandidate(detailFriend)}>
                <Ban size={15} /> 차단하기
              </button>
            </div>
            <div className="friend-detail-secondary">
              <button type="button" onClick={() => setRemoveCandidate(detailFriend)}>친구 해제</button>
            </div>
          </dialog>
        </div>
      )}

      {removeCandidate && (
        <div className="friend-remove-confirm-backdrop" role="presentation">
          <dialog className="friend-remove-confirm-modal" open aria-labelledby="friend-remove-title">
            <h3 id="friend-remove-title">{removeCandidate.nickname}님과 친구를 해제할까요?</h3>
            <p>해제하면 서로의 친구 목록에서 사라지고, 더는 말씀 선물을 주고받을 수 없어요. 다시 친구 요청을 보내면 이어갈 수 있어요.</p>
            <div className="friend-remove-confirm-actions">
              <button type="button" disabled={busyUserId === removeCandidate.userId} onClick={() => setRemoveCandidate(null)}>취소</button>
              <button className="danger" type="button" disabled={busyUserId === removeCandidate.userId} onClick={() => void confirmRemoveFriend()}>
                {busyUserId === removeCandidate.userId ? <LoaderCircle className="spin" size={14} /> : <X size={14} />} 친구 해제
              </button>
            </div>
          </dialog>
        </div>
      )}

      {blockCandidate && (
        <div className="friend-block-confirm-backdrop" role="presentation">
          <dialog className="friend-block-confirm-modal" open aria-labelledby="friend-block-title">
            <span className="friend-block-icon" aria-hidden="true"><Ban size={22} /></span>
            <h3 id="friend-block-title">{blockCandidate.nickname}님을 차단할까요?</h3>
            <ul className="friend-block-consequences">
              {BLOCK_CONSEQUENCES.map((line) => <li key={line}>{line}</li>)}
            </ul>
            {actionError?.userId === blockCandidate.userId && <output className="friend-row-error" aria-live="polite">{actionError.message}</output>}
            <div className="friend-remove-confirm-actions">
              <button type="button" disabled={busyUserId === blockCandidate.userId} onClick={() => setBlockCandidate(null)}>취소</button>
              <button className="danger" type="button" disabled={busyUserId === blockCandidate.userId} onClick={() => void confirmBlockFriend()}>
                {busyUserId === blockCandidate.userId ? <LoaderCircle className="spin" size={14} /> : <Ban size={14} />} 차단하기
              </button>
            </div>
          </dialog>
        </div>
      )}

      {blockedListOpen && (
        <div className="friend-blocked-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setBlockedListOpen(false); }}>
          <dialog className="friend-blocked-modal" open aria-labelledby="friend-blocked-title">
            <button className="friend-detail-close" type="button" onClick={() => setBlockedListOpen(false)} aria-label="차단 목록 닫기"><X size={19} /></button>
            <h3 id="friend-blocked-title">차단한 친구</h3>
            <p className="friend-blocked-note">차단을 해제해도 친구 관계는 돌아오지 않아요. 다시 친구 요청을 보내야 친구가 될 수 있어요.</p>
            {data.blocked.length ? (
              <div className="friend-compact-list">
                {data.blocked.map((person) => (
                  <div className="friend-row static" key={person.userId}>
                    <span className="friend-row-avatar" aria-hidden="true">{person.nickname.slice(0, 1)}</span>
                    <span className="friend-row-body">
                      <strong className="friend-row-name">{person.nickname}</strong>
                      <small className="friend-row-mail"><Mail size={11} /> {person.emailHint}</small>
                      {rowError(person)}
                    </span>
                    <button className="friend-unblock-button" type="button" disabled={busyUserId === person.userId} onClick={() => void runAction('unblock', person)}>
                      {busyUserId === person.userId ? <LoaderCircle className="spin" size={14} /> : <ShieldOff size={14} />} 차단 해제
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="friend-empty"><ShieldOff size={24} /><strong>차단한 친구가 없어요</strong><p>차단하면 여기에서 다시 확인할 수 있어요.</p></div>
            )}
          </dialog>
        </div>
      )}
    </section>
  );
}
