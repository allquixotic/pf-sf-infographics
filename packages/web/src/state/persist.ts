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
  updatedAt?: number;
  paizoCredit?: boolean;
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
    const transaction = db.transaction(STORE, mode);
    const req = fn(transaction.objectStore(STORE));
    transaction.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    transaction.onabort = transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? req.error);
    };
  });
}

export async function putArt(item: StoredArt): Promise<boolean> {
  try {
    await tx('readwrite', (s) => s.put({ ...item, updatedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export async function allArt(): Promise<StoredArt[]> {
  try {
    const items = await tx('readonly', (s) => s.getAll() as IDBRequest<StoredArt[]>);
    return items.sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0));
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
