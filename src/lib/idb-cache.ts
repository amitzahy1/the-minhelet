// ============================================================================
// WC2026 — IndexedDB offline cache
// Persists betting state locally so bets survive connectivity loss.
// Runs as a background write — never blocks the UI path.
// ============================================================================

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "wc2026-offline";
const DB_VERSION = 1;
const STORE = "bets";
const KEY = "current";

interface CachedBets {
  groups: unknown;
  knockout: unknown;
  specialBets: unknown;
  cachedAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
}

export async function writeBetsToIDB(data: Omit<CachedBets, "cachedAt">): Promise<void> {
  try {
    const db = await getDB();
    await db.put(STORE, { ...data, cachedAt: Date.now() }, KEY);
  } catch {
    // IDB not available (private mode, storage quota, etc.) — silently skip
  }
}

export async function readBetsFromIDB(): Promise<CachedBets | null> {
  try {
    const db = await getDB();
    return (await db.get(STORE, KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function clearBetsFromIDB(): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(STORE, KEY);
  } catch { /* ignore */ }
}

export function isIDBSupported(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}
