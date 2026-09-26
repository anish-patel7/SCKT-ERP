/**
 * Offline Support Utilities
 * Handles PWA service worker registration, offline detection, and IndexedDB operations
 */

interface PendingOrder {
  id: string;
  customer_id: string;
  customer_name: string;
  order_date: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
    discount_percent: number;
  }>;
  notes?: string;
  status: string;
  total_amount: number;
  created_at: string;
  synced?: boolean;
}

export class OfflineStorage {
  private dbName = 'sckt-db';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDB();
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve(this.db);
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('pending-orders')) {
          const store = db.createObjectStore('pending-orders', { keyPath: 'id' });
          store.createIndex('synced', 'synced', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
        }

        if (!db.objectStoreNames.contains('offline-state')) {
          db.createObjectStore('offline-state', { keyPath: 'key' });
        }
      };
    });
  }

  async savePendingOrder(order: PendingOrder): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['pending-orders'], 'readwrite');
      const store = transaction.objectStore('pending-orders');
      const request = store.add({ ...order, synced: false, created_at: new Date().toISOString() });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getPendingOrders(): Promise<PendingOrder[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['pending-orders'], 'readonly');
      const store = transaction.objectStore('pending-orders');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getUnsyncedOrders(): Promise<PendingOrder[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['pending-orders'], 'readonly');
      const store = transaction.objectStore('pending-orders');
      const index = store.index('synced');
      const request = index.getAll(false);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async removePendingOrder(orderId: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['pending-orders'], 'readwrite');
      const store = transaction.objectStore('pending-orders');
      const request = store.delete(orderId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async markOrderSynced(orderId: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['pending-orders'], 'readwrite');
      const store = transaction.objectStore('pending-orders');
      const getRequest = store.get(orderId);

      getRequest.onsuccess = () => {
        const order = getRequest.result;
        if (order) {
          order.synced = true;
          const updateRequest = store.put(order);
          updateRequest.onerror = () => reject(updateRequest.error);
          updateRequest.onsuccess = () => resolve();
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async setState(key: string, value: any): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['offline-state'], 'readwrite');
      const store = transaction.objectStore('offline-state');
      const request = store.put({ key, value, timestamp: Date.now() });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getState(key: string): Promise<any> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['offline-state'], 'readonly');
      const store = transaction.objectStore('offline-state');
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
    });
  }
}

export class ServiceWorkerManager {
  private offlineStorage = new OfflineStorage();

  async register(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Workers not supported');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
        updateViaCache: 'none',
      });

      console.log('Service Worker registered:', registration);

      // Handle messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('Message from Service Worker:', event.data);
      });

      // Request periodic background sync if available
      if ('periodicSync' in registration) {
        try {
          await registration.periodicSync.register('sync-orders', { minInterval: 5 * 60 * 1000 });
          console.log('Periodic sync registered');
        } catch (error) {
          console.error('Periodic sync registration failed:', error);
        }
      }

      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }

  async unregister(): Promise<void> {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }
  }

  isOnline(): boolean {
    return navigator.onLine;
  }

  onOnline(callback: () => void): void {
    window.addEventListener('online', callback);
  }

  onOffline(callback: () => void): void {
    window.addEventListener('offline', callback);
  }

  removeOnlineListener(callback: () => void): void {
    window.removeEventListener('online', callback);
  }

  removeOfflineListener(callback: () => void): void {
    window.removeEventListener('offline', callback);
  }
}

export const swManager = new ServiceWorkerManager();
export const offlineStorage = new OfflineStorage();
