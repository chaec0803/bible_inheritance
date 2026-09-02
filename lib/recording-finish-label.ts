type RecordingFinishLabelOptions = {
  isLastVerse: boolean;
  isDailyJourney: boolean;
  book: string;
  chapter: number;
};

export function getRecordingFinishLabel({ isLastVerse, isDailyJourney, book, chapter }: RecordingFinishLabelOptions) {
  if (!isLastVerse) return '여기까지 녹음';
  if (isDailyJourney) return '오늘 말씀 완료';
  return `${book} ${chapter}${book === '시편' ? '편' : '장'} 완료`;
}
