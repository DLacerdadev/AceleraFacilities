import { offlineStorage } from './offline-storage';
import type { CachedQRPoint, CachedZone, CachedScheduledWorkOrder, CachedChecklistTemplate } from './offline-storage';

/**
 * QR Metadata Synchronization Manager
 * 
 * Handles automatic syncing of QR points, zones, scheduled work orders,
 * and checklist templates for offline QR code scanning and execution.
 * 
 * Triggered on:
 * - App init/login
 * - Network reconnect
 * - Manual refresh
 */

interface QRMetadataResponse {
  qrPoints: Omit<CachedQRPoint, 'lastSynced'>[];
  zones: Omit<CachedZone, 'lastSynced'>[];
  scheduledWorkOrders: Omit<CachedScheduledWorkOrder, 'lastSynced'>[];
  checklistTemplates: Omit<CachedChecklistTemplate, 'lastSynced'>[];
  timestamp: number;
  count: {
    qrPoints: number;
    zones: number;
    scheduledWorkOrders: number;
    checklistTemplates: number;
  };
}

export class QRMetadataSyncManager {
  private isSyncing = false;
  private lastSyncAttempt: number | null = null;
  private syncIntervalMs = 15 * 60 * 1000; // 15 minutes

  /**
   * Sync QR metadata for a specific customer and module
   */
  async syncMetadata(
    customerId: string,
    module?: 'clean' | 'maintenance'
  ): Promise<{ success: boolean; error?: string }> {
    // Prevent concurrent syncs
    if (this.isSyncing) {
      console.log('[QR METADATA SYNC] Sync already in progress, skipping...');
      return { success: false, error: 'Sync already in progress' };
    }

    // Rate limiting: don't sync more than once per minute
    const now = Date.now();
    if (this.lastSyncAttempt && (now - this.lastSyncAttempt) < 60000) {
      console.log('[QR METADATA SYNC] Rate limited, last sync was less than 1 minute ago');
      return { success: false, error: 'Rate limited' };
    }

    this.isSyncing = true;
    this.lastSyncAttempt = now;

    try {
      console.log(`[QR METADATA SYNC] Starting sync for customer ${customerId}, module: ${module || 'all'}`);

      // Build URL with module filter
      const url = `/api/customers/${customerId}/qr-metadata/bulk${module ? `?module=${module}` : ''}`;

      // Fetch metadata from backend
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: QRMetadataResponse = await response.json();

      console.log(`[QR METADATA SYNC] Received ${data.count.qrPoints} QR points, ${data.count.zones} zones, ${data.count.scheduledWorkOrders} work orders, ${data.count.checklistTemplates} checklist templates`);

      // Cache all metadata in parallel
      await Promise.all([
        // Cache QR points
        data.qrPoints.length > 0 
          ? offlineStorage.cacheQRPointsBulk(data.qrPoints)
          : Promise.resolve(),
        
        // Cache zones
        data.zones.length > 0 
          ? offlineStorage.cacheZonesBulk(data.zones)
          : Promise.resolve(),
        
        // Cache scheduled work orders
        data.scheduledWorkOrders.length > 0 
          ? offlineStorage.cacheScheduledWorkOrdersBulk(data.scheduledWorkOrders)
          : Promise.resolve(),
        
        // Cache checklist templates
        data.checklistTemplates.length > 0 
          ? offlineStorage.cacheChecklistTemplatesBulk(data.checklistTemplates)
          : Promise.resolve(),
      ]);

      console.log(`[QR METADATA SYNC] ✅ Sync completed successfully at ${new Date(data.timestamp).toISOString()}`);
      console.log(`[QR METADATA SYNC] Cached: ${data.count.qrPoints} QR points, ${data.count.zones} zones, ${data.count.scheduledWorkOrders} WOs, ${data.count.checklistTemplates} templates`);

      return { success: true };
    } catch (error) {
      console.error('[QR METADATA SYNC] ❌ Sync failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Get last sync timestamp from cache
   */
  async getLastSyncTimestamp(): Promise<number | null> {
    try {
      return await offlineStorage.getLastSyncTimestamp();
    } catch (error) {
      console.error('[QR METADATA SYNC] Failed to get last sync timestamp:', error);
      return null;
    }
  }

  /**
   * Check if cache is stale (older than sync interval)
   */
  async isCacheStale(): Promise<boolean> {
    const lastSync = await this.getLastSyncTimestamp();
    if (!lastSync) return true; // No cache = stale

    const now = Date.now();
    const ageMs = now - lastSync;
    return ageMs > this.syncIntervalMs;
  }

  /**
   * Format last sync time for UI display
   */
  async getLastSyncTimeFormatted(): Promise<string> {
    const lastSync = await this.getLastSyncTimestamp();
    if (!lastSync) return 'Nunca sincronizado';

    const now = Date.now();
    const diffMs = now - lastSync;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Agora';
    if (diffMinutes < 60) return `Há ${diffMinutes} min`;
    if (diffHours < 24) return `Há ${diffHours}h`;
    return `Há ${diffDays} dias`;
  }
}

// Singleton instance
export const qrMetadataSync = new QRMetadataSyncManager();

/**
 * Hook-friendly wrapper for sync operations
 */
export function useQRMetadataSync() {
  return {
    syncMetadata: qrMetadataSync.syncMetadata.bind(qrMetadataSync),
    getLastSyncTimestamp: qrMetadataSync.getLastSyncTimestamp.bind(qrMetadataSync),
    isCacheStale: qrMetadataSync.isCacheStale.bind(qrMetadataSync),
    getLastSyncTimeFormatted: qrMetadataSync.getLastSyncTimeFormatted.bind(qrMetadataSync),
  };
}
