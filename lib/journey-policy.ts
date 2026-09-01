type JourneyIdentity = { id: string };
type JourneyRecording = { id: string; projectId: string };

export function getJourneyRecordingIds(recordings: readonly JourneyRecording[], journeyId: string) {
  return recordings.filter((recording) => recording.projectId === journeyId).map((recording) => recording.id);
}

export function removeJourney<T extends JourneyIdentity>(journeys: readonly T[], journeyId: string) {
  return journeys.filter((journey) => journey.id !== journeyId);
}
