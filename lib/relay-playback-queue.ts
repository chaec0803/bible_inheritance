export type RelayPlaybackRow = {
  id: string;
  turnIndex: number;
  ownerNickname: string;
  book: string;
  chapter: number;
  verse: number;
  verseText: string;
  bgmId: string;
  durationSeconds: number;
  passagesJson: string;
};

type Passage = { name: string; chapter: number; startVerse: number; endVerse: number };

function passagePosition(row: RelayPlaybackRow) {
  try {
    const passages = JSON.parse(row.passagesJson) as Passage[];
    const index = passages.findIndex((passage) =>
      passage.name === row.book &&
      passage.chapter === row.chapter &&
      row.verse >= passage.startVerse &&
      row.verse <= passage.endVerse,
    );
    return index < 0 ? null : index;
  } catch {
    return null;
  }
}

export function buildRelayPlaybackQueue({ status, currentTurnIndex, rows }: {
  status: string;
  currentTurnIndex: number | null;
  rows: readonly RelayPlaybackRow[];
}) {
  const lastAllowedTurn = status === 'completed' ? Number.MAX_SAFE_INTEGER : currentTurnIndex;
  if (lastAllowedTurn === null) return [];
  return rows
    .map((row) => ({ row, passageIndex: passagePosition(row) }))
    .filter((item) => item.passageIndex !== null && item.row.turnIndex <= lastAllowedTurn)
    .sort((a, b) =>
      a.row.turnIndex - b.row.turnIndex ||
      a.passageIndex! - b.passageIndex! ||
      a.row.chapter - b.row.chapter ||
      a.row.verse - b.row.verse,
    )
    .map((item) => item.row);
}
