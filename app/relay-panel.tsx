'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Hourglass,
  LoaderCircle,
  Mic,
  Plus,
  Users,
  X,
} from 'lucide-react';
import { bibleBooks } from './bible-metadata';
import { BibleRangePicker } from './bible-range-picker';
import type { BibleRange } from '@/lib/bible-scope';
import type { ReadingPlanPassage } from '@/lib/custom-reading-plan';
import { buildRelayTurns } from '@/lib/relay-reading';
import { getRelayProgress, getRelayProjectView, relayErrorMessage } from '@/lib/relay-ui';
import { createBrowserBgmGainController } from '@/lib/browser-bgm-gain';
import { ContinuousPlaybackView } from './continuous-playback-view';
import { PLAYBACK_AUTO_CLOSE_DELAY_MS } from '@/lib/audio-playback';

type Friend = { userId: string; nickname: string; emailHint: string };
type GroupMember = { memberKey: string; nickname: string; position: number };
type FriendGroup = { id: string; name: string; members: GroupMember[] };
export type RelayTurn = {
  turnIndex: number;
  memberKey: string;
  passages: ReadingPlanPassage[];
  completedAt: number | null;
};
type RelayParticipant = {
  memberKey: string;
  nickname: string;
  position: number;
  inviteStatus: string;
  respondedAt: number | null;
};
export type RelayProjectDetail = {
  id: string;
  title: string;
  status: string;
  groupId: string;
  groupName: string;
  scope: BibleRange;
  bgmId: string;
  bgmVolume: number;
  rotation: number;
  currentTurnIndex: number | null;
  inviteMessage: string;
  myPosition: number;
  myInviteStatus: string;
  canRecord: boolean;
  currentTurnRecording: {
    complete: boolean;
    requiredCount: number;
    recordedCount: number;
    missingReferences: string[];
  } | null;
  creator: { nickname: string };
  isCreator: boolean;
  participants: RelayParticipant[];
  turns: RelayTurn[];
};
type RelayProjectSummary = {
  id: string;
  title: string;
  status: string;
  groupName: string;
  currentTurnIndex: number | null;
  totalTurns: number;
  completedTurns: number;
  currentMemberNickname: string | null;
  myInviteStatus: string;
  canRecord: boolean;
};
type OpeningRelayProject = Pick<RelayProjectSummary, 'id' | 'title' | 'groupName'>;

function relayStatusLabel(status: string) {
  return status === 'pending_invites'
    ? '승인 대기'
    : status === 'in_progress'
      ? '진행 중'
      : status === 'completed'
        ? '완료'
        : '취소';
}

function relayInviteStatusLabel(status: string) {
  return status === 'accepted'
    ? '참여함'
    : status === 'declined'
      ? '참여하지 않음'
      : '응답 대기';
}

function relayScopeLabel(scope: BibleRange) {
  const startBook = bibleBooks.find((book) => book.code === scope.start.bookCode)?.name ?? scope.start.bookCode;
  const endBook = bibleBooks.find((book) => book.code === scope.end.bookCode)?.name ?? scope.end.bookCode;
  const start = `${startBook} ${scope.start.chapter}:${scope.start.verse}`;
  const end = scope.start.bookCode === scope.end.bookCode
    ? scope.start.chapter === scope.end.chapter
      ? `${scope.end.verse}`
      : `${scope.end.chapter}:${scope.end.verse}`
    : `${endBook} ${scope.end.chapter}:${scope.end.verse}`;
  return `${start}–${end}`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    code?: string;
  };
  if (!response.ok)
    throw Object.assign(
      new Error(payload.error ?? '이어읽기 정보를 불러오지 못했어요.'),
      { code: payload.code },
    );
  return payload;
}

function passageLabel(passages: readonly ReadingPlanPassage[]) {
  if (!passages.length) return '배정 말씀 확인 중';
  const first = passages[0];
  const last = passages.at(-1)!;
  return first.name === last.name && first.chapter === last.chapter
    ? `${first.name} ${first.chapter}:${first.startVerse}–${last.endVerse}`
    : `${first.name} ${first.chapter}:${first.startVerse} ~ ${last.name} ${last.chapter}:${last.endVerse}`;
}

const initialRange: BibleRange = {
  start: { bookCode: '창', chapter: 1, verse: 1 },
  end: { bookCode: '창', chapter: 1, verse: 20 },
};
const bgmSources: Record<string, string> = {
  'still-waters': '/api/bgm/aeternum?v=3',
  'peaceful-morning': '/api/bgm/unto-thee?v=3',
  'word-breath': '/api/bgm/the-kings-return?v=3',
};

type RelayPlaybackRecording = {
  id: string;
  turnIndex: number;
  ownerNickname: string;
  book: string;
  chapter: number;
  verse: number;
  verseText: string;
};

export function RelayPanel({
  onBack,
  onStartRecording,
  initialCreate = false,
  initialProjectId,
}: {
  onBack: () => void;
  onStartRecording: (project: RelayProjectDetail, turn: RelayTurn) => void;
  initialCreate?: boolean;
  initialProjectId?: string;
}) {
  const [projects, setProjects] = useState<RelayProjectSummary[]>([]);
  const [project, setProject] = useState<RelayProjectDetail | null>(null);
  const [openingProject, setOpeningProject] = useState<OpeningRelayProject | null>(() => initialProjectId ? {
    id: initialProjectId,
    title: '이어읽기',
    groupName: '프로젝트 정보를 불러오는 중',
  } : null);
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(!initialProjectId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [memberOrder, setMemberOrder] = useState<GroupMember[]>([]);
  const [groupName, setGroupName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [title, setTitle] = useState('함께 읽는 말씀');
  const [range, setRange] = useState<BibleRange>(initialRange);
  const [bgmId, setBgmId] = useState('still-waters');
  const [rotationInput, setRotationInput] = useState('1');
  const [inviteMessage, setInviteMessage] = useState(
    '함께 목소리로 말씀을 남겨요.',
  );
  const [playback, setPlayback] = useState<{
    project: RelayProjectDetail;
    recordings: RelayPlaybackRecording[];
    index: number;
  } | null>(null);
  const [playbackLoadingProject, setPlaybackLoadingProject] = useState<RelayProjectDetail | null>(null);
  const [recordingStatusModal, setRecordingStatusModal] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [playbackPaused, setPlaybackPaused] = useState(false);
  const [playbackListOpen, setPlaybackListOpen] = useState(false);
  const [playbackVolume, setPlaybackVolume] = useState(0);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackBgmRef = useRef<HTMLAudioElement | null>(null);
  const playbackCloseTimerRef = useRef<number | null>(null);
  const playbackBgmGainController = useMemo(() => createBrowserBgmGainController(), []);
  const initialCreateStartedRef = useRef(false);

  const closePlayback = useCallback(() => {
    if (playbackCloseTimerRef.current !== null) {
      window.clearTimeout(playbackCloseTimerRef.current);
      playbackCloseTimerRef.current = null;
    }
    playbackAudioRef.current?.pause();
    playbackBgmRef.current?.pause();
    setPlayback(null);
    setPlaybackListOpen(false);
    setPlaybackPaused(false);
  }, []);

  const handlePlaybackEnded = useCallback(() => {
    if (!playback) return;
    if (playback.index + 1 < playback.recordings.length) {
      setPlayback({ ...playback, index: playback.index + 1 });
      return;
    }
    playbackBgmRef.current?.pause();
    setPlaybackPaused(true);
    playbackCloseTimerRef.current = window.setTimeout(() => {
      playbackCloseTimerRef.current = null;
      closePlayback();
    }, PLAYBACK_AUTO_CLOSE_DELAY_MS);
  }, [closePlayback, playback]);

  useEffect(() => () => {
    if (playbackCloseTimerRef.current !== null) {
      window.clearTimeout(playbackCloseTimerRef.current);
    }
    playbackBgmGainController.dispose();
  }, [playbackBgmGainController]);

  const refreshList = useCallback(async () => {
    const payload = await requestJson<{ projects: RelayProjectSummary[] }>(
      '/api/relay-projects',
    );
    setProjects(payload.projects);
    return payload.projects;
  }, []);
  const openProject = useCallback(
    async (projectId: string, summary?: OpeningRelayProject) => {
      if (summary) {
        setOpeningProject(summary);
        setProject(null);
      }
      try {
        const payload = await requestJson<{ project: RelayProjectDetail }>(
          `/api/relay-projects/${projectId}`,
        );
        setProject(payload.project);
        setOpeningProject(null);
        void refreshList().catch(() => undefined);
        return payload.project;
      } catch (error) {
        setOpeningProject(null);
        throw error;
      }
    },
    [refreshList],
  );

  useEffect(() => {
    let active = true;
    if (initialProjectId) {
      return () => { active = false; };
    }
    const timer = window.setTimeout(() => {
      void refreshList()
        .catch((error: Error) => active && setMessage(error.message))
        .finally(() => active && setLoading(false));
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [initialProjectId, refreshList]);

  useEffect(() => {
    if (!initialProjectId) return;
    const timer = window.setTimeout(() => {
      setOpeningProject({ id: initialProjectId, title: '이어읽기', groupName: '프로젝트 정보를 불러오는 중' });
      void openProject(initialProjectId).catch((error: Error) => { setOpeningProject(null); setMessage(error.message); });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialProjectId, openProject]);

  useEffect(() => {
    const refreshOnFocus = () => {
      if (project) void openProject(project.id).catch(() => undefined);
      else void refreshList().catch(() => undefined);
    };
    window.addEventListener('focus', refreshOnFocus);
    return () => window.removeEventListener('focus', refreshOnFocus);
  }, [openProject, project, refreshList]);

  const beginCreate = async () => {
    setBusy(true);
    setMessage('');
    try {
      const [groupPayload, friendPayload] = await Promise.all([
        requestJson<{ groups: FriendGroup[] }>('/api/friend-groups'),
        requestJson<{ friends: Friend[] }>('/api/friends'),
      ]);
      setGroups(groupPayload.groups);
      setFriends(friendPayload.friends);
      setSelectedGroupId(groupPayload.groups[0]?.id ?? '');
      setMemberOrder(groupPayload.groups[0]?.members ?? []);
      setCreating(true);
      setProject(null);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '준비 정보를 불러오지 못했어요.',
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (initialCreate && !initialCreateStartedRef.current) {
      initialCreateStartedRef.current = true;
      void beginCreate();
    } else if (!initialCreate && initialCreateStartedRef.current) {
      initialCreateStartedRef.current = false;
      setCreating(false);
    }
  }, [initialCreate]);

  const createGroup = async () => {
    if (!groupName.trim() || !selectedFriends.length) return;
    setBusy(true);
    setMessage('');
    try {
      const payload = await requestJson<{ group: { id: string } }>(
        '/api/friend-groups',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: groupName,
            memberKeys: [
              'self',
              ...selectedFriends.map((friend) => friend.userId),
            ],
          }),
        },
      );
      const refreshed = await requestJson<{ groups: FriendGroup[] }>(
        '/api/friend-groups',
      );
      setGroups(refreshed.groups);
      setSelectedGroupId(payload.group.id);
      setMemberOrder(refreshed.groups.find((group) => group.id === payload.group.id)?.members ?? []);
      setGroupName('');
      setSelectedFriends([]);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '그룹을 저장하지 못했어요.',
      );
    } finally {
      setBusy(false);
    }
  };

  const parsedRotation = Number(rotationInput);
  const rotation = Number.isInteger(parsedRotation)
    ? Math.max(1, Math.min(10, parsedRotation))
    : 1;
  const selectedGroup =
    groups.find((group) => group.id === selectedGroupId) ?? null;
  const preview = useMemo(() => {
    if (!selectedGroup) return [];
    try {
      return buildRelayTurns({
        books: bibleBooks,
        range,
        memberKeys: memberOrder.map((member) => member.memberKey),
        rotation,
      });
    } catch {
      return [];
    }
  }, [memberOrder, range, rotation, selectedGroup]);

  const submitProject = async () => {
    if (!selectedGroup || !preview.length) return;
    setBusy(true);
    setMessage('');
    try {
      const payload = await requestJson<{ project: { id: string } }>(
        '/api/relay-projects',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupId: selectedGroup.id,
            memberKeys: memberOrder.map((member) => member.memberKey),
            title,
            scope: range,
            bgmId,
            bgmVolume: 8,
            rotation,
            inviteMessage,
          }),
        },
      );
      setCreating(false);
      await openProject(payload.project.id);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '이어읽기를 제안하지 못했어요.',
      );
    } finally {
      setBusy(false);
    }
  };

  const respond = async (action: 'accept' | 'decline') => {
    if (!project) return;
    setBusy(true);
    setMessage('');
    try {
      await requestJson(`/api/relay-projects/${project.id}/${action}`, {
        method: 'POST',
      });
      await openProject(project.id);
    } catch (error) {
      setMessage(
        relayErrorMessage(
          (error as { code?: string }).code,
          error instanceof Error ? error.message : undefined,
        ),
      );
      await openProject(project.id).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

    const completeTurn = async () => {
    if (busy || !project || project.currentTurnIndex === null) return;
    setBusy(true);
    setMessage('');
    try {
      await requestJson(
        `/api/relay-projects/${project.id}/turns/${project.currentTurnIndex}/complete`,
        { method: 'POST' },
      );
      await openProject(project.id);
    } catch (error) {
      setMessage(
        relayErrorMessage(
          (error as { code?: string }).code,
          error instanceof Error ? error.message : undefined,
        ),
      );
      await openProject(project.id).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const openRelayPlayback = async (
    relayProject: RelayProjectDetail,
  ) => {
    setBusy(true);
    setPlaybackLoadingProject(relayProject);
    setMessage('');
    try {
      await playbackBgmGainController.activate();
      const payload = await requestJson<{
        recordings: RelayPlaybackRecording[];
      }>(`/api/relay-projects/${relayProject.id}/recordings`);
      if (!payload.recordings.length)
        throw new Error('재생할 녹음을 찾지 못했어요.');
      setPlayback({
        project: relayProject,
        recordings: payload.recordings,
        index: 0,
      });
      setPlaybackPaused(false);
      setPlaybackListOpen(false);
      setPlaybackVolume(relayProject.bgmVolume);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '이어듣기를 시작하지 못했어요.',
      );
    } finally {
      setBusy(false);
      setPlaybackLoadingProject(null);
    }
  };

  if (openingProject)
    return (
      <section className="relay-screen relay-detail-loading" aria-label={`${openingProject.title} 상세 화면을 준비하는 중`}>
        <header className="relay-detail-heading">
          <p className="eyebrow">OUR WORD JOURNEY</p>
          <h2>{openingProject.title}</h2>
          <strong>{openingProject.groupName}</strong>
        </header>
        <div className="route-target-loading"><LoaderCircle className="spin" /><strong>이어읽기 정보를 불러오고 있어요.</strong></div>
      </section>
    );

  if (loading)
    return (
      <section className="relay-screen">
        <LoaderCircle className="spin" /> 이어읽기를 불러오는 중이에요.
      </section>
    );

  if (creating)
    return (
      <section className="relay-screen">
        <button
          className="section-route-back"
          type="button"
          onClick={() => setCreating(false)}
        >
          <ChevronLeft size={17} /> 이어읽기 목록
        </button>
        <header className="relay-heading">
          <div>
            <p className="eyebrow">RELAY READING</p>
            <h2>새 이어읽기 제안</h2>
          </div>
        </header>
        {message && (
          <output className="relay-message" aria-live="polite">
            {message}
          </output>
        )}
        <div className="relay-create-grid">
          <section className="relay-form-card">
            <h3>1. 함께할 그룹</h3>
            {groups.map((group) => (
              <button
                className={
                  selectedGroupId === group.id
                    ? 'relay-group selected'
                    : 'relay-group'
                }
                type="button"
                onClick={() => { setSelectedGroupId(group.id); setMemberOrder(group.members); }}
                key={group.id}
              >
                <strong>{group.name}</strong>
                <small>
                  {group.members.map((member) => member.nickname).join(' → ')}
                </small>
              </button>
            ))}
            <details>
              <summary>
                <Plus size={15} /> 새 그룹 만들기
              </summary>
              <input
                aria-label="그룹 이름"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="그룹 이름"
              />
              <div className="relay-friend-picker">
                {friends.map((friend) => {
                  const index = selectedFriends.findIndex(
                    (item) => item.userId === friend.userId,
                  );
                  return (
                    <button
                      type="button"
                      className={index >= 0 ? 'selected' : ''}
                      onClick={() =>
                        setSelectedFriends((current) =>
                          index >= 0
                            ? current.filter(
                                (item) => item.userId !== friend.userId,
                              )
                            : [...current, friend],
                        )
                      }
                      key={friend.userId}
                    >
                      <span>{index >= 0 ? index + 1 : '+'}</span>
                      {friend.nickname}
                    </button>
                  );
                })}
              </div>
              {selectedFriends.map((friend, index) => (
                <div className="relay-order-row" key={friend.userId}>
                  <strong>
                    {index + 2}. {friend.nickname}
                  </strong>
                  <span>
                    <button
                      type="button"
                      aria-label={`${friend.nickname} 앞으로`}
                      disabled={index === 0}
                      onClick={() =>
                        setSelectedFriends((current) => {
                          const next = [...current];
                          [next[index - 1], next[index]] = [
                            next[index],
                            next[index - 1],
                          ];
                          return next;
                        })
                      }
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`${friend.nickname} 뒤로`}
                      disabled={index === selectedFriends.length - 1}
                      onClick={() =>
                        setSelectedFriends((current) => {
                          const next = [...current];
                          [next[index], next[index + 1]] = [
                            next[index + 1],
                            next[index],
                          ];
                          return next;
                        })
                      }
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`${friend.nickname} 해제`}
                      onClick={() =>
                        setSelectedFriends((current) =>
                          current.filter(
                            (item) => item.userId !== friend.userId,
                          ),
                        )
                      }
                    >
                      <X size={14} />
                    </button>
                  </span>
                </div>
              ))}
              <button
                className="relay-primary"
                type="button"
                disabled={busy || !groupName.trim() || !selectedFriends.length}
                onClick={() => void createGroup()}
              >
                그룹 저장
              </button>
            </details>
          </section>
          <section className="relay-form-card">
            <h3>2. 말씀과 순서</h3>
            <div className="relay-project-order" aria-label="참여자 읽기 순서">
              {memberOrder.map((member, index) => (
                <div className="relay-order-row" key={member.memberKey}>
                  <strong>{index + 1}. {member.nickname}</strong>
                  <span>
                    <button type="button" aria-label={`${member.nickname} 앞으로`} disabled={index === 0} onClick={() => setMemberOrder((current) => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}><ArrowUp size={14} /></button>
                    <button type="button" aria-label={`${member.nickname} 뒤로`} disabled={index === memberOrder.length - 1} onClick={() => setMemberOrder((current) => { const next = [...current]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; })}><ArrowDown size={14} /></button>
                  </span>
                </div>
              ))}
            </div>
            <label>
              이어읽기 이름
              <input
                value={title}
                maxLength={60}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <BibleRangePicker value={range} onChange={setRange} />
            <div className="relay-settings">
              <label>
                배경음악
                <select
                  value={bgmId}
                  onChange={(event) => setBgmId(event.target.value)}
                >
                  <option value="still-waters">Aeternum</option>
                  <option value="peaceful-morning">Unto Thee</option>
                  <option value="word-breath">The King&apos;s Return</option>
                  <option value="none">음악 없음</option>
                </select>
              </label>
              <label>
                Rotation
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={rotationInput}
                  onChange={(event) => setRotationInput(event.target.value)}
                  onBlur={() => setRotationInput(String(rotation))}
                />
              </label>
            </div>
            <label>
              초대 메시지
              <textarea
                value={inviteMessage}
                maxLength={300}
                onChange={(event) => setInviteMessage(event.target.value)}
              />
            </label>
          </section>
          <section className="relay-form-card relay-preview">
            <h3>3. 배분 미리보기</h3>
            {preview.map((turn) => (
              <div key={turn.turnIndex}>
                <span>{turn.turnIndex + 1}</span>
                <strong>
                  {
                    selectedGroup?.members.find(
                      (member) => member.memberKey === turn.memberKey,
                    )?.nickname
                  }
                </strong>
                <small>{passageLabel(turn.passages)}</small>
              </div>
            ))}
            <button
              className="relay-primary"
              type="button"
              disabled={busy || !preview.length || !title.trim() || !rotationInput}
              onClick={() => void submitProject()}
            >
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Check size={16} />
              )}{' '}
              이어읽기 제안 보내기
            </button>
          </section>
        </div>
      </section>
    );

  if (project) {
    const view = getRelayProjectView(project);
    const progress = getRelayProgress({
      currentTurnIndex: project.currentTurnIndex,
      participantCount: project.participants.length,
      rotation: project.rotation,
      myPosition: project.myPosition,
    });
    const myMemberKey = project.participants.find(
      (participant) => participant.position === project.myPosition,
    )?.memberKey;
    const nextReadingTurn = project.turns.find(
      (turn) => turn.memberKey === myMemberKey && turn.completedAt === null,
    );
    const currentTurn =
      project.turns.find(
        (turn) => turn.turnIndex === project.currentTurnIndex,
      ) ?? null;
    const currentPerson = project.participants.find(
      (participant) => participant.memberKey === currentTurn?.memberKey,
    );
    const handleRecordAction = async () => {
      setBusy(true);
      const latestProject = await openProject(project.id).catch(() => project);
      setBusy(false);
      const latestTurn = latestProject.turns.find(
        (turn) => turn.turnIndex === latestProject.currentTurnIndex,
      );
      if (latestProject.canRecord && latestTurn) {
        onStartRecording(latestProject, latestTurn);
        return;
      }
      setRecordingStatusModal(true);
    };
    const deleteProject = async () => {
      if (busy || !project) return;
      setBusy(true);
      setMessage('');
      try {
        await requestJson(`/api/relay-projects/${project.id}`, { method: 'DELETE' });
        setDeleteConfirmOpen(false);
        setProject(null);
        await refreshList();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '이어읽기를 삭제하지 못했어요.');
      } finally {
        setBusy(false);
      }
    };
    const recordingStatusTitle = view.kind === 'invites_pending'
      ? '아직 모두의 답을 기다리고 있어요.'
      : view.kind === 'completed'
        ? '함께 읽기를 모두 완성했어요.'
        : view.kind === 'cancelled'
          ? '이번 이어읽기는 시작되지 않았어요.'
          : `${currentPerson?.nickname ?? '다른 친구'}님의 차례를 기다리고 있어요.`;
    return (
      <section className="relay-screen">
        <button
          className="section-route-back"
          type="button"
          onClick={() => setProject(null)}
        >
          <ArrowLeft size={17} /> 목록
        </button>
        <header className="relay-detail-heading">
          <p className="eyebrow">
            {project.creator.nickname}님이 제안한 이어읽기
          </p>
          <h2>{project.title}</h2>
          <strong>{project.groupName}</strong>
          <p>{project.inviteMessage}</p>
        </header>
        {message && (
          <output className="relay-message" aria-live="polite">
            {message}
          </output>
        )}
        <div className="relay-progress">
          <span
            style={{
              width: `${project.turns.length ? (project.turns.filter((turn) => turn.completedAt).length / project.turns.length) * 100 : 0}%`,
            }}
          />
          <strong>
            {project.turns.filter((turn) => turn.completedAt).length} /{' '}
            {project.turns.length} turn
          </strong>
        </div>
        <details className="relay-participant-menu">
          <summary>
            <span className="relay-participant-avatars" aria-hidden="true">
              {project.participants.slice(0, 3).map((participant) => (
                <i key={participant.memberKey}>{participant.position + 1}</i>
              ))}
            </span>
            <strong>참여자 {project.participants.length}명</strong>
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <div className="relay-participant-dropdown">
            {project.participants.map((participant) => (
              <div
                className={`relay-participant-row ${participant.memberKey === currentTurn?.memberKey ? 'current' : ''}`}
                data-status={participant.inviteStatus}
                key={participant.memberKey}
              >
                <span>{participant.position + 1}</span>
                <strong>{participant.nickname}</strong>
                <small>{relayInviteStatusLabel(participant.inviteStatus)}</small>
                <i className="relay-participant-status" aria-hidden="true" />
              </div>
            ))}
          </div>
        </details>
        <div className="relay-project-facts">
          <span><strong>{progress.currentRound} / {progress.totalRounds}</strong><small>현재 round</small></span>
          <span><strong>{progress.myTurn} / {progress.totalParticipants}</strong><small>내 turn</small></span>
        </div>
        <div className="relay-project-facts relay-project-settings">
          <span><strong>{relayScopeLabel(project.scope)}</strong><small>전체 말씀 범위</small></span>
          <span><strong>{project.rotation}회</strong><small>rotation 횟수</small></span>
        </div>
        <p className="relay-next-reading"><small>내가 다음 읽을 말씀</small><strong>{nextReadingTurn ? passageLabel(nextReadingTurn.passages) : '내 차례 모두 완료'}</strong></p>
        {view.kind === 'invites_pending' && (
          <section className={`relay-state-card ${project.myInviteStatus === 'pending' ? 'relay-invite-action-card' : ''}`}>
            <Users size={32} />
            {project.myInviteStatus === 'pending' ? (
              <>
                <h3>이어읽기에 함께 하시겠습니까?</h3>
                <p>{project.creator.nickname}님과 친구들이 함께 말씀을 이어 읽으려 해요.</p>
                <div>
                  <button
                    className="relay-primary"
                    disabled={busy}
                    type="button"
                    onClick={() => void respond('accept')}
                  >
                    함께 하기
                  </button>
                  <button
                    className="relay-secondary"
                    disabled={busy}
                    type="button"
                    onClick={() => void respond('decline')}
                  >
                    다음에 하기
                  </button>
                </div>
              </>
            ) : (
              <h3>함께 읽을 친구들의 답을 기다리고 있어요.</h3>
            )}
          </section>
        )}
        <nav className="relay-project-toolbar" aria-label="이어읽기 프로젝트 메뉴">
          <button
            className={project.canRecord ? 'active' : ''}
            type="button"
            disabled={busy || view.kind === 'invites_pending' || view.kind === 'cancelled' || view.kind === 'completed'}
            onClick={() => void handleRecordAction()}
          >
            <Mic size={20} /><strong>녹음</strong>
          </button>
          <button
            type="button"
            disabled={busy || view.kind === 'invites_pending' || view.kind === 'cancelled'}
            onClick={() => void openRelayPlayback(project)}
          >
            <Headphones size={20} /><strong>듣기</strong>
          </button>
        </nav>
        {project.isCreator && (
          <button className="relay-delete-action" type="button" disabled={busy} onClick={() => setDeleteConfirmOpen(true)}>
            이어읽기 삭제
          </button>
        )}
        {view.kind === 'cancelled' && (
          <section className="relay-state-card">
            <X size={32} />
            <h3>이번 이어읽기는 시작되지 않았어요.</h3>
          </section>
        )}
        {view.kind === 'waiting' && (
          <section className="relay-state-card">
            <Hourglass size={32} aria-hidden="true" />
            <h3>{currentPerson?.nickname ?? '다른 친구'}님의 차례를 기다리고 있어요.</h3>
            <p>
              현재 말씀 · {passageLabel(currentTurn?.passages ?? [])}
            </p>
            {view.nextOwnTurnIndex !== null && (
              <small>
                내 다음 차례:{' '}
                {passageLabel(
                  project.turns[view.nextOwnTurnIndex]?.passages ?? [],
                )}
              </small>
            )}
          </section>
        )}
        {view.kind === 'recordable' && currentTurn && (
          <section className="relay-state-card recordable">
            <Mic size={32} />
            <h3>지금은 내 차례예요.</h3>
            <p>{passageLabel(currentTurn.passages)}</p>
            {project.currentTurnRecording && (
              <small>{project.currentTurnRecording.recordedCount} / {project.currentTurnRecording.requiredCount}절 저장</small>
            )}
            <button
              className={project.currentTurnRecording?.complete ? 'relay-primary' : 'relay-secondary'}
              disabled={busy || !project.currentTurnRecording?.complete}
              type="button"
              onClick={() => void completeTurn()}
            >
              <Check size={17} /> 이번 차례 완료
            </button>
          </section>
        )}
        {view.kind === 'completed' && (
          <section className="relay-state-card completed">
            <Check size={32} />
            <h3>함께 말씀 읽기를 완성했어요.</h3>
          </section>
        )}
        {recordingStatusModal && (
          <div className="continuous-player-backdrop" role="presentation">
            <dialog className="completion-modal relay-recording-status-modal" open aria-labelledby="relay-recording-status-title">
              <span className="completion-modal-icon"><Mic size={24} /></span>
              <h2 id="relay-recording-status-title">{recordingStatusTitle}</h2>
              {view.kind === 'waiting' && (
                <div className="relay-waiting-details">
                  <p><small>현재</small><strong>{passageLabel(currentTurn?.passages ?? [])}</strong></p>
                  <p><small>내 다음 말씀</small><strong>{nextReadingTurn ? passageLabel(nextReadingTurn.passages) : '내 차례 모두 완료'}</strong></p>
                </div>
              )}
              <button className="primary-action" type="button" onClick={() => setRecordingStatusModal(false)}>확인</button>
            </dialog>
          </div>
        )}
        {deleteConfirmOpen && (
          <div className="completion-modal-backdrop" role="presentation">
            <dialog className="completion-modal" open aria-labelledby="relay-delete-title">
              <h2 id="relay-delete-title">이 이어읽기를 삭제할까요?</h2>
              <p>{project.status === 'pending_invites' ? '아직 시작하지 않은 이어읽기와 초대가 모두 삭제됩니다.' : project.status === 'in_progress' ? '지금까지 함께 녹음한 말씀도 모두 삭제됩니다.' : project.status === 'completed' ? '완성된 이어읽기와 녹음이 모두 삭제됩니다.' : '종료된 이어읽기 기록이 삭제됩니다.'}</p>
              <p>삭제 후에는 되돌릴 수 없어요.</p>
              <div className="completion-modal-actions">
                <button type="button" disabled={busy} onClick={() => setDeleteConfirmOpen(false)}>취소</button>
                <button className="destructive" type="button" disabled={busy} onClick={() => void deleteProject()}>{busy ? '삭제 중' : '삭제'}</button>
              </div>
            </dialog>
          </div>
        )}
        {playback && (
          <ContinuousPlaybackView
            items={playback.recordings.map((recording) => ({ ...recording, readerName: recording.ownerNickname }))}
            index={playback.index}
            paused={playbackPaused}
            listOpen={playbackListOpen}
            volume={playbackVolume}
            onClose={closePlayback}
            onTogglePlayback={() => {
              if (playbackPaused) {
                void playbackAudioRef.current?.play();
                void playbackBgmRef.current?.play();
                setPlaybackPaused(false);
              } else {
                playbackAudioRef.current?.pause();
                playbackBgmRef.current?.pause();
                setPlaybackPaused(true);
              }
            }}
            onToggleList={() => setPlaybackListOpen((current) => !current)}
            onSelect={(index) => {
              if (playbackCloseTimerRef.current !== null) {
                window.clearTimeout(playbackCloseTimerRef.current);
                playbackCloseTimerRef.current = null;
              }
              setPlayback((current) => current ? { ...current, index } : null);
              setPlaybackPaused(false);
            }}
            onVolumeChange={(nextVolume) => {
              setPlaybackVolume(nextVolume);
              playbackBgmGainController.setVolume(nextVolume);
            }}
          >
              {bgmSources[playback.project.bgmId] && (
                // oxlint-disable-next-line jsx-a11y/media-has-caption -- 선택한 배경음악은 대사가 없습니다.
                <audio
                  aria-hidden="true"
                  autoPlay
                  loop
                  src={bgmSources[playback.project.bgmId]}
                  ref={playbackBgmRef}
                  onCanPlay={(event) => { playbackBgmGainController.connect(event.currentTarget, playbackVolume); }}
                />
              )}
              {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- 사용자들이 직접 녹음한 말씀입니다. */}
              <audio
                ref={playbackAudioRef}
                autoPlay
                src={`/api/recordings/${playback.recordings[playback.index].id}/audio`}
                onPlay={() => setPlaybackPaused(false)}
                onPause={(event) => { if (!event.currentTarget.ended) setPlaybackPaused(true); }}
                onEnded={handlePlaybackEnded}
              />
          </ContinuousPlaybackView>
        )}
        {playbackLoadingProject && !playback && (
          <div className="continuous-player-backdrop" role="presentation">
            <dialog className="continuous-player-modal route-target-loading" open aria-label="이어듣기를 준비하는 중">
              <LoaderCircle className="spin" />
              <strong>{playbackLoadingProject.title} 이어듣기를 준비하고 있어요.</strong>
            </dialog>
          </div>
        )}
      </section>
    );
  }

  const pendingProjects = projects.filter(
    (item) => item.status === 'pending_invites',
  );
  const myTurnProjects = projects.filter(
    (item) => item.status === 'in_progress' && item.canRecord,
  );
  const ongoingProjects = projects.filter(
    (item) => item.status === 'in_progress' && !item.canRecord,
  );
  const completedProjects = projects.filter(
    (item) => item.status === 'completed',
  );
  const cancelledProjects = projects.filter(
    (item) => item.status === 'cancelled',
  );
  const renderProjectCards = (items: RelayProjectSummary[], completed = false) => (
    <div className={`running-project-list ${completed ? 'completed-project-list' : ''}`}>
      {items.map((item, index) => (
        <button
          className={`project-color-${index % 5}`}
          type="button"
          onClick={() => {
            void openProject(item.id, item).catch((error: Error) => {
              setMessage(error.message);
            });
          }}
          key={item.id}
        >
          <span>{completed ? <Check size={20} /> : <Users size={20} />}</span>
          <div>
            <small>{relayStatusLabel(item.status)}</small>
            <strong>{item.title}</strong>
            <p>{item.groupName} · {item.completedTurns}/{item.totalTurns} turn{item.status === 'in_progress' ? ` · 현재 ${item.currentMemberNickname ?? '참여자'}님의 차례` : ''}</p>
          </div>
          {completed ? <Headphones size={18} /> : <ChevronRight size={18} />}
        </button>
      ))}
    </div>
  );

  return (
    <section className="relay-screen">
      <button className="section-route-back" type="button" onClick={onBack}>
        <ChevronLeft size={17} /> 뒤로가기
      </button>
      <header className="relay-heading">
        <div>
          <p className="eyebrow">OUR WORD JOURNEYS</p>
          <h2>우리 말씀 여정</h2>
          <p>함께 쌓아가는 말씀 여정을 확인해요.</p>
        </div>
        <button
          className="relay-primary"
          disabled={busy}
          type="button"
          onClick={() => void beginCreate()}
        >
          <Plus size={17} /> 새 이어읽기
        </button>
      </header>
      {message && (
        <output className="relay-message" aria-live="polite">
          {message}
        </output>
      )}
      <div className="journey-status-sections relay-journey-status-sections">
      {pendingProjects.length > 0 && <section aria-labelledby="relay-pending-title">
        <div className="journey-status-heading"><h3 id="relay-pending-title">승인 대기 중</h3><span>{pendingProjects.length}</span></div>
        {renderProjectCards(pendingProjects)}
      </section>}
      {myTurnProjects.length > 0 && <section aria-labelledby="relay-my-turn-title">
        <div className="journey-status-heading relay-my-turn-heading"><h3 id="relay-my-turn-title">내 차례</h3><span>{myTurnProjects.length}</span></div>
        {renderProjectCards(myTurnProjects)}
      </section>}
      <section aria-labelledby="relay-ongoing-title">
        <div className="journey-status-heading"><h3 id="relay-ongoing-title">진행 중</h3><span>{ongoingProjects.length}</span></div>
        {ongoingProjects.length ? renderProjectCards(ongoingProjects) : (
          <p className="journey-status-empty">진행 중인 우리 말씀 여정이 없어요.</p>
        )}
      </section>
       {completedProjects.length > 0 && <section aria-labelledby="relay-completed-title">
         <div className="journey-status-heading completed"><h3 id="relay-completed-title">완료</h3><span>{completedProjects.length}</span></div>
         {renderProjectCards(completedProjects, true)}
       </section>}
       {cancelledProjects.length > 0 && <section aria-labelledby="relay-cancelled-title">
         <div className="journey-status-heading"><h3 id="relay-cancelled-title">종료</h3><span>{cancelledProjects.length}</span></div>
         {renderProjectCards(cancelledProjects)}
       </section>}
       </div>
    </section>
  );
}

export function RelayHomeJourneys({
  onOpenList,
}: {
  onOpenList: () => void;
}) {
  const [projects, setProjects] = useState<RelayProjectSummary[]>([]);

  useEffect(() => {
    let active = true;
    const loadProjects = async () => {
      try {
        const payload = await requestJson<{ projects: RelayProjectSummary[] }>('/api/relay-projects');
        if (active) setProjects(payload.projects.filter((item) => item.status !== 'cancelled'));
      } catch {
        // Home inbox refresh failures should not interrupt the rest of Home.
      }
    };
    const timer = window.setTimeout(() => void loadProjects(), 0);
    const interval = window.setInterval(() => void loadProjects(), 15_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void loadProjects();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const pendingProjects = projects.filter((item) => item.status === 'pending_invites');
  const pendingInvites = projects.filter(
    (item) => item.status === 'pending_invites' && item.myInviteStatus === 'pending',
  );
  const myTurnProjects = projects.filter(
    (item) => item.status === 'in_progress' && item.canRecord,
  );
  const ongoingCount = projects.filter((item) => item.status === 'in_progress').length;
  const completedCount = projects.filter((item) => item.status === 'completed').length;
  const inboxCount = pendingInvites.length + myTurnProjects.length;
  return (
    <button className="word-card-library-entry journey-library-entry" type="button" onClick={onOpenList}>
      <span>
        <Users size={21} />
        {inboxCount > 0 && <b className="relay-home-inbox-badge" aria-label={`확인할 이어읽기 ${inboxCount}개`}>{inboxCount > 99 ? '99+' : inboxCount}</b>}
      </span>
      <div>
        <strong>우리 말씀 여정</strong>
        <small>{projects.length ? `승인 대기 ${pendingProjects.length}개 · 내 차례 ${myTurnProjects.length}개 · 진행 중 ${ongoingCount}개 · 완료 ${completedCount}개` : '친구와 함께 읽을 말씀 여정을 시작해 보세요.'}</small>
      </div>
      <ChevronRight size={18} />
    </button>
  );
}
