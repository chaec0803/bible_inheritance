// Keep failed writes until the session's final save check observes them.
// Successful writes can leave the set once the local copy is durable.
export function trackRecordingPersistence(pending: Set<Promise<void>>, task: Promise<void>) {
  pending.add(task);
  void task.then(
    () => pending.delete(task),
    () => undefined,
  );
  return task;
}
