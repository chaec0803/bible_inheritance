import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const panel = readFileSync(new URL('./friends-panel.tsx', import.meta.url), 'utf8');
const route = readFileSync(new URL('./api/friends/route.ts', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../db/schema.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');
const pickerUrl = new URL('./friend-picker-modal.tsx', import.meta.url);
const picker = existsSync(pickerUrl) ? readFileSync(pickerUrl, 'utf8') : '';
const studioUrl = new URL('./gift-studio.tsx', import.meta.url);
const studio = existsSync(studioUrl) ? readFileSync(studioUrl, 'utf8') : '';
const dbIndex = readFileSync(new URL('../db/index.ts', import.meta.url), 'utf8');
const giftsRoute = readFileSync(new URL('./api/gifts/route.ts', import.meta.url), 'utf8');
const giftDraftsRoute = readFileSync(new URL('./api/gift-drafts/route.ts', import.meta.url), 'utf8');
const giftDraftSendRoute = readFileSync(new URL('./api/gift-drafts/[id]/send/route.ts', import.meta.url), 'utf8');

function rule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped}(?![\\w-])[^{}]*\\{([^}]*)\\}`))?.[1] ?? '';
}

function pixels(declarations: string, property: string) {
  return Number(declarations.match(new RegExp(`${property}:\\s*(\\d+)px`))?.[1] ?? 0);
}

describe('친구 추가 기능 회귀', () => {
  it('로그인한 사용자만 친구 검색과 관계 변경을 할 수 있다', () => {
    expect(route.match(/await authenticateRequest\(request\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(route).toContain('{ status: 401 }');
    expect(route).toContain('targetUserId === user.id');
  });

  it('이메일 정확 검색과 닉네임 앞부분 검색을 지원한다', () => {
    expect(route).toContain('email_normalized = ?');
    expect(route).toContain('nickname_normalized LIKE ? ESCAPE');
    expect(panel).toContain('이메일 또는 닉네임');
  });

  it('짧은 검색어 안내는 검색 입력 바로 아래에 인라인 오류로 표시한다', () => {
    expect(panel).toContain("const [searchError, setSearchError] = useState('')");
    expect(panel).toContain("aria-describedby={searchError ? 'friend-search-error' : undefined}");
    expect(panel).toContain('id="friend-search-error"');
    expect(panel).toContain('className="friend-search-error"');
  });

  it('카카오톡처럼 검색창 안에 돋보기 하나만 두고 별도 찾기 버튼 없이 입력으로 검색한다', () => {
    const searchBlock = panel.slice(
      panel.indexOf('<form className="friend-search"'),
      panel.indexOf('{data.incoming.length > 0'),
    );
    expect(searchBlock.match(/<Search /g)).toHaveLength(1);
    expect(searchBlock).not.toContain('> 찾기</button>');
    expect(panel).toContain('window.setTimeout');
    expect(panel).toContain('clearTimeout');
  });

  it('친구 검색은 하나의 둥근 검색 필드로 보인다', () => {
    const search = rule('.friend-search label');
    expect(search).toContain('border-radius: 12px');
    expect(search).toContain('background: var(--surface-subtle)');
    expect(search).toContain('min-height: 48px');
  });

  it('닉네임 저장 오류는 친구 검색창이 아니라 닉네임 입력 바로 아래에 표시한다', () => {
    expect(panel).toContain("const [profileError, setProfileError] = useState('')");
    expect(panel).toContain("aria-describedby={profileError ? 'friend-profile-error' : undefined}");
    expect(panel).toContain('id="friend-profile-error"');
    expect(panel).toContain('className="friend-profile-error"');
    expect(panel).toContain("setProfileError(error instanceof Error ? error.message : '닉네임을 저장하지 못했어요.')");
  });

  it('친구 관계는 사용자 쌍당 하나이고 양쪽 사용자 조회 인덱스가 있다', () => {
    expect(schema).toContain("uniqueIndex('idx_friendships_pair')");
    expect(schema).toContain("index('idx_friendships_user_a_status')");
    expect(schema).toContain("index('idx_friendships_user_b_status')");
  });

  it('친구 요청의 수락·거절과 친구 해제를 제공한다', () => {
    expect(panel).toContain("runAction('accept'");
    expect(panel).toContain("runAction('reject'");
    expect(panel).toContain("runAction('remove'");
    expect(route).toContain('existing.requested_by === user.id');
  });

  it('데스크톱과 모바일 내비게이션에서 친구 화면을 연다', () => {
    expect(page).toContain("navigateTo('friends')");
    expect(page.match(/onClick={openFriendsTab}/g)?.length).toBeGreaterThanOrEqual(3);
    expect(page).toContain("appTab === 'friends' && <FriendsPanel");
  });
});

describe('친구 메인 화면 밀도', () => {
  it('내 프로필, 검색창, 친구 목록 순서로 배치한다', () => {
    expect(panel).toContain('className="friend-me-row"');
    expect(panel.indexOf('className="friend-me-row"')).toBeLessThan(panel.indexOf('className="friend-search"'));
    expect(panel.indexOf('className="friend-search"')).toBeLessThan(panel.indexOf('className="friend-compact-list"'));
  });

  it('친구를 한 줄에 한 명씩 세로 리스트로 표시한다', () => {
    expect(panel).toContain('className="friend-compact-list"');
    expect(panel).toContain('friend-row');
    expect(panel).toContain('className="friend-row-avatar"');
    expect(panel).toContain('className="friend-row-name"');
    expect(panel).toContain('className="friend-row-mail"');
  });

  it('여러 겹으로 쌓이던 큰 친구 카드 레이아웃을 제거한다', () => {
    expect(panel).not.toContain('friend-profile-card');
    expect(panel).not.toContain('className="friend-group"');
    expect(panel).not.toContain('friend-group-title');
    expect(panel).not.toContain('className="friend-list"');
  });

  it('친구 수를 상단에 표시한다', () => {
    expect(panel).toContain('className="friend-count"');
    expect(panel).toContain('{data.friends.length}명');
  });

  it('친구 행 전체를 눌러 상세 모달을 연다', () => {
    expect(panel).toContain('setDetailFriend(person)');
    expect(panel).toContain('className="friend-detail-backdrop"');
    expect(panel).toContain('className="friend-detail-modal"');
  });

  it('친구가 많아져도 목록 영역 안에서 스크롤한다', () => {
    const list = rule('.friend-compact-list');
    expect(list).toContain('overflow-y: auto');
    expect(list).toContain('-webkit-overflow-scrolling: touch');
  });

  it('한 친구 행은 모바일에서 56~68px 높이를 지킨다', () => {
    const height = pixels(rule('.friend-row'), 'min-height');
    expect(height).toBeGreaterThanOrEqual(56);
    expect(height).toBeLessThanOrEqual(68);
  });

  it('요청 수락·거절 같은 인라인 동작도 44px 이상 터치 영역을 갖는다', () => {
    expect(pixels(rule('.friend-request-actions button'), 'min-height')).toBeGreaterThanOrEqual(44);
  });

  it('긴 닉네임과 이메일은 말줄임으로 처리한다', () => {
    for (const selector of ['.friend-row-name', '.friend-row-mail']) {
      const declarations = rule(selector);
      expect(declarations).toContain('overflow: hidden');
      expect(declarations).toContain('text-overflow: ellipsis');
      expect(declarations).toContain('white-space: nowrap');
    }
  });

  it('받은 요청은 친구 목록 위 컴팩트 섹션에서 수락·거절한다', () => {
    expect(panel).toContain('className="friend-request-strip"');
    expect(panel.indexOf('friend-request-strip')).toBeLessThan(panel.indexOf('className="friend-compact-list"'));
    expect(panel).toContain('수락');
    expect(panel).toContain('거절');
  });

  it('보낸 요청은 수락 대기 상태로 표시한다', () => {
    expect(panel).toContain('수락 대기');
    expect(panel).toContain('data.outgoing');
  });

  it('빈 목록, 검색 결과 없음, 로딩, 오류 상태를 각각 안내한다', () => {
    expect(panel).toContain('아직 추가한 친구가 없어요');
    expect(panel).toContain('일치하는 사용자가 없어요');
    expect(panel).toContain('친구 목록을 불러오고 있어요');
    expect(panel).toContain('className="friend-load-error"');
  });

  it('친구 해제는 확인 모달을 거치고 주요 CTA처럼 크게 보이지 않는다', () => {
    expect(panel).toContain('className="friend-remove-confirm-backdrop"');
    expect(panel).toContain('confirmRemoveFriend');
    expect(panel).toContain("runAction('remove'");
    const danger = rule('.friend-detail-secondary button');
    expect(danger).toContain('width: auto');
    expect(pixels(danger, 'min-height')).toBeLessThanOrEqual(40);
  });

  it('친구 행 자체에는 삭제·해제·차단 버튼을 노출하지 않는다', () => {
    const listBlock = panel.slice(panel.indexOf('data.friends.map'), panel.indexOf('data.outgoing.length > 0'));
    for (const label of ['친구 해제', '차단하기', '삭제']) expect(listBlock).not.toContain(label);
  });

  it('성공 알림은 화면 자체 문구가 아니라 공용 토스트를 쓴다', () => {
    expect(panel).toContain('onNotice');
    expect(panel).not.toContain('className="friend-message"');
    expect(page).toContain('onNotice={setNotice}');
  });
});

describe('공용 친구 선택 모달', () => {
  it('메인 친구 화면처럼 돋보기 하나와 입력 자동 검색을 사용한다', () => {
    const searchBlock = picker.slice(
      picker.indexOf('<form className="friend-picker-search"'),
      picker.indexOf('<div className="friend-picker-list">'),
    );
    expect(searchBlock.match(/<Search /g)).toHaveLength(1);
    expect(searchBlock).not.toContain('> 찾기</button>');
    expect(picker).toContain('window.setTimeout');
    expect(picker).toContain('clearTimeout');
  });

  it('독립 컴포넌트로 분리해 여러 흐름에서 재사용한다', () => {
    expect(picker).toContain('export function FriendPickerModal');
    expect(panel).not.toContain('FriendPickerModal');
    expect(studio).toContain('<FriendPickerModal');
  });

  it('검색창, 내 친구 전체 목록, 검색 결과, 선택 상태를 한 화면에 보여준다', () => {
    expect(picker).toContain('className="friend-picker-search"');
    expect(picker).toContain('내 친구');
    expect(picker).toContain('검색 결과');
    expect(picker).toContain('className="friend-picker-list"');
    expect(picker).toContain('friend-picker-row');
    expect(picker).toContain('selected');
  });

  it('닉네임 앞부분과 정확한 이메일 검색에 기존 친구 API를 그대로 쓴다', () => {
    expect(picker).toContain("'/api/friends'");
    expect(picker).toContain('/api/friends?q=${encodeURIComponent(');
    expect(picker).toContain("relationship === 'friend'");
  });

  it('선택 전에는 확인 버튼을 비활성화하고 선택 후에만 확정한다', () => {
    expect(picker).toContain('이 친구 선택');
    expect(picker).toContain('취소');
    expect(picker).toContain('disabled={!selectedUserId}');
    expect(picker).toContain('onSelect(');
  });

  it('닫기 버튼, ESC, 바깥 클릭으로 모달을 닫는다', () => {
    expect(picker).toContain('aria-label="친구 선택 닫기"');
    expect(picker).toContain("event.key === 'Escape'");
    expect(picker).toContain("window.addEventListener('keydown'");
    expect(picker).toContain("window.removeEventListener('keydown'");
    expect(picker).toContain('event.target === event.currentTarget');
    expect(picker).toContain('onCancel');
  });

  it('검색 오류는 모달 검색 입력 바로 아래에 표시한다', () => {
    expect(picker).toContain('id="friend-picker-search-error"');
    expect(picker).toContain('className="friend-picker-search-error"');
    expect(picker).toContain("aria-describedby={searchError ? 'friend-picker-search-error' : undefined}");
  });

  it('모바일에서도 화면을 넘지 않고 모달 안에서만 스크롤한다', () => {
    const modal = rule('.friend-picker-modal');
    expect(modal).toContain('max-height');
    expect(modal).toContain('dvh');
    const list = rule('.friend-picker-list');
    expect(list).toContain('overflow-y: auto');
    expect(list).toContain('-webkit-overflow-scrolling: touch');
  });

  it('선택한 친구 행은 눈에 띄게 강조한다', () => {
    expect(rule('.friend-picker-row.selected')).toContain('border-color: var(--sage)');
  });
});

describe('친구 상세 모달과 차단', () => {
  it('상세 모달에 아바타, 닉네임, 마스킹된 이메일과 두 주요 동작을 보여준다', () => {
    const detail = panel.slice(panel.indexOf('friend-detail-backdrop'), panel.indexOf('friend-remove-confirm-backdrop'));
    expect(detail).toContain('friend-row-avatar');
    expect(detail).toContain('detailFriend.nickname');
    expect(detail).toContain('detailFriend.emailHint');
    expect(detail).toContain('선물하기');
    expect(detail).toContain('차단하기');
    expect(detail).toContain('친구 해제');
  });

  it('선물하기는 그 친구를 미리 선택한 채로 선물 제작 흐름을 연다', () => {
    expect(panel).toContain('onGiftFriend');
    expect(panel).toContain('onGiftFriend?.(detailFriend)');
    expect(page).toContain('onGiftFriend={openGiftStudioWithFriend}');
    expect(page).toContain('const openGiftStudioWithFriend');
    expect(page).toContain('initialFriend={giftStudioFriend}');
    expect(studio).toContain('initialFriend');
    expect(studio).toContain('useState<FriendPickerPerson | null>(initialFriend ?? null)');
  });

  it('차단하기는 즉시 실행하지 않고 확인 모달을 먼저 띄운다', () => {
    expect(panel).toContain('setBlockCandidate(detailFriend)');
    expect(panel).toContain('className="friend-block-confirm-backdrop"');
    expect(panel).toContain('confirmBlockFriend');
    expect(panel).toContain("runAction('block'");
    expect(panel).toContain('BLOCK_CONSEQUENCES');
  });

  it('차단 실패는 확인 모달 안 인라인 오류로, 성공은 공용 토스트로 알린다', () => {
    const confirm = panel.slice(panel.indexOf('friend-block-confirm-backdrop'));
    expect(confirm).toContain('className="friend-row-error"');
    expect(panel).toContain("notify('친구를 차단했어요.')");
  });

  it('차단하기는 선물하기보다 약한 위험 동작으로 표시한다', () => {
    const gift = rule('.friend-detail-actions .friend-detail-gift');
    const block = rule('.friend-detail-actions .friend-detail-block');
    expect(gift).toContain('background: var(--action-bg)');
    expect(block).not.toContain('background: var(--action-bg)');
    expect(pixels(block, 'min-height')).toBeLessThanOrEqual(pixels(gift, 'min-height'));
  });
});

describe('차단 목록 관리', () => {
  it('친구 화면에 작은 차단 관리 진입점을 둔다', () => {
    expect(panel).toContain('차단한 친구 관리');
    expect(panel).toContain('className="friend-blocked-entry"');
    expect(pixels(rule('.friend-blocked-entry'), 'min-height')).toBeLessThanOrEqual(40);
  });

  it('별도 모달에서 차단한 사용자와 차단 해제를 제공한다', () => {
    expect(panel).toContain('className="friend-blocked-backdrop"');
    expect(panel).toContain('data.blocked.map');
    expect(panel).toContain('차단 해제');
    expect(panel).toContain("runAction('unblock'");
  });

  it('차단 해제가 친구 관계를 되돌리지 않는다고 안내하고 빈 상태를 보여준다', () => {
    expect(panel).toContain('다시 친구 요청을 보내야');
    expect(panel).toContain('차단한 친구가 없어요');
  });
});

describe('차단 데이터 정책', () => {
  it('차단 관계를 전용 테이블에 영구 저장한다', () => {
    expect(schema).toContain("sqliteTable(\n  'friend_blocks'");
    expect(schema).toContain("blockerKey: text('blocker_key')");
    expect(schema).toContain("blockedKey: text('blocked_key')");
    expect(schema).toContain("createdAt: integer('created_at')");
    expect(schema).toContain("uniqueIndex('idx_friend_blocks_pair')");
    expect(dbIndex).toContain('CREATE TABLE IF NOT EXISTS friend_blocks');
    expect(dbIndex).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_blocks_pair');
  });

  it('기존 마이그레이션을 고치지 않고 새 마이그레이션을 추가한다', () => {
    const files = readdirSync(new URL('../drizzle/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
    const added = files.filter((name) => Number(name.slice(0, 4)) >= 10);
    expect(added.length).toBeGreaterThanOrEqual(1);
    const sql = added.map((name) => readFileSync(new URL(`../drizzle/${name}`, import.meta.url), 'utf8')).join('\n');
    expect(sql).toContain('friend_blocks');
    const untouched = files.filter((name) => Number(name.slice(0, 4)) < 10);
    for (const name of untouched) {
      expect(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), 'utf8')).not.toContain('friend_blocks');
    }
  });

  it('차단 상태를 모든 관련 서버 API에서 다시 검증한다', () => {
    for (const source of [route, giftsRoute, giftDraftsRoute, giftDraftSendRoute]) {
      expect(source).toContain('friend_blocks');
    }
  });
});
