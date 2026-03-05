/**
 * localStorage persistence for HealthSathi scan results, reports, etc.
 * + BRIDGE sync queue: anonymous patient data queued locally → synced to cloud when online.
 */

// ═════════════════════════════════════════════════════════════════════════════
// SAVED SCANS (user-facing history)
// ═════════════════════════════════════════════════════════════════════════════

export interface SavedScan {
  id: string;
  type: "medicine" | "prescription" | "lab-report" | "counterfeit" | "interaction" | "symptom";
  title: string;
  summary: string;
  timestamp: number;
  data: Record<string, unknown>;
}

const STORAGE_KEY = "hs_saved_scans";

function loadAll(): SavedScan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedScan[]) : [];
  } catch {
    return [];
  }
}

function saveAll(scans: SavedScan[]) {
  try {
    const trimmed = scans.slice(-50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    try {
      const trimmed = scans.slice(-20);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch { /* give up silently */ }
  }
}

export function saveScan(scan: Omit<SavedScan, "id" | "timestamp">): void {
  const all = loadAll();
  const entry: SavedScan = {
    ...scan,
    id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
  };
  all.push(entry);
  saveAll(all);
}

export function getSavedScans(type?: SavedScan["type"]): SavedScan[] {
  const all = loadAll();
  if (type) return all.filter(s => s.type === type).reverse();
  return all.reverse();
}

export function deleteScan(id: string): void {
  const all = loadAll().filter(s => s.id !== id);
  saveAll(all);
}

export function clearAllScans(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ═════════════════════════════════════════════════════════════════════════════
// BRIDGE SYNC QUEUE — anonymous patient usage data → cloud aggregation
// ═════════════════════════════════════════════════════════════════════════════

export type BridgeEventType =
  | "medicine_scan"
  | "symptom_check"
  | "counterfeit_check"
  | "prescription_read"
  | "lab_report"
  | "interaction_check";

export interface BridgeQueueItem {
  id: string;
  type: BridgeEventType;
  timestamp: number;
  /** Approximate region — village/district name (no personal info) */
  region: string;
  /** Anonymous keywords: medicine names, symptom keywords, etc. */
  keywords: string[];
  /** Additional anonymous metadata */
  meta: Record<string, unknown>;
}

const BRIDGE_QUEUE_KEY = "hs_bridge_queue";
const BRIDGE_REGION_KEY = "hs_user_region";
const BRIDGE_LAST_SYNC_KEY = "hs_bridge_last_sync";

function loadBridgeQueue(): BridgeQueueItem[] {
  try {
    const raw = localStorage.getItem(BRIDGE_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as BridgeQueueItem[]) : [];
  } catch {
    return [];
  }
}

function saveBridgeQueue(items: BridgeQueueItem[]) {
  try {
    // Keep max 200 items (if sync is delayed)
    const trimmed = items.slice(-200);
    localStorage.setItem(BRIDGE_QUEUE_KEY, JSON.stringify(trimmed));
  } catch {
    try {
      localStorage.setItem(BRIDGE_QUEUE_KEY, JSON.stringify(items.slice(-50)));
    } catch { /* silently fail */ }
  }
}

/** Get/set the user's approximate region (village or district name) */
export function getUserRegion(): string {
  return localStorage.getItem(BRIDGE_REGION_KEY) || "Unknown";
}

export function setUserRegion(region: string): void {
  localStorage.setItem(BRIDGE_REGION_KEY, region);
}

/**
 * Add an anonymous event to the Bridge sync queue.
 * This data will be synced to the cloud when online and aggregated
 * for doctor dashboards (disease pattern detection, outbreak alerts).
 */
export function addToBridgeQueue(
  type: BridgeEventType,
  keywords: string[],
  meta: Record<string, unknown> = {}
): void {
  const queue = loadBridgeQueue();
  const item: BridgeQueueItem = {
    id: `bridge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    timestamp: Date.now(),
    region: getUserRegion(),
    keywords: keywords.map(k => k.toLowerCase().trim()).filter(Boolean),
    meta,
  };
  queue.push(item);
  saveBridgeQueue(queue);
}

/** Get all items currently waiting to be synced */
export function getBridgeQueue(): BridgeQueueItem[] {
  return loadBridgeQueue();
}

/** Get the number of items in the sync queue */
export function getBridgeQueueCount(): number {
  return loadBridgeQueue().length;
}

/** Remove synced items from the queue by their IDs */
export function removeSyncedItems(syncedIds: string[]): void {
  const idSet = new Set(syncedIds);
  const remaining = loadBridgeQueue().filter(item => !idSet.has(item.id));
  saveBridgeQueue(remaining);
}

/** Clear entire Bridge queue (e.g., after a full successful sync) */
export function clearBridgeQueue(): void {
  localStorage.removeItem(BRIDGE_QUEUE_KEY);
}

/** Get timestamp of last successful sync */
export function getLastSyncTime(): number {
  const raw = localStorage.getItem(BRIDGE_LAST_SYNC_KEY);
  return raw ? parseInt(raw, 10) : 0;
}

/** Record a successful sync */
export function setLastSyncTime(ts: number = Date.now()): void {
  localStorage.setItem(BRIDGE_LAST_SYNC_KEY, String(ts));
}
