/**
 * THE BRIDGE — Sync Service
 * 
 * Periodically syncs anonymous patient usage data from local queue → backend → S3.
 * Data flow:
 *   Patient uses HealthSathi features → addToBridgeQueue() →
 *   syncService checks every 5 min (if online) → POST /api/bridge/sync →
 *   Backend stores in S3 → Lambda aggregates → Doctor dashboard shows patterns
 */

import {
  getBridgeQueue,
  removeSyncedItems,
  setLastSyncTime,
  getLastSyncTime,
  getBridgeQueueCount,
  type BridgeQueueItem,
} from "./storage";

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const SYNC_BATCH_SIZE = 50; // max items per sync request
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

let syncTimer: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;

// ─── Listeners for UI updates ─────────────────────────────────────────────
type SyncListener = (status: SyncStatus) => void;
const listeners = new Set<SyncListener>();

export interface SyncStatus {
  isSyncing: boolean;
  queueCount: number;
  lastSyncTime: number;
  lastSyncSuccess: boolean;
  error?: string;
}

export function onSyncStatusChange(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners(status: SyncStatus) {
  listeners.forEach(fn => fn(status));
}

// ─── Core sync logic ──────────────────────────────────────────────────────

async function doSync(): Promise<void> {
  if (isSyncing || !navigator.onLine) return;

  const queue = getBridgeQueue();
  if (queue.length === 0) return;

  isSyncing = true;
  notifyListeners({
    isSyncing: true,
    queueCount: queue.length,
    lastSyncTime: getLastSyncTime(),
    lastSyncSuccess: true,
  });

  try {
    // Sync in batches
    const batches: BridgeQueueItem[][] = [];
    for (let i = 0; i < queue.length; i += SYNC_BATCH_SIZE) {
      batches.push(queue.slice(i, i + SYNC_BATCH_SIZE));
    }

    const allSyncedIds: string[] = [];

    for (const batch of batches) {
      const res = await fetch(`${BASE_URL}/api/bridge/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: batch }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        throw new Error(`Sync failed: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      // Backend returns { synced: string[] } — IDs that were successfully stored
      if (data.synced && Array.isArray(data.synced)) {
        allSyncedIds.push(...data.synced);
      } else {
        // If backend doesn't return IDs, assume all were synced
        allSyncedIds.push(...batch.map(item => item.id));
      }
    }

    // Remove synced items from local queue
    if (allSyncedIds.length > 0) {
      removeSyncedItems(allSyncedIds);
    }

    setLastSyncTime();

    notifyListeners({
      isSyncing: false,
      queueCount: getBridgeQueueCount(),
      lastSyncTime: getLastSyncTime(),
      lastSyncSuccess: true,
    });

    console.log(`[Bridge] Synced ${allSyncedIds.length} items to cloud`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown sync error";
    console.warn("[Bridge] Sync failed:", msg);

    notifyListeners({
      isSyncing: false,
      queueCount: getBridgeQueueCount(),
      lastSyncTime: getLastSyncTime(),
      lastSyncSuccess: false,
      error: msg,
    });
  } finally {
    isSyncing = false;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

/** Start the periodic sync service. Call once at app startup. */
export function startSyncService(): void {
  if (syncTimer) return; // already running

  // Try an initial sync after a short delay
  setTimeout(() => doSync(), 10_000);

  // Then sync every 5 minutes
  syncTimer = setInterval(() => doSync(), SYNC_INTERVAL_MS);

  // Also sync when coming back online
  window.addEventListener("online", handleOnline);

  console.log("[Bridge] Sync service started (interval: 5 min)");
}

function handleOnline() {
  console.log("[Bridge] Back online — syncing now");
  setTimeout(() => doSync(), 2000);
}

/** Stop the periodic sync service */
export function stopSyncService(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  window.removeEventListener("online", handleOnline);
  console.log("[Bridge] Sync service stopped");
}

/** Force an immediate sync attempt */
export function forceSyncNow(): Promise<void> {
  return doSync();
}

/** Get current sync status */
export function getSyncStatus(): SyncStatus {
  return {
    isSyncing,
    queueCount: getBridgeQueueCount(),
    lastSyncTime: getLastSyncTime(),
    lastSyncSuccess: true,
  };
}
