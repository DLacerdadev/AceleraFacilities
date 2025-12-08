import { offlineStorage, type SyncQueueItem } from './offline-storage';
import { apiRequest } from './queryClient';
import { Network } from '@capacitor/network';

interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: Array<{ localId: string; error: string }>;
}

class SyncQueueManager {
  private isProcessing = false;
  private batchSize = 5; // Reduzido para conexões lentas (era 50, agora 5 fotos por vez)

  async processSyncQueue(): Promise<SyncResult> {
    if (this.isProcessing) {
      console.log('[SYNC QUEUE] Already processing, skipping...');
      return { success: true, syncedCount: 0, failedCount: 0, errors: [] };
    }

    this.isProcessing = true;
    console.log('[SYNC QUEUE] Starting sync queue processing...');

    try {
      const result = await this.syncBatch();
      return result;
    } catch (error) {
      console.error('[SYNC QUEUE] Fatal error during sync:', error);
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        errors: [{ localId: 'unknown', error: String(error) }],
      };
    } finally {
      this.isProcessing = false;
    }
  }

  private async syncBatch(): Promise<SyncResult> {
    let totalSynced = 0;
    let totalFailed = 0;
    const allErrors: Array<{ localId: string; error: string }> = [];

    // Process work orders completely first (parent entities)
    console.log('[SYNC QUEUE] Phase 1: Syncing work orders...');
    while (true) {
      const pendingItems = await offlineStorage.getPendingItems();
      
      if (pendingItems.workOrders.length === 0) {
        console.log('[SYNC QUEUE] All work orders synced');
        break;
      }

      console.log(`[SYNC QUEUE] ${pendingItems.workOrders.length} work orders pending`);
      const batch = pendingItems.workOrders.slice(0, this.batchSize);
      const result = await this.syncWorkOrderBatch(batch);
      
      // If transport error occurred (synced=0, failed=0), break and retry later
      if (result.synced === 0 && result.failed === 0) {
        console.log('[SYNC QUEUE] Transport error - aborting sync, will retry later');
        return { success: false, syncedCount: totalSynced, failedCount: totalFailed, errors: allErrors };
      }

      totalSynced += result.synced;
      totalFailed += result.failed;
      allErrors.push(...result.errors);
    }

    // Process checklist executions next (child entities)
    console.log('[SYNC QUEUE] Phase 2: Syncing checklist executions...');
    while (true) {
      const pendingItems = await offlineStorage.getPendingItems();
      
      if (pendingItems.checklistExecutions.length === 0) {
        console.log('[SYNC QUEUE] All executions synced');
        break;
      }

      console.log(`[SYNC QUEUE] ${pendingItems.checklistExecutions.length} executions pending`);
      const batch = pendingItems.checklistExecutions.slice(0, this.batchSize);
      const result = await this.syncExecutionBatch(batch);
      
      if (result.synced === 0 && result.failed === 0) {
        console.log('[SYNC QUEUE] Transport error - aborting sync, will retry later');
        return { success: false, syncedCount: totalSynced, failedCount: totalFailed, errors: allErrors };
      }

      totalSynced += result.synced;
      totalFailed += result.failed;
      allErrors.push(...result.errors);
    }

    // Process attachments last (child entities)
    console.log('[SYNC QUEUE] Phase 3: Syncing attachments...');
    while (true) {
      const pendingItems = await offlineStorage.getPendingItems();
      
      if (pendingItems.attachments.length === 0) {
        console.log('[SYNC QUEUE] All attachments synced');
        break;
      }

      console.log(`[SYNC QUEUE] ${pendingItems.attachments.length} attachments pending`);
      const batch = pendingItems.attachments.slice(0, this.batchSize);
      const result = await this.syncAttachmentBatch(batch);
      
      if (result.synced === 0 && result.failed === 0) {
        console.log('[SYNC QUEUE] Transport error - aborting sync, will retry later');
        return { success: false, syncedCount: totalSynced, failedCount: totalFailed, errors: allErrors };
      }

      totalSynced += result.synced;
      totalFailed += result.failed;
      allErrors.push(...result.errors);
    }

    console.log('[SYNC QUEUE] All phases completed:', { totalSynced, totalFailed });
    return {
      success: totalFailed === 0,
      syncedCount: totalSynced,
      failedCount: totalFailed,
      errors: allErrors,
    };
  }

  private async syncWorkOrderBatch(workOrders: any[]) {
    const payload = {
      workOrders: workOrders.map(wo => ({
        localId: wo.localId,
        title: wo.title,
        description: wo.description,
        type: wo.type,
        priority: wo.priority,
        status: wo.status,
        siteId: wo.siteId,
        zoneId: wo.zoneId,
        assignedTo: wo.assignedTo,
        scheduledDate: wo.scheduledDate,
        dueDate: wo.dueDate,
      })),
      checklistExecutions: [],
      attachments: [],
    };

    try {
      const response = await apiRequest('POST', '/api/sync/batch', payload);
      const data: {
        results: Array<{
          type: string;
          localId: string;
          status: 'success' | 'error';
          serverId?: string;
          error?: string;
        }>;
      } = await response.json();

      let synced = 0;
      let failed = 0;
      const errors: Array<{ localId: string; error: string }> = [];

      // Use Promise.allSettled for parallel processing
      const markResults = await Promise.allSettled(
        data.results.map(async (result) => {
          if (result.status === 'success' && result.serverId) {
            await offlineStorage.markAsSynced('work_order', result.localId, result.serverId);
            return { type: 'synced' as const, localId: result.localId };
          } else {
            // Backend reported hard error - mark as failed
            await offlineStorage.markAsFailed('work_order', result.localId, result.error || 'Unknown error');
            return { type: 'failed' as const, localId: result.localId, error: result.error || 'Unknown error' };
          }
        })
      );

      // Count results and handle rejections
      for (const result of markResults) {
        if (result.status === 'fulfilled') {
          if (result.value.type === 'synced') {
            synced++;
          } else {
            failed++;
            errors.push({ localId: result.value.localId, error: result.value.error });
          }
        } else {
          // Promise rejected - log the error
          console.error('[SYNC QUEUE] markAsSynced/markAsFailed rejected:', result.reason);
          failed++;
          errors.push({ localId: 'unknown', error: String(result.reason) });
        }
      }

      return { synced, failed, errors };
    } catch (error) {
      // Transport/network error - DON'T mark as failed
      // Let OfflineStorageManager's retry logic handle it
      // Items remain in queue and will be retried
      console.error('[SYNC QUEUE] Work order batch sync failed (transport error):', error);
      console.log('[SYNC QUEUE] Items will be retried automatically by sync queue');

      return {
        synced: 0,
        failed: 0, // Don't count as failed - they'll retry
        errors: [], // Don't report errors - this is expected behavior for transport failures
      };
    }
  }

  private async syncExecutionBatch(executions: any[]) {
    const payload = {
      workOrders: [],
      checklistExecutions: executions.map(exec => ({
        localId: exec.localId,
        workOrderId: exec.workOrderId, // May be localId or serverId
        checklistId: exec.checklistId,
        responsibleId: exec.responsibleId,
        completedAt: exec.completedAt,
        photos: exec.photos || [],
        observations: exec.observations,
      })),
      attachments: [],
    };

    try {
      const response = await apiRequest('POST', '/api/sync/batch', payload);
      const data: {
        results: Array<{
          type: string;
          localId: string;
          status: 'success' | 'error';
          serverId?: string;
          error?: string;
        }>;
      } = await response.json();

      let synced = 0;
      let failed = 0;
      const errors: Array<{ localId: string; error: string }> = [];

      const markResults = await Promise.allSettled(
        data.results.map(async (result) => {
          if (result.status === 'success' && result.serverId) {
            await offlineStorage.markAsSynced('checklist_execution', result.localId, result.serverId);
            return { type: 'synced' as const, localId: result.localId };
          } else {
            await offlineStorage.markAsFailed('checklist_execution', result.localId, result.error || 'Unknown error');
            return { type: 'failed' as const, localId: result.localId, error: result.error || 'Unknown error' };
          }
        })
      );

      for (const result of markResults) {
        if (result.status === 'fulfilled') {
          if (result.value.type === 'synced') {
            synced++;
          } else {
            failed++;
            errors.push({ localId: result.value.localId, error: result.value.error });
          }
        } else {
          // Promise rejected - log the error
          console.error('[SYNC QUEUE] markAsSynced/markAsFailed rejected:', result.reason);
          failed++;
          errors.push({ localId: 'unknown', error: String(result.reason) });
        }
      }

      return { synced, failed, errors };
    } catch (error) {
      console.error('[SYNC QUEUE] Execution batch sync failed (transport error):', error);
      console.log('[SYNC QUEUE] Items will be retried automatically by sync queue');

      return {
        synced: 0,
        failed: 0,
        errors: [],
      };
    }
  }

  private async syncAttachmentBatch(attachments: any[]) {
    const payload = {
      workOrders: [],
      checklistExecutions: [],
      attachments: attachments.map(att => ({
        localId: att.localId,
        workOrderId: att.workOrderId, // May be localId or serverId
        fileName: att.fileName,
        fileType: att.mimeType ?? (att.type === 'photo' ? 'image/jpeg' : 'application/octet-stream'),
        fileData: att.url, // Map url → fileData (base64)
        uploadedBy: att.uploadedBy,
        comment: att.comment || '',
      })),
    };

    try {
      const response = await apiRequest('POST', '/api/sync/batch', payload);
      const data: {
        results: Array<{
          type: string;
          localId: string;
          status: 'success' | 'error';
          serverId?: string;
          error?: string;
        }>;
      } = await response.json();

      let synced = 0;
      let failed = 0;
      const errors: Array<{ localId: string; error: string }> = [];

      const markResults = await Promise.allSettled(
        data.results.map(async (result) => {
          if (result.status === 'success' && result.serverId) {
            await offlineStorage.markAsSynced('attachment', result.localId, result.serverId);
            return { type: 'synced' as const, localId: result.localId };
          } else {
            await offlineStorage.markAsFailed('attachment', result.localId, result.error || 'Unknown error');
            return { type: 'failed' as const, localId: result.localId, error: result.error || 'Unknown error' };
          }
        })
      );

      for (const result of markResults) {
        if (result.status === 'fulfilled') {
          if (result.value.type === 'synced') {
            synced++;
          } else {
            failed++;
            errors.push({ localId: result.value.localId, error: result.value.error });
          }
        } else {
          // Promise rejected - log the error
          console.error('[SYNC QUEUE] markAsSynced/markAsFailed rejected:', result.reason);
          failed++;
          errors.push({ localId: 'unknown', error: String(result.reason) });
        }
      }

      return { synced, failed, errors };
    } catch (error) {
      console.error('[SYNC QUEUE] Attachment batch sync failed (transport error):', error);
      console.log('[SYNC QUEUE] Items will be retried automatically by sync queue');

      return {
        synced: 0,
        failed: 0,
        errors: [],
      };
    }
  }

  async isOnline(): Promise<boolean> {
    try {
      const status = await Network.getStatus();
      return status.connected;
    } catch (error) {
      console.warn('[SYNC QUEUE] Network plugin not available, using navigator.onLine', error);
      return navigator.onLine;
    }
  }

  setupAutoSync(): () => void {
    console.log('[SYNC QUEUE] Setting up auto-sync on network reconnection...');
    
    const listenerPromise = Network.addListener('networkStatusChange', async (status) => {
      if (status.connected) {
        console.log('[SYNC QUEUE] Network reconnected - triggering auto-sync...');
        try {
          await this.processSyncQueue();
        } catch (error) {
          console.error('[SYNC QUEUE] Auto-sync failed:', error);
        }
      } else {
        console.log('[SYNC QUEUE] Network disconnected - pausing sync');
      }
    });

    return () => {
      console.log('[SYNC QUEUE] Cleaning up auto-sync listener...');
      listenerPromise.then(handler => handler.remove()).catch(err => {
        console.error('[SYNC QUEUE] Error removing network listener:', err);
      });
    };
  }
}

export const syncQueueManager = new SyncQueueManager();
