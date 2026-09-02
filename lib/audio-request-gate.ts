export function createLatestAudioRequestGate() {
  let generation = 0;
  return {
    begin() {
      generation += 1;
      return generation;
    },
    cancel() {
      generation += 1;
    },
    isCurrent(requestGeneration: number) {
      return requestGeneration === generation;
    },
  };
}
