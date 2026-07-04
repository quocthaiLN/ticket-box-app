import { getDatabase } from '../db/database';
import { getPendingQueueItems, updateQueueItemStatus } from '../db/queries';
import { syncOfflineQueue } from './api';

export type SyncConfig = {
  apiBaseUrl: string;
  token: string;
  batchToken: string;
  concertId: string;
  gateId: string;
  deviceId: string;
};

export type SyncResult = {
  syncedCount: number;
  conflictCount: number;
  failedCount: number;
  message: string;
};

// Cờ module-level để chặn gọi executeQueueSync đồng thời (race condition)
let isSyncing = false;

export async function executeQueueSync(
  config: SyncConfig
): Promise<SyncResult> {
  // Nếu đang đồng bộ, bỏ qua lần gọi này
  if (isSyncing) {
    return {
      syncedCount: 0,
      conflictCount: 0,
      failedCount: 0,
      message: 'Đang đồng bộ, bỏ qua lần gọi trùng.',
    };
  }
  const db = await getDatabase();
  const pendingItems = await getPendingQueueItems(db);

  if (pendingItems.length === 0) {
    return {
      syncedCount: 0,
      conflictCount: 0,
      failedCount: 0,
      message: 'Không có bản ghi nào cần đồng bộ.',
    };
  }

  // 1. Mark items as "syncing" locally
  for (const item of pendingItems) {
    await updateQueueItemStatus(db, item.client_item_id, 'syncing', null);
  }

  isSyncing = true;
  try {
    // 2. call the backend sync API
    const response = await syncOfflineQueue(
      config.apiBaseUrl,
      config.token,
      config.batchToken,
      config.concertId,
      config.gateId,
      config.deviceId,
      pendingItems.map((item) => ({
        client_item_id: item.client_item_id,
        type: item.type,
        qr_token: item.qr_token,
        qr_payload_hash: item.qr_payload_hash,
        guest_id: item.guest_id,
        phone: item.phone,
        concert_id: item.concert_id,
        gate_id: item.gate_id,
        local_scanned_at: item.scanned_at,
      }))
    );

    let syncedCount = 0;
    let conflictCount = 0;
    let failedCount = 0;

    // 3. Update SQLite queue item statuses based on server results
    await db.withTransactionAsync(async () => {
      for (const result of response.results) {
        let finalStatus = 'failed';
        if (result.status === 'SUCCESS') {
          finalStatus = 'synced';
          syncedCount++;
        } else if (
          result.status === 'ALREADY_CHECKED_IN' ||
          result.status === 'CONFLICT' ||
          result.status === 'DUPLICATE_ITEM'
        ) {
          finalStatus = 'conflict';
          conflictCount++;
        } else {
          finalStatus = 'failed';
          failedCount++;
        }
        await updateQueueItemStatus(
          db,
          result.client_item_id,
          finalStatus,
          result.message
        );
      }
    });

    return {
      syncedCount,
      conflictCount,
      failedCount,
      message: `Đồng bộ hoàn tất: Chấp nhận ${response.accepted_item_count}, Xung đột ${response.conflict_item_count}`,
    };
  } catch (error) {
    // 4. In case of API failure, revert "syncing" items back to "failed" or their previous state
    for (const item of pendingItems) {
      await updateQueueItemStatus(
        db,
        item.client_item_id,
        'failed',
        error instanceof Error ? error.message : 'Lỗi mạng khi đồng bộ.'
      );
    }
    throw error;
  } finally {
    isSyncing = false;
  }
}
