'use client';

import { reportRecordingFailure } from './recording-diagnostics';
import { createIndexedRecordingUploadStore } from './indexed-recording-upload-store';
import {
  RecordingUploadQueue,
  type RecordingUploadJob,
} from './recording-upload-queue';

const queues = new Map<string, RecordingUploadQueue>();

async function uploadRecordingJob(job: RecordingUploadJob) {
  const form = new FormData();
  form.append('audio', new File([job.blob], job.filename, { type: job.blob.type || 'audio/webm' }));
  Object.entries(job.fields).forEach(([key, value]) => form.append(key, value));
  const response = await fetch(job.url, { method: job.method, body: form }).catch(error => {
    reportRecordingFailure('upload', error, { sizeBytes: job.blob.size });
    throw error;
  });
  if (!response.ok) {
    reportRecordingFailure('upload', undefined, { status: response.status, sizeBytes: job.blob.size, requestId: response.headers.get('X-Recording-Request-Id') ?? undefined });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? '녹음을 클라우드에 저장하지 못했어요.');
  }
}

export function getBrowserRecordingUploadQueue(ownerKey: string) {
  const existing = queues.get(ownerKey);
  if (existing) return existing;
  const store = createIndexedRecordingUploadStore();
  const queue = new RecordingUploadQueue(
    ownerKey,
    {
      put: job => store.put(job).catch(error => { reportRecordingFailure('local-save', error, { sizeBytes: job.blob.size }); throw error; }),
      list: owner => store.list(owner).catch(error => { reportRecordingFailure('local-read', error); throw error; }),
      delete: (id, createdAt) => store.delete(id, createdAt).catch(error => { reportRecordingFailure('local-delete', error); throw error; }),
    },
    uploadRecordingJob,
  );
  queues.set(ownerKey, queue);
  return queue;
}
