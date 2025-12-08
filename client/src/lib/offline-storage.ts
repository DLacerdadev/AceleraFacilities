import { nanoid } from 'nanoid';
import { Capacitor } from '@capacitor/core';

// ============================================================================
// TYPES
// ============================================================================

export interface OfflineWorkOrder {
  localId: string;
  serverId?: string; // Server ID after sync
  customerId: string;
  module: 'clean' | 'maintenance';
  number?: number;
  type: 'programmed' | 'internal_corrective' | 'public_corrective';
  title: string;
  description?: string;
  status: string;
  priority: string;
  siteId?: string;
  zoneId?: string;
  equipmentId?: string;
  assignedUserId?: string;
  scheduledDate?: string;
  dueDate?: string;
  completedAt?: string;
  responsibles?: string[];
  // Sync metadata
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  createdOffline: boolean;
  lastSyncAttempt?: string;
  syncRetryCount: number;
  syncError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfflineChecklistExecution {
  localId: string;
  serverId?: string;
  workOrderId: string; // Can be localId or serverId
  checklistTemplateId: string;
  executedBy?: string;
  status: string;
  itemsData?: any;
  executedAt?: string;
  // Sync metadata
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  createdOffline: boolean;
  lastSyncAttempt?: string;
  syncRetryCount: number;
  syncError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfflineAttachment {
  localId: string;
  serverId?: string;
  workOrderId: string; // Can be localId or serverId
  type: 'photo' | 'document';
  url: string; // Local base64 or blob URL
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy?: string;
  // Sync metadata
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  createdOffline: boolean;
  lastSyncAttempt?: string;
  syncRetryCount: number;
  syncError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncQueueItem {
  id: string;
  type: 'work_order' | 'checklist_execution' | 'attachment';
  localId: string;
  priority: number; // Higher = more priority
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

export interface CachedQRPoint {
  code: string; // PK - QR code value
  pointId: string;
  name: string;
  description?: string;
  zoneId: string;
  customerId: string;
  module: 'clean' | 'maintenance';
  lastSynced: number; // Timestamp
}

export interface CachedZone {
  id: string; // PK - Zone ID
  name: string;
  areaM2?: number;
  siteId?: string;
  siteName?: string;
  customerId: string;
  module: 'clean' | 'maintenance';
  lastSynced: number; // Timestamp
}

export interface CachedScheduledWorkOrder {
  id: string; // PK - Work Order ID
  qrCode: string; // QR code that triggers this
  title: string;
  description?: string;
  priority?: string;
  slaCompleteMinutes?: number;
  checklistTemplateId?: string;
  customerId: string;
  module: 'clean' | 'maintenance';
  scheduledStartAt?: string; // ISO datetime for prioritization
  createdAt?: string; // ISO datetime fallback for prioritization
  lastSynced: number; // Timestamp
}

export interface CachedChecklistTemplate {
  id: string; // PK - Checklist Template ID
  name: string;
  items: Array<{
    id: string;
    label: string;
    type: string;
    required?: boolean;
  }>;
  customerId: string;
  module: 'clean' | 'maintenance';
  lastSynced: number; // Timestamp
}

// ============================================================================
// INDEXEDDB DATABASE SETUP
// ============================================================================

const DB_NAME = 'AceleraOfflineDB';
const DB_VERSION = 6; // v6: Rollback from v5, maintaining stability

export class OfflineStorageManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initDB();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      // ⚠️ CRITICAL: Offline storage is ONLY for mobile (Capacitor) apps
      // Web version should NOT use IndexedDB offline storage
      if (!Capacitor.isNativePlatform()) {
        console.log('[OFFLINE STORAGE] ⏭️  Skipping initialization - Web version does not use offline storage (mobile-only feature)');
        this.db = null; // Ensure db is null on web
        resolve(); // Resolve immediately without opening database
        return;
      }

      console.log('[OFFLINE STORAGE] 📱 Mobile app detected - initializing offline storage...');
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[OFFLINE STORAGE] Failed to open database', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[OFFLINE STORAGE] Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains('workOrders')) {
          const workOrdersStore = db.createObjectStore('workOrders', { keyPath: 'localId' });
          workOrdersStore.createIndex('serverId', 'serverId', { unique: false });
          workOrdersStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          workOrdersStore.createIndex('customerId', 'customerId', { unique: false });
          workOrdersStore.createIndex('createdAt', 'createdAt', { unique: false });
          console.log('[OFFLINE STORAGE] Created workOrders store');
        }

        if (!db.objectStoreNames.contains('checklistExecutions')) {
          const executionsStore = db.createObjectStore('checklistExecutions', { keyPath: 'localId' });
          executionsStore.createIndex('serverId', 'serverId', { unique: false });
          executionsStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          executionsStore.createIndex('workOrderId', 'workOrderId', { unique: false });
          executionsStore.createIndex('createdAt', 'createdAt', { unique: false });
          console.log('[OFFLINE STORAGE] Created checklistExecutions store');
        }

        if (!db.objectStoreNames.contains('attachments')) {
          const attachmentsStore = db.createObjectStore('attachments', { keyPath: 'localId' });
          attachmentsStore.createIndex('serverId', 'serverId', { unique: false });
          attachmentsStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          attachmentsStore.createIndex('workOrderId', 'workOrderId', { unique: false });
          attachmentsStore.createIndex('createdAt', 'createdAt', { unique: false });
          console.log('[OFFLINE STORAGE] Created attachments store');
        }

        if (!db.objectStoreNames.contains('syncQueue')) {
          const queueStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          queueStore.createIndex('priority', 'priority', { unique: false });
          queueStore.createIndex('type', 'type', { unique: false });
          queueStore.createIndex('createdAt', 'createdAt', { unique: false });
          console.log('[OFFLINE STORAGE] Created syncQueue store');
        }

        // v2: QR metadata cache for offline execution
        if (!db.objectStoreNames.contains('qrPoints')) {
          const qrPointsStore = db.createObjectStore('qrPoints', { keyPath: 'code' });
          qrPointsStore.createIndex('customerId', 'customerId', { unique: false });
          qrPointsStore.createIndex('module', 'module', { unique: false });
          qrPointsStore.createIndex('zoneId', 'zoneId', { unique: false });
          qrPointsStore.createIndex('lastSynced', 'lastSynced', { unique: false });
          console.log('[OFFLINE STORAGE] Created qrPoints store');
        }

        if (!db.objectStoreNames.contains('zones')) {
          const zonesStore = db.createObjectStore('zones', { keyPath: 'id' });
          zonesStore.createIndex('customerId', 'customerId', { unique: false });
          zonesStore.createIndex('module', 'module', { unique: false });
          zonesStore.createIndex('lastSynced', 'lastSynced', { unique: false });
          console.log('[OFFLINE STORAGE] Created zones store');
        }

        // v3: Scheduled work orders and checklist templates for complete offline execution
        if (!db.objectStoreNames.contains('scheduledWorkOrders')) {
          const scheduledWOStore = db.createObjectStore('scheduledWorkOrders', { keyPath: 'id' });
          scheduledWOStore.createIndex('qrCode', 'qrCode', { unique: false });
          scheduledWOStore.createIndex('customerId', 'customerId', { unique: false });
          scheduledWOStore.createIndex('module', 'module', { unique: false });
          scheduledWOStore.createIndex('lastSynced', 'lastSynced', { unique: false });
          console.log('[OFFLINE STORAGE] Created scheduledWorkOrders store');
        }

        if (!db.objectStoreNames.contains('checklistTemplates')) {
          const checklistTemplatesStore = db.createObjectStore('checklistTemplates', { keyPath: 'id' });
          checklistTemplatesStore.createIndex('customerId', 'customerId', { unique: false });
          checklistTemplatesStore.createIndex('module', 'module', { unique: false });
          checklistTemplatesStore.createIndex('lastSynced', 'lastSynced', { unique: false });
          console.log('[OFFLINE STORAGE] Created checklistTemplates store');
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (this.initPromise) {
      await this.initPromise;
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  // ============================================================================
  // WORK ORDERS
  // ============================================================================

  async createWorkOrder(data: Omit<OfflineWorkOrder, 'localId' | 'createdAt' | 'updatedAt'>): Promise<OfflineWorkOrder> {
    const db = await this.ensureDB();
    const now = new Date().toISOString();
    
    const workOrder: OfflineWorkOrder = {
      ...data,
      localId: nanoid(),
      syncStatus: 'pending',
      createdOffline: true,
      syncRetryCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['workOrders', 'syncQueue'], 'readwrite');
      const workOrdersStore = transaction.objectStore('workOrders');
      const queueStore = transaction.objectStore('syncQueue');

      const addRequest = workOrdersStore.add(workOrder);

      addRequest.onsuccess = () => {
        // Add to sync queue
        const queueItem: SyncQueueItem = {
          id: nanoid(),
          type: 'work_order',
          localId: workOrder.localId,
          priority: 10, // High priority for work orders
          createdAt: now,
          retryCount: 0,
        };
        queueStore.add(queueItem);

        console.log('[OFFLINE STORAGE] Work order created:', workOrder.localId);
        resolve(workOrder);
      };

      addRequest.onerror = () => {
        console.error('[OFFLINE STORAGE] Failed to create work order', addRequest.error);
        reject(addRequest.error);
      };
    });
  }

  async getWorkOrder(localId: string): Promise<OfflineWorkOrder | null> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['workOrders'], 'readonly');
      const store = transaction.objectStore('workOrders');
      const request = store.get(localId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async getAllWorkOrders(customerId?: string): Promise<OfflineWorkOrder[]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['workOrders'], 'readonly');
      const store = transaction.objectStore('workOrders');
      const request = customerId 
        ? store.index('customerId').getAll(customerId)
        : store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async updateWorkOrder(localId: string, updates: Partial<OfflineWorkOrder>): Promise<void> {
    const db = await this.ensureDB();
    const workOrder = await this.getWorkOrder(localId);
    
    if (!workOrder) {
      throw new Error(`Work order ${localId} not found`);
    }

    const updated: OfflineWorkOrder = {
      ...workOrder,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['workOrders'], 'readwrite');
      const store = transaction.objectStore('workOrders');
      const request = store.put(updated);

      request.onsuccess = () => {
        console.log('[OFFLINE STORAGE] Work order updated:', localId);
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async deleteWorkOrder(localId: string): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['workOrders'], 'readwrite');
      const store = transaction.objectStore('workOrders');
      const request = store.delete(localId);

      request.onsuccess = () => {
        console.log('[OFFLINE STORAGE] Work order deleted:', localId);
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // ============================================================================
  // CHECKLIST EXECUTIONS
  // ============================================================================

  async createChecklistExecution(data: Omit<OfflineChecklistExecution, 'localId' | 'createdAt' | 'updatedAt'>): Promise<OfflineChecklistExecution> {
    const db = await this.ensureDB();
    const now = new Date().toISOString();
    
    const execution: OfflineChecklistExecution = {
      ...data,
      localId: nanoid(),
      syncStatus: 'pending',
      createdOffline: true,
      syncRetryCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['checklistExecutions', 'syncQueue'], 'readwrite');
      const executionsStore = transaction.objectStore('checklistExecutions');
      const queueStore = transaction.objectStore('syncQueue');

      const addRequest = executionsStore.add(execution);

      addRequest.onsuccess = () => {
        // Add to sync queue
        const queueItem: SyncQueueItem = {
          id: nanoid(),
          type: 'checklist_execution',
          localId: execution.localId,
          priority: 8,
          createdAt: now,
          retryCount: 0,
        };
        queueStore.add(queueItem);

        console.log('[OFFLINE STORAGE] Checklist execution created:', execution.localId);
        resolve(execution);
      };

      addRequest.onerror = () => {
        console.error('[OFFLINE STORAGE] Failed to create checklist execution', addRequest.error);
        reject(addRequest.error);
      };
    });
  }

  async getChecklistExecutionsByWorkOrder(workOrderId: string): Promise<OfflineChecklistExecution[]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['checklistExecutions'], 'readonly');
      const store = transaction.objectStore('checklistExecutions');
      const index = store.index('workOrderId');
      const request = index.getAll(workOrderId);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // ============================================================================
  // ATTACHMENTS
  // ============================================================================

  async createAttachment(data: Omit<OfflineAttachment, 'localId' | 'createdAt' | 'updatedAt'>): Promise<OfflineAttachment> {
    const db = await this.ensureDB();
    const now = new Date().toISOString();
    
    const attachment: OfflineAttachment = {
      ...data,
      localId: nanoid(),
      syncStatus: 'pending',
      createdOffline: true,
      syncRetryCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['attachments', 'syncQueue'], 'readwrite');
      const attachmentsStore = transaction.objectStore('attachments');
      const queueStore = transaction.objectStore('syncQueue');

      const addRequest = attachmentsStore.add(attachment);

      addRequest.onsuccess = () => {
        // Add to sync queue
        const queueItem: SyncQueueItem = {
          id: nanoid(),
          type: 'attachment',
          localId: attachment.localId,
          priority: 5,
          createdAt: now,
          retryCount: 0,
        };
        queueStore.add(queueItem);

        console.log('[OFFLINE STORAGE] Attachment created:', attachment.localId);
        resolve(attachment);
      };

      addRequest.onerror = () => {
        console.error('[OFFLINE STORAGE] Failed to create attachment', addRequest.error);
        reject(addRequest.error);
      };
    });
  }

  async getAttachmentsByWorkOrder(workOrderId: string): Promise<OfflineAttachment[]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['attachments'], 'readonly');
      const store = transaction.objectStore('attachments');
      const index = store.index('workOrderId');
      const request = index.getAll(workOrderId);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // ============================================================================
  // QR POINTS CACHE (for offline QR scanning)
  // ============================================================================

  async cacheQRPoint(data: Omit<CachedQRPoint, 'lastSynced'>): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['qrPoints'], 'readwrite');
      const store = transaction.objectStore('qrPoints');

      const qrPoint: CachedQRPoint = {
        ...data,
        lastSynced: Date.now(),
      };

      const request = store.put(qrPoint);

      request.onsuccess = () => {
        console.log('[OFFLINE STORAGE] QR point cached:', data.code);
        resolve();
      };

      request.onerror = () => {
        console.error('[OFFLINE STORAGE] Failed to cache QR point', request.error);
        reject(request.error);
      };
    });
  }

  async getQRPoint(code: string): Promise<CachedQRPoint | null> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['qrPoints'], 'readonly');
      const store = transaction.objectStore('qrPoints');
      const request = store.get(code);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('[OFFLINE STORAGE] Failed to get QR point', request.error);
        reject(request.error);
      };
    });
  }

  // Alias for normalizer compatibility
  async getQRPointByCode(code: string): Promise<CachedQRPoint | null> {
    return this.getQRPoint(code);
  }

  async cacheQRPointsBulk(points: Omit<CachedQRPoint, 'lastSynced'>[]): Promise<void> {
    const db = await this.ensureDB();
    const now = Date.now();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['qrPoints'], 'readwrite');
      const store = transaction.objectStore('qrPoints');
      let processedCount = 0;

      points.forEach((point) => {
        const qrPoint: CachedQRPoint = {
          ...point,
          lastSynced: now,
        };
        store.put(qrPoint);
        processedCount++;
      });

      transaction.oncomplete = () => {
        console.log(`[OFFLINE STORAGE] Cached ${processedCount} QR points in bulk`);
        resolve();
      };

      transaction.onerror = () => {
        console.error('[OFFLINE STORAGE] Failed to cache QR points in bulk', transaction.error);
        reject(transaction.error);
      };
    });
  }

  // ============================================================================
  // ZONES CACHE (for offline QR scanning)
  // ============================================================================

  async cacheZone(data: Omit<CachedZone, 'lastSynced'>): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['zones'], 'readwrite');
      const store = transaction.objectStore('zones');

      const zone: CachedZone = {
        ...data,
        lastSynced: Date.now(),
      };

      const request = store.put(zone);

      request.onsuccess = () => {
        console.log('[OFFLINE STORAGE] Zone cached:', data.id);
        resolve();
      };

      request.onerror = () => {
        console.error('[OFFLINE STORAGE] Failed to cache zone', request.error);
        reject(request.error);
      };
    });
  }

  async getZone(id: string): Promise<CachedZone | null> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['zones'], 'readonly');
      const store = transaction.objectStore('zones');
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('[OFFLINE STORAGE] Failed to get zone', request.error);
        reject(request.error);
      };
    });
  }

  async getAllQRPoints(): Promise<CachedQRPoint[]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['qrPoints'], 'readonly');
      const store = transaction.objectStore('qrPoints');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('[OFFLINE STORAGE] Failed to get all QR points', request.error);
        reject(request.error);
      };
    });
  }

  async getAllZones(): Promise<CachedZone[]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['zones'], 'readonly');
      const store = transaction.objectStore('zones');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('[OFFLINE STORAGE] Failed to get all zones', request.error);
        reject(request.error);
      };
    });
  }

  async cacheZonesBulk(zones: Omit<CachedZone, 'lastSynced'>[]): Promise<void> {
    const db = await this.ensureDB();
    const now = Date.now();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['zones'], 'readwrite');
      const store = transaction.objectStore('zones');
      let processedCount = 0;

      zones.forEach((zone) => {
        const cachedZone: CachedZone = {
          ...zone,
          lastSynced: now,
        };
        store.put(cachedZone);
        processedCount++;
      });

      transaction.oncomplete = () => {
        console.log(`[OFFLINE STORAGE] Cached ${processedCount} zones in bulk`);
        resolve();
      };

      transaction.onerror = () => {
        console.error('[OFFLINE STORAGE] Failed to cache zones in bulk', transaction.error);
        reject(transaction.error);
      };
    });
  }

  async getLastSyncTimestamp(): Promise<number | null> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['qrPoints'], 'readonly');
      const store = transaction.objectStore('qrPoints');
      const index = store.index('lastSynced');
      const request = index.openCursor(null, 'prev'); // Get most recent

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          resolve((cursor.value as CachedQRPoint).lastSynced);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // ============================================================================
  // SCHEDULED WORK ORDERS CACHE (for offline QR execution)
  // ============================================================================

  async cacheScheduledWorkOrder(data: Omit<CachedScheduledWorkOrder, 'lastSynced'>): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['scheduledWorkOrders'], 'readwrite');
      const store = transaction.objectStore('scheduledWorkOrders');

      const workOrder: CachedScheduledWorkOrder = {
        ...data,
        lastSynced: Date.now(),
      };

      const request = store.put(workOrder);

      request.onsuccess = () => {
        console.log('[OFFLINE STORAGE] Scheduled WO cached:', data.id);
        resolve();
      };

      request.onerror = () => {
        console.error('[OFFLINE STORAGE] Failed to cache scheduled WO', request.error);
        reject(request.error);
      };
    });
  }

  async getScheduledWorkOrdersByQRCode(qrCode: string): Promise<CachedScheduledWorkOrder[]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['scheduledWorkOrders'], 'readonly');
      const store = transaction.objectStore('scheduledWorkOrders');
      const index = store.index('qrCode');
      const request = index.getAll(qrCode);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('[OFFLINE STORAGE] Failed to get scheduled WOs by QR code', request.error);
        reject(request.error);
      };
    });
  }

  async getAllScheduledWorkOrders(): Promise<CachedScheduledWorkOrder[]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['scheduledWorkOrders'], 'readonly');
      const store = transaction.objectStore('scheduledWorkOrders');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('[OFFLINE STORAGE] Failed to get all scheduled work orders', request.error);
        reject(request.error);
      };
    });
  }

  async cacheScheduledWorkOrdersBulk(workOrders: Omit<CachedScheduledWorkOrder, 'lastSynced'>[]): Promise<void> {
    const db = await this.ensureDB();
    const now = Date.now();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['scheduledWorkOrders'], 'readwrite');
      const store = transaction.objectStore('scheduledWorkOrders');
      let processedCount = 0;

      workOrders.forEach((wo) => {
        const cachedWO: CachedScheduledWorkOrder = {
          ...wo,
          lastSynced: now,
        };
        store.put(cachedWO);
        processedCount++;
      });

      transaction.oncomplete = () => {
        console.log(`[OFFLINE STORAGE] Cached ${processedCount} scheduled work orders in bulk`);
        resolve();
      };

      transaction.onerror = () => {
        console.error('[OFFLINE STORAGE] Failed to cache scheduled WOs in bulk', transaction.error);
        reject(transaction.error);
      };
    });
  }

  // ============================================================================
  // CHECKLIST TEMPLATES CACHE (for offline checklist execution)
  // ============================================================================

  async cacheChecklistTemplate(data: Omit<CachedChecklistTemplate, 'lastSynced'>): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['checklistTemplates'], 'readwrite');
      const store = transaction.objectStore('checklistTemplates');

      const template: CachedChecklistTemplate = {
        ...data,
        lastSynced: Date.now(),
      };

      const request = store.put(template);

      request.onsuccess = () => {
        console.log('[OFFLINE STORAGE] Checklist template cached:', data.id);
        resolve();
      };

      request.onerror = () => {
        console.error('[OFFLINE STORAGE] Failed to cache checklist template', request.error);
        reject(request.error);
      };
    });
  }

  async getChecklistTemplate(id: string): Promise<CachedChecklistTemplate | null> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['checklistTemplates'], 'readonly');
      const store = transaction.objectStore('checklistTemplates');
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('[OFFLINE STORAGE] Failed to get checklist template', request.error);
        reject(request.error);
      };
    });
  }

  async getAllChecklistTemplates(): Promise<CachedChecklistTemplate[]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['checklistTemplates'], 'readonly');
      const store = transaction.objectStore('checklistTemplates');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('[OFFLINE STORAGE] Failed to get all checklist templates', request.error);
        reject(request.error);
      };
    });
  }

  async cacheChecklistTemplatesBulk(templates: Omit<CachedChecklistTemplate, 'lastSynced'>[]): Promise<void> {
    const db = await this.ensureDB();
    const now = Date.now();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['checklistTemplates'], 'readwrite');
      const store = transaction.objectStore('checklistTemplates');
      let processedCount = 0;

      templates.forEach((tpl) => {
        const cachedTemplate: CachedChecklistTemplate = {
          ...tpl,
          lastSynced: now,
        };
        store.put(cachedTemplate);
        processedCount++;
      });

      transaction.oncomplete = () => {
        console.log(`[OFFLINE STORAGE] Cached ${processedCount} checklist templates in bulk`);
        resolve();
      };

      transaction.onerror = () => {
        console.error('[OFFLINE STORAGE] Failed to cache checklist templates in bulk', transaction.error);
        reject(transaction.error);
      };
    });
  }

  // ============================================================================
  // SYNC QUEUE MANAGEMENT
  // ============================================================================

  async getPendingItems(): Promise<{
    workOrders: OfflineWorkOrder[];
    checklistExecutions: OfflineChecklistExecution[];
    attachments: OfflineAttachment[];
  }> {
    const db = await this.ensureDB();

    const workOrders = await new Promise<OfflineWorkOrder[]>((resolve, reject) => {
      const transaction = db.transaction(['workOrders'], 'readonly');
      const store = transaction.objectStore('workOrders');
      const index = store.index('syncStatus');
      const request = index.getAll('pending');

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    const checklistExecutions = await new Promise<OfflineChecklistExecution[]>((resolve, reject) => {
      const transaction = db.transaction(['checklistExecutions'], 'readonly');
      const store = transaction.objectStore('checklistExecutions');
      const index = store.index('syncStatus');
      const request = index.getAll('pending');

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    const attachments = await new Promise<OfflineAttachment[]>((resolve, reject) => {
      const transaction = db.transaction(['attachments'], 'readonly');
      const store = transaction.objectStore('attachments');
      const index = store.index('syncStatus');
      const request = index.getAll('pending');

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    return { workOrders, checklistExecutions, attachments };
  }

  async markAsSynced(type: 'work_order' | 'checklist_execution' | 'attachment', localId: string, serverId: string): Promise<void> {
    const db = await this.ensureDB();
    const storeName = type === 'work_order' ? 'workOrders' 
      : type === 'checklist_execution' ? 'checklistExecutions' 
      : 'attachments';

    // First, mark the item as synced
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([storeName, 'syncQueue'], 'readwrite');
      const store = transaction.objectStore(storeName);
      const queueStore = transaction.objectStore('syncQueue');
      const getRequest = store.get(localId);

      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (!item) {
          reject(new Error(`Item ${localId} not found`));
          return;
        }

        const updated = {
          ...item,
          serverId,
          syncStatus: 'synced',
          syncError: undefined,
          syncRetryCount: 0,
          updatedAt: new Date().toISOString(),
        };

        const putRequest = store.put(updated);
        putRequest.onsuccess = () => {
          // Remove from sync queue
          const queueRequest = queueStore.index('type').openCursor(IDBKeyRange.only(type));
          queueRequest.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
              const queueItem = cursor.value as SyncQueueItem;
              if (queueItem.localId === localId) {
                cursor.delete();
              }
              cursor.continue();
            }
          };

          console.log(`[OFFLINE STORAGE] ${type} ${localId} marked as synced with serverId ${serverId}`);
        };
        putRequest.onerror = () => reject(putRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });

    // CRITICAL: If this was a work order, update dependent records AFTER marking as synced
    if (type === 'work_order') {
      await this.updateDependentRecords(localId, serverId);
    }
  }

  // Update checklist executions and attachments when their parent work order syncs
  private async updateDependentRecords(workOrderLocalId: string, workOrderServerId: string): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['checklistExecutions', 'attachments'], 'readwrite');
      
      // Update checklist executions
      const executionsStore = transaction.objectStore('checklistExecutions');
      const executionsIndex = executionsStore.index('workOrderId');
      const executionsRequest = executionsIndex.openCursor(IDBKeyRange.only(workOrderLocalId));

      executionsRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const execution = cursor.value as OfflineChecklistExecution;
          const updated = {
            ...execution,
            workOrderId: workOrderServerId, // Update to server ID
            updatedAt: new Date().toISOString(),
          };
          cursor.update(updated);
          console.log(`[OFFLINE STORAGE] Updated execution ${execution.localId} to reference WO serverId ${workOrderServerId}`);
          cursor.continue();
        }
      };

      // Update attachments
      const attachmentsStore = transaction.objectStore('attachments');
      const attachmentsIndex = attachmentsStore.index('workOrderId');
      const attachmentsRequest = attachmentsIndex.openCursor(IDBKeyRange.only(workOrderLocalId));

      attachmentsRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const attachment = cursor.value as OfflineAttachment;
          const updated = {
            ...attachment,
            workOrderId: workOrderServerId, // Update to server ID
            updatedAt: new Date().toISOString(),
          };
          cursor.update(updated);
          console.log(`[OFFLINE STORAGE] Updated attachment ${attachment.localId} to reference WO serverId ${workOrderServerId}`);
          cursor.continue();
        }
      };

      transaction.oncomplete = () => {
        console.log(`[OFFLINE STORAGE] Updated all dependent records for WO ${workOrderLocalId} -> ${workOrderServerId}`);
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async markAsFailed(type: 'work_order' | 'checklist_execution' | 'attachment', localId: string, error: string): Promise<void> {
    const db = await this.ensureDB();
    const storeName = type === 'work_order' ? 'workOrders' 
      : type === 'checklist_execution' ? 'checklistExecutions' 
      : 'attachments';

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName, 'syncQueue'], 'readwrite');
      const store = transaction.objectStore(storeName);
      const queueStore = transaction.objectStore('syncQueue');
      const getRequest = store.get(localId);

      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (!item) {
          reject(new Error(`Item ${localId} not found`));
          return;
        }

        const retryCount = (item.syncRetryCount || 0) + 1;
        const maxRetries = 5;

        const updated = {
          ...item,
          syncStatus: retryCount >= maxRetries ? 'failed' : 'pending', // Back to pending if under max retries
          syncError: error,
          syncRetryCount: retryCount,
          lastSyncAttempt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const putRequest = store.put(updated);
        putRequest.onsuccess = () => {
          // If under max retries, re-enqueue with lower priority (exponential backoff)
          if (retryCount < maxRetries) {
            // Update existing queue item or create new one
            const queueRequest = queueStore.index('type').openCursor(IDBKeyRange.only(type));
            let foundInQueue = false;

            queueRequest.onsuccess = (event) => {
              const cursor = (event.target as IDBRequest).result;
              if (cursor) {
                const queueItem = cursor.value as SyncQueueItem;
                if (queueItem.localId === localId) {
                  foundInQueue = true;
                  // Update with lower priority and increased retry count
                  const updatedQueueItem: SyncQueueItem = {
                    ...queueItem,
                    retryCount,
                    priority: Math.max(1, queueItem.priority - retryCount), // Lower priority with each retry
                    lastError: error,
                  };
                  cursor.update(updatedQueueItem);
                  console.log(`[OFFLINE STORAGE] ${type} ${localId} re-enqueued for retry ${retryCount}/${maxRetries}`);
                }
                cursor.continue();
              } else if (!foundInQueue) {
                // Not in queue, add it back
                const priority = type === 'work_order' ? 10 : type === 'checklist_execution' ? 8 : 5;
                const newQueueItem: SyncQueueItem = {
                  id: nanoid(),
                  type,
                  localId,
                  priority: Math.max(1, priority - retryCount),
                  createdAt: new Date().toISOString(),
                  retryCount,
                  lastError: error,
                };
                queueStore.add(newQueueItem);
                console.log(`[OFFLINE STORAGE] ${type} ${localId} added back to queue for retry ${retryCount}/${maxRetries}`);
              }
            };
          } else {
            console.warn(`[OFFLINE STORAGE] ${type} ${localId} marked as permanently failed after ${maxRetries} retries:`, error);
          }
        };
        putRequest.onerror = () => reject(putRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async clearSyncedData(): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['workOrders', 'checklistExecutions', 'attachments'], 'readwrite');
      
      const clearSynced = async (storeName: string) => {
        const store = transaction.objectStore(storeName);
        const index = store.index('syncStatus');
        const request = index.openCursor(IDBKeyRange.only('synced'));

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
      };

      clearSynced('workOrders');
      clearSynced('checklistExecutions');
      clearSynced('attachments');

      transaction.oncomplete = () => {
        console.log('[OFFLINE STORAGE] Cleared all synced data');
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  async getStats(): Promise<{
    totalWorkOrders: number;
    pendingWorkOrders: number;
    totalExecutions: number;
    pendingExecutions: number;
    totalAttachments: number;
    pendingAttachments: number;
  }> {
    const db = await this.ensureDB();

    // Get counts from stores AND sync queue
    const [
      totalWorkOrders,
      totalExecutions,
      totalAttachments,
      queuedWorkOrders,
      queuedExecutions,
      queuedAttachments,
    ] = await Promise.all([
      this.countItems('workOrders'),
      this.countItems('checklistExecutions'),
      this.countItems('attachments'),
      this.countQueuedItems('work_order'),
      this.countQueuedItems('checklist_execution'),
      this.countQueuedItems('attachment'),
    ]);

    return {
      totalWorkOrders,
      pendingWorkOrders: queuedWorkOrders,
      totalExecutions,
      pendingExecutions: queuedExecutions,
      totalAttachments,
      pendingAttachments: queuedAttachments,
    };
  }

  private async countQueuedItems(type: 'work_order' | 'checklist_execution' | 'attachment'): Promise<number> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['syncQueue'], 'readonly');
      const store = transaction.objectStore('syncQueue');
      const index = store.index('type');
      const request = index.count(type);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async countItems(storeName: string, syncStatus?: string): Promise<number> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      const request = syncStatus
        ? store.index('syncStatus').count(syncStatus)
        : store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[OFFLINE STORAGE] Database closed');
    }
  }
}

// Singleton instance
export const offlineStorage = new OfflineStorageManager();
