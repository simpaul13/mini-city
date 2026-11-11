import type { Settings } from "./world";

export type Snapshot = {
  settings: Settings;
  placed: [string, { type: string; rotation: number }][];
  deleted: string[];
  camera: number[];
  angle?: number;
  zoom?: number;
};

const DATABASE = "fieldnotes";
const STORE = "worlds";
const KEY = "latest";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open city storage"));
    request.onblocked = () =>
      reject(new Error("City storage upgrade was blocked"));
  });
}

function transactionCompletion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("City storage transaction failed"));
    transaction.onabort = () =>
      reject(
        transaction.error ?? new Error("City storage transaction was aborted"),
      );
  });
}

export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(STORE, "readwrite");
    const completed = transactionCompletion(transaction);
    transaction.objectStore(STORE).put(snapshot, KEY);
    await completed;
  } finally {
    db.close();
  }
}

export async function loadSnapshot(): Promise<Snapshot | undefined> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(STORE, "readonly");
    const completed = transactionCompletion(transaction);
    const request = transaction.objectStore(STORE).get(KEY);
    const value = await new Promise<Snapshot | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as Snapshot | undefined);
      request.onerror = () =>
        reject(request.error ?? new Error("Could not read saved city"));
    });
    await completed;
    return value;
  } finally {
    db.close();
  }
}
