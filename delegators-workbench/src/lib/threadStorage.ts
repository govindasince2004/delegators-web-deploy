import type { ArtifactDocument } from './shared.js';
import { trimPersistedMessages } from './threadContext.js';

type ArtifactMessage = {
  artifact?: ArtifactDocument;
};

type StorableThread = {
  messages: ArtifactMessage[];
  artifact: ArtifactDocument | null;
  versions: ArtifactDocument[];
  pendingRequest?: unknown;
};

const databaseName = 'delegators-workbench';
const databaseVersion = 1;
const archiveStore = 'thread-archives';
const archiveKey = 'current';

let databasePromise: Promise<IDBDatabase> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

export function prepareThreadArchive<T extends StorableThread>(
  threads: T[],
  includeBinary: boolean
): Array<Omit<T, 'messages' | 'artifact' | 'versions' | 'pendingRequest'> & {
  messages: Array<Omit<T['messages'][number], 'artifact'>>;
  artifact: null;
  versions: ArtifactDocument[];
  pendingRequest?: unknown;
}> {
  return threads.map((thread) => {
    const trimmed = trimPersistedMessages(thread);
    const {
      messages,
      artifact: _artifact,
      versions,
      pendingRequest,
      ...metadata
    } = trimmed;
    return {
      ...metadata,
      messages: messages.map(({ artifact: _messageArtifact, ...message }) => message) as Array<
        Omit<T['messages'][number], 'artifact'>
      >,
      artifact: null,
      versions: includeBinary ? versions : versions.map(stripArtifactAssets),
      pendingRequest: includeBinary ? pendingRequest : stripBinaryArtifactData(pendingRequest)
    };
  });
}

export async function loadThreadArchive(): Promise<unknown[] | null> {
  if (typeof indexedDB === 'undefined') return null;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(archiveStore, 'readonly');
    const request = transaction.objectStore(archiveStore).get(archiveKey);
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : null);
    request.onerror = () => reject(request.error ?? new Error('Could not load the thread archive.'));
  });
}

export function saveThreadArchive(threads: unknown[]): Promise<void> {
  if (typeof indexedDB === 'undefined') return Promise.resolve();
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      const database = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(archiveStore, 'readwrite');
        transaction.objectStore(archiveStore).put(threads, archiveKey);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('Could not save the thread archive.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Thread archive save was aborted.'));
      });
    });
  return writeQueue;
}

function stripArtifactAssets(artifact: ArtifactDocument): ArtifactDocument {
  return {
    ...artifact,
    assets: []
  };
}

function stripBinaryArtifactData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripBinaryArtifactData);
  if (!value || typeof value !== 'object') return value;

  const object = value as Record<string, unknown>;
  const stripped: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(object)) {
    if (key === 'dataBase64' || key === 'dataUri') continue;
    if (key === 'references' && Array.isArray(child)) {
      stripped[key] = child
        .filter((reference) => {
          if (!reference || typeof reference !== 'object') return false;
          return (reference as Record<string, unknown>).kind !== 'file';
        })
        .map(stripBinaryArtifactData);
      continue;
    }
    stripped[key] = key === 'assets' && Array.isArray(child)
      ? []
      : stripBinaryArtifactData(child);
  }
  return stripped;
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(archiveStore)) {
        request.result.createObjectStore(archiveStore);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the thread archive.'));
  });
  return databasePromise;
}
