/**
 * Offline Execution Normalizer
 * 
 * Hydrates cached QR point, zones, scheduled work orders, and checklist templates
 * from IndexedDB to match the API response format expected by qr-execution.tsx.
 * 
 * Pattern: Cache-first normalization for offline-first execution.
 */

import { OfflineStorageManager } from "./offline-storage";

/**
 * API-compatible response structure for QR execution
 * Matches the expected contract from /api/qr-execution endpoint
 */
export interface NormalizedQRData {
  point: {
    id: string;
    code: string;
    name: string;
    description?: string;
    customerId: string;
    zoneId: string;
    module: 'clean' | 'maintenance';
  };
  hasScheduledActivity: boolean;
  scheduledWorkOrder: {
    id: string;
    title: string;
    description?: string;
    priority?: string;
    slaCompleteMinutes?: number;
  } | null;
  checklist: Array<{
    id: string;
    label: string;
    type: string;
    required: boolean;
  }> | null;
  zone: {
    id: string;
    name: string;
    areaM2?: number;
    siteId: string;
    module: 'clean' | 'maintenance';
  };
  site?: {
    id: string;
    name: string;
  };
  customer?: {
    id: string;
    name?: string;
  };
  company?: {
    id: string;
    name?: string;
  };
}

export class OfflineExecutionNormalizer {
  private storage: OfflineStorageManager;

  constructor() {
    this.storage = new OfflineStorageManager();
  }

  /**
   * Normalize cached data for QR code execution
   * Returns API-compatible structure matching /api/qr-execution response
   * Returns null if QR code not found in cache
   */
  async normalizeForQRCode(qrCode: string): Promise<NormalizedQRData | null> {
    try {
      // 1. Get cached QR point
      const qrPoint = await this.storage.getQRPointByCode(qrCode);
      if (!qrPoint) {
        console.log(`[NORMALIZER] QR code ${qrCode} not found in cache`);
        return null;
      }

      // 2. Get cached zone (graceful degradation if missing)
      const zone = await this.storage.getZone(qrPoint.zoneId);
      if (!zone) {
        console.warn(`[NORMALIZER] Zone ${qrPoint.zoneId} not found in cache - degrading gracefully`);
      }

      // 3. Get scheduled work orders for this QR code
      const scheduledWorkOrders = await this.storage.getScheduledWorkOrdersByQRCode(qrCode);
      console.log(`[NORMALIZER] Found ${scheduledWorkOrders.length} scheduled WOs for QR ${qrCode}`);

      // 4. Select primary scheduled work order (if any)
      // Prioritization: scheduledStartAt (ascending) → createdAt (ascending) → id (stable)
      let primaryWorkOrder = null;
      let primaryChecklist = null;
      
      if (scheduledWorkOrders.length > 0) {
        // Deterministic sort with temporal prioritization
        const sorted = [...scheduledWorkOrders].sort((a, b) => {
          // 1st priority: scheduledStartAt (earliest first)
          // Coerce to string for comparison (handles both string and Date)
          const aStart = a.scheduledStartAt ? String(a.scheduledStartAt) : undefined;
          const bStart = b.scheduledStartAt ? String(b.scheduledStartAt) : undefined;
          
          if (aStart && bStart) {
            const cmp = aStart.localeCompare(bStart);
            if (cmp !== 0) return cmp;
          } else if (aStart) {
            return -1; // a has schedule, b doesn't - prioritize a
          } else if (bStart) {
            return 1; // b has schedule, a doesn't - prioritize b
          }
          
          // 2nd priority: createdAt (earliest first)
          const aCreated = a.createdAt ? String(a.createdAt) : undefined;
          const bCreated = b.createdAt ? String(b.createdAt) : undefined;
          
          if (aCreated && bCreated) {
            const cmp = aCreated.localeCompare(bCreated);
            if (cmp !== 0) return cmp;
          } else if (aCreated) {
            return -1; // a has created, b doesn't - prioritize a
          } else if (bCreated) {
            return 1; // b has created, a doesn't - prioritize b
          }
          
          // 3rd priority: id (stable tie-breaker)
          return a.id.localeCompare(b.id);
        });
        
        const selectedWO = sorted[0];
        primaryWorkOrder = {
          id: selectedWO.id,
          title: selectedWO.title,
          description: selectedWO.description,
          priority: selectedWO.priority,
          slaCompleteMinutes: selectedWO.slaCompleteMinutes,
        };

        // 5. Hydrate checklist template if present
        if (selectedWO.checklistTemplateId) {
          const template = await this.storage.getChecklistTemplate(selectedWO.checklistTemplateId);
          if (template) {
            primaryChecklist = template.items.map(item => ({
              id: item.id,
              label: item.label,
              type: item.type,
              required: item.required || false, // Ensure boolean, not undefined
            }));
          }
        }
      }

      console.log(`[NORMALIZER] Successfully normalized data for QR ${qrCode}`);
      console.log(`[NORMALIZER] - QR Point: ${qrPoint.name}`);
      console.log(`[NORMALIZER] - Zone: ${zone?.name || 'MISSING'}`);
      console.log(`[NORMALIZER] - Has scheduled activity: ${!!primaryWorkOrder}`);

      // 6. Return API-compatible structure with graceful degradation
      return {
        point: {
          id: qrPoint.pointId,
          code: qrPoint.code,
          name: qrPoint.name,
          description: qrPoint.description,
          customerId: qrPoint.customerId,
          zoneId: qrPoint.zoneId,
          module: qrPoint.module,
        },
        hasScheduledActivity: !!primaryWorkOrder,
        scheduledWorkOrder: primaryWorkOrder,
        checklist: primaryChecklist,
        zone: zone ? {
          id: zone.id,
          name: zone.name,
          areaM2: zone.areaM2 || undefined,
          siteId: zone.siteId || qrPoint.zoneId, // Fallback to zoneId from point
          module: zone.module,
        } : {
          // Graceful fallback if zone not in cache
          id: qrPoint.zoneId,
          name: 'Local', // Generic fallback
          areaM2: undefined,
          siteId: qrPoint.zoneId,
          module: qrPoint.module,
        },
        // TODO: Hydrate site from cache when available
        site: undefined,
        customer: {
          id: qrPoint.customerId,
          name: undefined, // TODO: Get from customers cache store
        },
        company: undefined, // TODO: Get from companies cache store
      };
    } catch (error) {
      console.error('[NORMALIZER] Error normalizing QR data:', error);
      return null;
    }
  }

  /**
   * Check if QR code exists in offline cache
   */
  async hasQRCodeInCache(qrCode: string): Promise<boolean> {
    const qrPoint = await this.storage.getQRPointByCode(qrCode);
    return qrPoint !== null;
  }

  /**
   * Get cache statistics for debugging
   */
  async getCacheStats() {
    try {
      const allQRPoints = await this.storage.getAllQRPoints();
      const allZones = await this.storage.getAllZones();
      const allWorkOrders = await this.storage.getAllScheduledWorkOrders();
      const allTemplates = await this.storage.getAllChecklistTemplates();

      return {
        qrPoints: allQRPoints.length,
        zones: allZones.length,
        scheduledWorkOrders: allWorkOrders.length,
        checklistTemplates: allTemplates.length,
      };
    } catch (error) {
      console.error('[NORMALIZER] Error getting cache stats:', error);
      return null;
    }
  }
}
