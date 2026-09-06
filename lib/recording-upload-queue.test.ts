import { describe, expect, it, vi } from 'vitest';
import {
  RecordingUploadQueue,
  type RecordingUploadJob,
  type RecordingUploadStore,
} from './recording-upload-queue';

function makeStore(initial: RecordingUploadJob[] = []) {
  const jobs = new Map(initial.map((job) => [job.id, job]));
  const store: RecordingUploadStore = {
    put: vi.fn(async (job) => { jobs.set(job.id, job); }),
    delete: vi.fn(async (id, createdAt) => {
      if (jobs.get(id)?.createdAt === createdAt) jobs.delete(id);
    }),
    list: vi.fn(async (ownerKey) => [...jobs.values()].filter((job) => job.ownerKey === ownerKey)),
  };
  return { store, jobs };
}

function job(id = 'recording-1'): RecordingUploadJob {
  return {
    id,
    ownerKey: 'user-a',
    url: '/api/recordings',
    method: 'POST',
    blob: new Blob(['voice'], { type: 'audio/webm' }),
    filename: `${id}.webm`,
    fields: { book: '시편', chapter: '23', verse: '1' },
    createdAt: 1,
  };
}

describe('durable recording upload queue', () => {
  it('로컬 store에 먼저 저장한 뒤 upload을 background로 시작한다', async () => {
    const order: string[] = [];
    const { store } = makeStore();
    vi.mocked(store.put).mockImplementation(async () => { order.push('stored'); });
    let finishUpload!: () => void;
    const upload = vi.fn(() => new Promise<void>((resolve) => {
      order.push('upload-started');
      finishUpload = resolve;
    }));
    const queue = new RecordingUploadQueue('user-a', store, upload);

    const queued = await queue.enqueue(job());

    expect(order).toEqual(['stored', 'upload-started']);
    expect(queued.id).toBe('recording-1');
    expect(store.delete).not.toHaveBeenCalled();
    finishUpload();
    await queued.done;
    expect(store.delete).toHaveBeenCalledWith('recording-1', 1);
  });

  it('업로드 실패 job은 로컬에 남겨 나중에 다시 시도한다', async () => {
    const saved = job('retry-me');
    const { store, jobs } = makeStore([saved]);
    const upload = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const queue = new RecordingUploadQueue('user-a', store, upload);

    await expect(queue.flush()).rejects.toThrow('offline');
    expect(jobs.has(saved.id)).toBe(true);
    await queue.flush();
    expect(jobs.has(saved.id)).toBe(false);
  });

  it('같은 절 job을 다시 enqueue하면 로컬 원본을 최신 녹음으로 교체한다', async () => {
    const { store, jobs } = makeStore();
    const queue = new RecordingUploadQueue('user-a', store, async () => undefined);
    const first = job('same-verse');
    const second = { ...first, blob: new Blob(['new voice']), createdAt: 2 };

    await queue.persist(second);

    expect(jobs.get('same-verse')?.createdAt).toBe(2);
  });

  it('이전 업로드 중 같은 절을 재녹음해도 최신 job을 지우지 않고 다음에 업로드한다', async () => {
    const { store, jobs } = makeStore();
    let finishFirst!: () => void;
    const uploadedAt: number[] = [];
    const upload = vi.fn((value: RecordingUploadJob) => {
      uploadedAt.push(value.createdAt);
      if (value.createdAt === 1) return new Promise<void>((resolve) => { finishFirst = resolve; });
      return Promise.resolve();
    });
    const queue = new RecordingUploadQueue('user-a', store, upload);
    const first = queue.enqueue(job('same'));
    await Promise.resolve();
    const second = queue.enqueue({ ...job('same'), createdAt: 2 });

    await first;
    expect(jobs.get('same')?.createdAt).toBe(2);
    finishFirst();
    await (await second).done;

    expect(uploadedAt).toEqual([1, 2]);
    expect(jobs.has('same')).toBe(false);
  });

  it('resume은 이전 세션에 남은 job을 모두 재전송한다', async () => {
    const { store, jobs } = makeStore([job('a'), job('b')]);
    const upload = vi.fn(async (_job: RecordingUploadJob) => undefined);
    const queue = new RecordingUploadQueue('user-a', store, upload);

    await queue.flush();

    expect(upload.mock.calls.map(([value]) => value.id).sort()).toEqual(['a', 'b']);
    expect(jobs.size).toBe(0);
  });

  it('다른 계정의 로컬 job은 조회하거나 업로드하지 않는다', async () => {
    const other = { ...job('other'), ownerKey: 'user-b' };
    const { store, jobs } = makeStore([other]);
    const upload = vi.fn(async (_job: RecordingUploadJob) => undefined);
    const queue = new RecordingUploadQueue('user-a', store, upload);

    await queue.flush();

    expect(upload).not.toHaveBeenCalled();
    expect(jobs.has(other.id)).toBe(true);
  });

  it('백그라운드 업로드를 제한해 여러 절 저장이 네트워크를 독점하지 않는다', async () => {
    const { store } = makeStore();
    let active = 0;
    let maxActive = 0;
    const releases: Array<() => void> = [];
    const upload = vi.fn(() => new Promise<void>((resolve) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      releases.push(() => { active -= 1; resolve(); });
    }));
    const queue = new RecordingUploadQueue('user-a', store, upload, 2);

    const queued = await Promise.all([0, 1, 2, 3].map((index) => queue.enqueue(job(`job-${index}`))));
    expect(maxActive).toBe(2);
    releases.splice(0, 2).forEach((release) => release());
    await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(4));
    expect(maxActive).toBe(2);
    releases.splice(0).forEach((release) => release());
    await Promise.all(queued.map(({ done }) => done));
  });
});
