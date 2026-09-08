import { expect, it, vi } from 'vitest';
import { createIndexedRecordingUploadStore } from './indexed-recording-upload-store';

it('retries opening IndexedDB after a transient open failure', async () => {
  const requests: IDBOpenDBRequest[] = [];
  const open = vi.fn(() => {
    const request = { error: new DOMException('temporary failure', 'UnknownError') } as IDBOpenDBRequest;
    requests.push(request); return request;
  });
  const factory = { open } as unknown as IDBFactory;
  const store = createIndexedRecordingUploadStore(factory);
  const first = store.list('test-owner');
  requests[0].onerror?.(new Event('error'));
  await expect(first).rejects.toMatchObject({ name: 'UnknownError' });
  const second = store.list('test-owner');
  expect(open).toHaveBeenCalledTimes(2);
  requests[1].onerror?.(new Event('error'));
  await expect(second).rejects.toMatchObject({ name: 'UnknownError' });
});

it('also retries when the browser throws synchronously while opening storage', async () => {
  const open = vi.fn(() => { throw new DOMException('storage unavailable', 'SecurityError'); });
  const store = createIndexedRecordingUploadStore({ open } as unknown as IDBFactory);
  await expect(store.list('test')).rejects.toMatchObject({ name: 'SecurityError' });
  await expect(store.list('test')).rejects.toMatchObject({ name: 'SecurityError' });
  expect(open).toHaveBeenCalledTimes(2);
});
