'use client';

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
  const response = await fetch(job.url, { method: job.method, body: form });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? '녹음을 클라우드에 저장하지 못했어요.');
  }
}

export function getBrowserRecordingUploadQueue(ownerKey: string) {
  const existing = queues.get(ownerKey);
  if (existing) return existing;
  const queue = new RecordingUploadQueue(
    ownerKey,
    createIndexedRecordingUploadStore(),
    uploadRecordingJob,
  );
  queues.set(ownerKey, queue);
  return queue;
}
