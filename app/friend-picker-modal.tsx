'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, LoaderCircle, Search, Users, X } from 'lucide-react';

export type FriendPickerPerson = { userId: string; nickname: string; emailHint: string };

type SearchPerson = FriendPickerPerson & { relationship: 'none' | 'friend' | 'incoming' | 'outgoing' };

type FriendsPayload = {
  friends?: FriendPickerPerson[];
  results?: SearchPerson[];
  error?: string;
};

type FriendPickerModalProps = {
  title?: string;
  description?: string;
  confirmLabel?: string;
  initialSelectedUserId?: string | null;
  initialSelectedFriends?: FriendPickerPerson[];
  multiple?: boolean;
  onCancel: () => void;
  onSelect: (friend: FriendPickerPerson) => void;
  onSelectMany?: (friends: FriendPickerPerson[]) => void;
};

async function readFriends(url: string) {
  const response = await fetch(url);
  const payload = await response.json() as FriendsPayload;
  if (!response.ok) throw new Error(payload.error ?? '친구 목록을 불러오지 못했어요.');
  return payload;
}

export function FriendPickerModal({
  title = '누구에게 선물할까요?',
  description = '친구 한 명을 선택해 주세요.',
  confirmLabel = '이 친구 선택',
  initialSelectedUserId = null,
  initialSelectedFriends = [],
  multiple = false,
  onCancel,
  onSelect,
  onSelectMany,
}: FriendPickerModalProps) {
  const [friends, setFriends] = useState<FriendPickerPerson[]>([]);
  const [results, setResults] = useState<FriendPickerPerson[]>([]);
  const [selectedUserId, setSelectedUserId] = useState(initialSelectedUserId ?? '');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(initialSelectedFriends.map((friend) => friend.userId));
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    void readFriends('/api/friends')
      .then((payload) => active && setFriends(payload.friends ?? []))
      .catch((error: Error) => active && setLoadError(error.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const runSearch = useCallback(async (event?: { preventDefault(): void }) => {
    event?.preventDefault();
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setSearched(false);
      setResults([]);
      setSearchError('');
      return;
    }
    if (normalizedQuery.length < 2) {
      setSearchError('이메일 또는 닉네임을 2자 이상 입력해 주세요.');
      setSearched(false);
      return;
    }
    setSearching(true);
    setSearchError('');
    try {
      const payload = await readFriends(`/api/friends?q=${encodeURIComponent(normalizedQuery)}`);
      setResults((payload.results ?? []).filter((person) => person.relationship === 'friend'));
      setSearched(true);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : '친구를 검색하지 못했어요.');
    } finally {
      setSearching(false);
    }
  }, [query]);

  useEffect(() => {
    if (!query.trim()) return;
    const timer = window.setTimeout(() => void runSearch(), 300);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  const selected = [...friends, ...results].find((person) => person.userId === selectedUserId) ?? null;
  const people = [...initialSelectedFriends, ...friends, ...results].filter((person, index, all) => all.findIndex((candidate) => candidate.userId === person.userId) === index);
  const selectedFriends = selectedUserIds.map((id) => people.find((person) => person.userId === id)).filter((person): person is FriendPickerPerson => Boolean(person));

  const renderRow = (person: FriendPickerPerson) => (
    <button
      className={`friend-picker-row ${(multiple ? selectedUserIds.includes(person.userId) : person.userId === selectedUserId) ? 'selected' : ''}`}
      type="button"
      aria-pressed={multiple ? selectedUserIds.includes(person.userId) : person.userId === selectedUserId}
      onClick={() => multiple ? setSelectedUserIds((current) => current.includes(person.userId) ? current.filter((id) => id !== person.userId) : current.length < 30 ? [...current, person.userId] : current) : setSelectedUserId((current) => current === person.userId ? '' : person.userId)}
      key={person.userId}
    >
      <span className="friend-row-avatar" aria-hidden="true">{person.nickname.slice(0, 1)}</span>
      <span className="friend-row-body">
        <strong className="friend-row-name">{person.nickname}</strong>
        <small className="friend-row-mail">{person.emailHint}</small>
      </span>
      {(multiple ? selectedUserIds.includes(person.userId) : person.userId === selectedUserId) && <Check size={17} aria-label="선택함" />}
    </button>
  );

  return (
    <div
      className="friend-picker-backdrop"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}
    >
      <dialog className="friend-picker-modal" open aria-labelledby="friend-picker-title">
        <button className="friend-picker-close" type="button" onClick={onCancel} aria-label="친구 선택 닫기"><X size={20} /></button>
        <p className="eyebrow">SELECT A FRIEND</p>
        <h2 id="friend-picker-title">{title}</h2>
        <p className="friend-picker-description">{description}</p>
        {multiple && selectedFriends.length > 0 && <div className="friend-picker-selected" aria-label={`선택한 친구 ${selectedFriends.length}명`}><strong>선택 {selectedFriends.length}/30</strong><div>{selectedFriends.map((friend) => <button type="button" onClick={() => setSelectedUserIds((current) => current.filter((id) => id !== friend.userId))} key={friend.userId}><span>{friend.nickname.slice(0, 1)}</span>{friend.nickname}<X size={13} /></button>)}</div></div>}

        <form className="friend-picker-search" onSubmit={(event) => void runSearch(event)}>
          <label htmlFor="friend-picker-query">
            {searching ? <LoaderCircle className="spin" size={17} /> : <Search size={17} />}
            <input
              id="friend-picker-query"
              type="search"
              value={query}
              placeholder="이메일 또는 닉네임"
              autoComplete="off"
              aria-invalid={Boolean(searchError)}
              aria-describedby={searchError ? 'friend-picker-search-error' : undefined}
              onChange={(event) => {
                const nextQuery = event.target.value;
                setQuery(nextQuery);
                setSearchError('');
                if (!nextQuery.trim()) { setSearched(false); setResults([]); }
              }}
            />
          </label>
          {searchError && <output id="friend-picker-search-error" className="friend-picker-search-error" aria-live="polite">{searchError}</output>}
        </form>

        <div className="friend-picker-list">
          {searched && (
            <section className="friend-picker-group" aria-label="검색 결과">
              <p className="friend-picker-group-title">검색 결과 <span>{results.length}</span></p>
              {results.length
                ? results.map(renderRow)
                : <p className="friend-picker-note">일치하는 친구가 없어요. 이메일은 전체 주소를 정확히 입력해 주세요.</p>}
            </section>
          )}
          <section className="friend-picker-group" aria-label="내 친구 전체 목록">
            <p className="friend-picker-group-title">내 친구 <span>{friends.length}</span></p>
            {loading
              ? <p className="friend-picker-note"><LoaderCircle className="spin" size={15} /> 친구 목록을 불러오고 있어요</p>
              : loadError
                ? <output className="friend-picker-note error" aria-live="polite">{loadError}</output>
                : friends.length
                  ? friends.map(renderRow)
                  : <p className="friend-picker-note"><Users size={15} /> 아직 친구가 없어요. 친구 화면에서 먼저 친구를 추가해 주세요.</p>}
          </section>
        </div>

        <div className="friend-picker-actions">
          <button type="button" onClick={onCancel}>취소</button>
          <button
            className="confirm"
            type="button"
            disabled={multiple ? !selectedFriends.length : !selectedUserId}
            onClick={() => multiple ? onSelectMany?.(selectedFriends) : selected && onSelect(selected)}
          >
            {multiple ? `${selectedFriends.length}명 선택` : confirmLabel}
          </button>
        </div>
      </dialog>
    </div>
  );
}
