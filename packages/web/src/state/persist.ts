/**
 * Per-browser persistence. Settings go to localStorage; art the user supplied (the Paizo zips can be 30–45 MB) goes
 * to IndexedDB so it does not need to be dropped in again. Both can be unavailable (private windows, blocked
 * storage), so every call fails soft.
 */

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked; settings simply won't persist.
  }
}

export interface StoredArt {
  key: string;
  kind: 'zip' | 'image';
  game?: string;
  name: string;
  bytes: ArrayBuffer;
}

const DB = 'pfsf-art';
const STORE = 'files';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putArt(item: StoredArt): Promise<void> {
  try {
    await tx('readwrite', (s) => s.put(item));
  } catch {
    // Not persisted; the art still works for this session.
  }
}

export async function allArt(): Promise<StoredArt[]> {
  try {
    return await tx('readonly', (s) => s.getAll() as IDBRequest<StoredArt[]>);
  } catch {
    return [];
  }
}

export async function clearArt(): Promise<void> {
  try {
    await tx('readwrite', (s) => s.clear());
  } catch {
    // Nothing stored.
  }
}
