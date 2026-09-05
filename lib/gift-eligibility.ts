import { getPlanPassageReferences, type ReadingPlanPassage } from './custom-reading-plan';
import { getRequiredJourneyReferences } from './journey-policy';

export type GiftPolicyRecording = {
  id: string;
  projectId: string;
  book: string;
  chapter: number;
  verse: number;
};

export type GiftPolicyProject = {
  id: string;
  title?: string;
  kind?: 'guided' | 'free';
  tasks?: string[];
  dailySchedule?: ReadingPlanPassage[][];
  completedAt?: number;
};

type GiftSelectionInput = {
  recordings: readonly GiftPolicyRecording[];
  projects: readonly GiftPolicyProject[];
  selectedRecordingIds: readonly string[];
  chapterCounts: Readonly<Record<string, readonly number[]>>;
};

export type GiftSelectionResult =
  | { eligible: true; kind: 'journey' | 'chapters'; title: string; orderedRecordingIds: string[] }
  | { eligible: false; reason: string };

export function isFreeRecordingProject(projectId: string) {
  return projectId === 'free-recording' || projectId.startsWith('free-');
}

function recordingReference(recording: Pick<GiftPolicyRecording, 'book' | 'chapter' | 'verse'>) {
  return `${recording.book}-${recording.chapter}-${recording.verse}`;
}

export function getProjectRequiredReferences(project: GiftPolicyProject, chapterCounts: Readonly<Record<string, readonly number[]>>) {
  return project.dailySchedule?.length
    ? getPlanPassageReferences(project.dailySchedule.flat())
    : getRequiredJourneyReferences(project.tasks ?? [], chapterCounts);
}

export function isFreeChapterComplete(
  recordings: readonly GiftPolicyRecording[],
  book: string,
  chapter: number,
  chapterCounts: Readonly<Record<string, readonly number[]>>,
) {
  const verseCount = chapterCounts[book]?.[chapter - 1] ?? 0;
  if (!verseCount) return false;
  const recordedVerses = new Set(recordings
    .filter((recording) => isFreeRecordingProject(recording.projectId) && recording.book === book && recording.chapter === chapter)
    .map((recording) => recording.verse));
  return recordedVerses.size >= verseCount && Array.from({ length: verseCount }, (_, index) => index + 1).every((verse) => recordedVerses.has(verse));
}

export function getCompletedFreeChapterKeys(
  recordings: readonly GiftPolicyRecording[],
  chapterCounts: Readonly<Record<string, readonly number[]>>,
) {
  const candidateKeys = new Set(recordings
    .filter((recording) => isFreeRecordingProject(recording.projectId))
    .map((recording) => `${recording.book}-${recording.chapter}`));
  return new Set([...candidateKeys].filter((key) => {
    const separator = key.lastIndexOf('-');
    return isFreeChapterComplete(recordings, key.slice(0, separator), Number(key.slice(separator + 1)), chapterCounts);
  }));
}

export function isRecordingScopeLocked(
  target: GiftPolicyRecording,
  _recordings: readonly GiftPolicyRecording[],
  projects: readonly GiftPolicyProject[],
  _chapterCounts: Readonly<Record<string, readonly number[]>>,
) {
  const project = projects.find((item) => item.id === target.projectId);
  return Boolean(project?.completedAt);
}

export function evaluateGiftSelection(input: GiftSelectionInput): GiftSelectionResult {
  const selectedIds = new Set(input.selectedRecordingIds);
  const selected = input.recordings.filter((recording) => selectedIds.has(recording.id));
  if (!selectedIds.size || selected.length !== selectedIds.size) return { eligible: false, reason: '선택한 녹음을 찾을 수 없어요.' };

  const first = selected[0];
  const selectedProjectIds = [...new Set(selected.map((recording) => recording.projectId))];
  const finalizedProjects = selectedProjectIds.map((projectId) => input.projects.find((project) => project.id === projectId));
  if (finalizedProjects.every((project): project is GiftPolicyProject => Boolean(project?.completedAt))) {
    const completeRecordingIds = new Set(input.recordings.filter((recording) => selectedProjectIds.includes(recording.projectId)).map((recording) => recording.id));
    if (completeRecordingIds.size === selectedIds.size && [...completeRecordingIds].every((id) => selectedIds.has(id))) {
      const orderedRecordingIds = finalizedProjects.flatMap((project) => {
        const projectRecordings = input.recordings.filter((recording) => recording.projectId === project.id);
        const required = getProjectRequiredReferences(project, input.chapterCounts);
        if (required.size) {
          const byReference = new Map(projectRecordings.map((recording) => [recordingReference(recording), recording.id]));
          return [...required].map((reference) => byReference.get(reference)).filter((id): id is string => Boolean(id));
        }
        return projectRecordings.slice().sort((a, b) => a.chapter - b.chapter || a.verse - b.verse).map((recording) => recording.id);
      });
      return {
        eligible: true,
        kind: 'journey',
        title: finalizedProjects.length === 1 ? finalizedProjects[0].title ?? '완료된 말씀' : `완료된 말씀 ${finalizedProjects.length}개`,
        orderedRecordingIds,
      };
    }
    return { eligible: false, reason: '완료된 말씀은 묶음 전체를 선택해 주세요.' };
  }
  if (!isFreeRecordingProject(first.projectId)) {
    if (selected.some((recording) => recording.projectId !== first.projectId)) return { eligible: false, reason: '하나의 말씀 여정만 선물할 수 있어요.' };
    const project = input.projects.find((item) => item.id === first.projectId && item.kind !== 'free');
    if (!project) return { eligible: false, reason: '말씀 여정 정보를 찾을 수 없어요.' };
    const required = getProjectRequiredReferences(project, input.chapterCounts);
    const byReference = new Map(input.recordings
      .filter((recording) => recording.projectId === project.id)
      .map((recording) => [recordingReference(recording), recording]));
    if (!required.size || [...required].some((reference) => !byReference.has(reference))) {
      return { eligible: false, reason: '말씀 여정을 모두 완료한 뒤 선물할 수 있어요.' };
    }
    const ordered = [...required]
      .map((reference) => byReference.get(reference)!)
      .filter((recording) => selectedIds.has(recording.id));
    return { eligible: true, kind: 'journey', title: project.title ?? '말씀 여정', orderedRecordingIds: ordered.map((recording) => recording.id) };
  }

  if (selected.some((recording) => !isFreeRecordingProject(recording.projectId) || recording.book !== first.book)) {
    return { eligible: false, reason: '성경책이 다른 녹음은 한 선물로 묶을 수 없어요.' };
  }
  const chapters = [...new Set(selected.map((recording) => recording.chapter))].sort((a, b) => a - b);
  if (chapters.some((chapter) => !isFreeChapterComplete(input.recordings, first.book, chapter, input.chapterCounts))) {
    return { eligible: false, reason: '한 장을 모두 녹음한 뒤 선물할 수 있어요.' };
  }
  const ordered = input.recordings
    .filter((recording) => isFreeRecordingProject(recording.projectId) && recording.book === first.book && chapters.includes(recording.chapter))
    .sort((a, b) => a.chapter - b.chapter || a.verse - b.verse);
  if (ordered.length !== selected.length || ordered.some((recording) => !selectedIds.has(recording.id))) {
    return { eligible: false, reason: '선택한 장의 모든 절을 함께 보내 주세요.' };
  }
  const unit = first.book === '시편' ? '편' : '장';
  const totalChapters = input.chapterCounts[first.book]?.length ?? 0;
  const title = chapters.length === totalChapters
    ? `${first.book} 전체`
    : chapters.length === 1
      ? `${first.book} ${chapters[0]}${unit}`
      : chapters.every((chapter, index) => index === 0 || chapter === chapters[index - 1] + 1)
        ? `${first.book} ${chapters[0]}–${chapters.at(-1)}${unit}`
        : `${first.book} ${chapters.map((chapter) => `${chapter}${unit}`).join(' · ')}`;
  return { eligible: true, kind: 'chapters', title, orderedRecordingIds: ordered.map((recording) => recording.id) };
}
