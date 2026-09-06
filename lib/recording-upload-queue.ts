export type RecordingUploadJob = {
  id: string;
  ownerKey: string;
  url: string;
  method: 'POST' | 'PUT';
  blob: Blob;
  filename: string;
  fields: Record<string, string>;
  createdAt: number;
};

export type RecordingUploadStore = {
  put: (job: RecordingUploadJob) => Promise<void>;
  delete: (id: string, createdAt: number) => Promise<void>;
  list: (ownerKey: string) => Promise<RecordingUploadJob[]>;
};

export type QueuedRecordingUpload = {
  id: string;
  done: Promise<void>;
};

export class RecordingUploadQueue {
  private readonly running = new Map<string, { createdAt: number; promise: Promise<void> }>();
  private activeUploads = 0;
  private readonly slotWaiters: Array<() => void> = [];

  constructor(
    private readonly ownerKey: string,
    private readonly store: RecordingUploadStore,
    private readonly upload: (job: RecordingUploadJob) => Promise<void>,
    private readonly maxConcurrent = 3,
  ) {}

  async persist(job: RecordingUploadJob) {
    if (job.ownerKey !== this.ownerKey) throw new Error('recording upload owner mismatch');
    await this.store.put(job);
  }

  async enqueue(job: RecordingUploadJob): Promise<QueuedRecordingUpload> {
    await this.persist(job);
    return { id: job.id, done: this.run(job) };
  }

  async flush() {
    const jobs = await this.store.list(this.ownerKey);
    await Promise.all(jobs.map((job) => this.run(job)));
  }

  private run(job: RecordingUploadJob): Promise<void> {
    const active = this.running.get(job.id);
    if (active?.createdAt === job.createdAt) return active.promise;
    if (active) return active.promise.catch(() => undefined).then(() => this.run(job));
    const promise = this.withUploadSlot(() => this.upload(job))
      .then(() => this.store.delete(job.id, job.createdAt))
      .finally(() => {
        if (this.running.get(job.id)?.createdAt === job.createdAt) this.running.delete(job.id);
      });
    this.running.set(job.id, { createdAt: job.createdAt, promise });
    return promise;
  }

  private async withUploadSlot<T>(task: () => Promise<T>) {
    if (this.activeUploads >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.slotWaiters.push(resolve));
    }
    this.activeUploads += 1;
    try {
      return await task();
    } finally {
      this.activeUploads -= 1;
      this.slotWaiters.shift()?.();
    }
  }
}
