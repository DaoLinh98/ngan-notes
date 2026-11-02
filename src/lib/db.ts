import type { Vault } from './types';

/**
 * Persistence is a single sealed blob in IndexedDB, plus the file handle
 * auto-backup writes into. Nothing readable ever touches disk — the store
 * hands us ciphertext and we hand it back.
 */

const DB_NAME = 'ngan';
const STORE = 'vault';
const HANDLE_STORE = 'handles';
const KEY = 'current';
const HANDLE_KEY = 'auto-backup';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(HANDLE_STORE)) db.createObjectStore(HANDLE_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(store, mode);
      const req = run(t.objectStore(store));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export const loadVault = (): Promise<Vault | undefined> =>
  tx<Vault | undefined>(STORE, 'readonly', (s) => s.get(KEY));

export const saveVault = (vault: Vault): Promise<void> =>
  tx<void>(STORE, 'readwrite', (s) => s.put(vault, KEY));

export const clearVault = (): Promise<void> => tx<void>(STORE, 'readwrite', (s) => s.delete(KEY));

/**
 * The file auto-backup overwrites. A handle is structured-cloneable, so it
 * survives a reload — the browser keeps the permission alongside it.
 */
export const loadBackupHandle = (): Promise<FileSystemFileHandle | undefined> =>
  tx<FileSystemFileHandle | undefined>(HANDLE_STORE, 'readonly', (s) => s.get(HANDLE_KEY));

export const saveBackupHandle = (handle: FileSystemFileHandle): Promise<void> =>
  tx<void>(HANDLE_STORE, 'readwrite', (s) => s.put(handle, HANDLE_KEY));

/**
 * Asks the browser to keep this origin's storage rather than evict it when the
 * device runs low on space. Best-effort: a refusal is not an error, it is the
 * reason the file backup exists.
 */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (!navigator.storage?.persist) return;
    if (await navigator.storage.persisted()) return;
    await navigator.storage.persist();
  } catch {
    // Denied, or the API is not available in this browser.
  }
}
