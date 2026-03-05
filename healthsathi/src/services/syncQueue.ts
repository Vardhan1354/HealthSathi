// ─── Offline Sync Service ────────────────────────────────────────────────────
// Queues actions while offline, flushes when back online.
// Usage:
//   import { queueSync } from '../services/syncQueue';
//   queueSync({ type: 'medicine_scan', data: { ... } });

import { syncOfflineQueue } from './api';
import type { SyncItem } from './api';

const QUEUE_KEY = 'hs_sync_queue';

function loadQueue(): SyncItem[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(q: SyncItem[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function queueSync(
  item: Omit<SyncItem, 'id' | 'timestamp'> & { priority?: SyncItem['priority'] }
): void {
  const q = loadQueue();
  q.push({
    ...item,
    id:        `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    priority:  item.priority ?? 'medium',
    timestamp: Date.now(),
  } as SyncItem);
  saveQueue(q);
}

export function getQueueLength(): number {
  return loadQueue().length;
}

export async function flushQueue(userId: string): Promise<void> {
  const q = loadQueue();
  if (!q.length) return;

  try {
    const result = await syncOfflineQueue(userId, q);
    // Remove successfully synced items from queue
    const failedIds = new Set(result.errors.map(e => e.id));
    const remaining = q.filter(item => failedIds.has(item.id));
    saveQueue(remaining);
    console.log(`[Sync] Flushed ${q.length - remaining.length}/${q.length} items`);
  } catch (err) {
    console.warn('[Sync] Flush failed, will retry later:', err);
  }
}

// Auto-flush when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    const userId = localStorage.getItem('hs_user_id');
    if (userId) flushQueue(userId).catch(console.warn);
  });
}
