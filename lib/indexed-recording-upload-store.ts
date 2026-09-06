import type { RecordingUploadJob, RecordingUploadStore } from './recording-upload-queue';

const DATABASE_NAME = 'verse-legacy-recording-uploads';
const STORE_NAME = 'jobs';
const DATABASE_VERSION = 1;

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
}

export function createIndexedRecordingUploadStore(factory: IDBFactory = indexedDB): RecordingUploadStore {
  let databasePromise: Promise<IDBDatabase> | null = null;
  const database = () => {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('ownerKey', 'ownerKey', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    });
    return databasePromise;
  };

  return {
    async put(job) {
      const db = await database();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const done = transactionDone(transaction);
      transaction.objectStore(STORE_NAME).put(job);
      await done;
    },
    async delete(id, createdAt) {
      const db = await database();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const done = transactionDone(transaction);
      const store = transaction.objectStore(STORE_NAME);
      const current = await requestResult(store.get(id)) as RecordingUploadJob | undefined;
      if (current?.createdAt === createdAt) store.delete(id);
      await done;
    },
    async list(ownerKey) {
      const db = await database();
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const done = transactionDone(transaction);
      const result = await requestResult(
        transaction.objectStore(STORE_NAME).index('ownerKey').getAll(ownerKey),
      );
      await done;
      return result as RecordingUploadJob[];
    },
  };
}
