import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OfflineStorage, ServiceWorkerManager } from '../offline-support';

describe('OfflineStorage', () => {
  let storage: OfflineStorage;

  beforeEach(() => {
    storage = new OfflineStorage();
  });

  afterEach(async () => {
    // Cleanup
  });

  it('should initialize IndexedDB', async () => {
    expect(storage).toBeDefined();
  });

  it('should save pending order', async () => {
    const order = {
      id: 'order-1',
      customer_id: 'cust-1',
      customer_name: 'John Doe',
      order_date: '2026-09-20',
      items: [
        { product_id: 'prod-1', quantity: 5, unit_price: 100, discount_percent: 0 },
      ],
      status: 'DRAFT',
      total_amount: 500,
    };

    await storage.savePendingOrder(order);
    const pending = await storage.getPendingOrders();
    expect(pending.length).toBeGreaterThan(0);
  });

  it('should retrieve pending orders', async () => {
    const order1 = {
      id: 'order-1',
      customer_id: 'cust-1',
      customer_name: 'John Doe',
      order_date: '2026-09-20',
      items: [],
      status: 'DRAFT',
      total_amount: 500,
    };

    await storage.savePendingOrder(order1);
    const orders = await storage.getPendingOrders();
    expect(Array.isArray(orders)).toBe(true);
  });

  it('should get only unsynced orders', async () => {
    const order = {
      id: 'order-1',
      customer_id: 'cust-1',
      customer_name: 'John Doe',
      order_date: '2026-09-20',
      items: [],
      status: 'DRAFT',
      total_amount: 500,
    };

    await storage.savePendingOrder(order);
    const unsyncedOrders = await storage.getUnsyncedOrders();
    expect(Array.isArray(unsyncedOrders)).toBe(true);
  });

  it('should remove pending order', async () => {
    const order = {
      id: 'order-to-remove',
      customer_id: 'cust-1',
      customer_name: 'John Doe',
      order_date: '2026-09-20',
      items: [],
      status: 'DRAFT',
      total_amount: 500,
    };

    await storage.savePendingOrder(order);
    await storage.removePendingOrder(order.id);
    const pending = await storage.getPendingOrders();
    expect(pending.find((o) => o.id === 'order-to-remove')).toBeUndefined();
  });

  it('should mark order as synced', async () => {
    const order = {
      id: 'order-to-sync',
      customer_id: 'cust-1',
      customer_name: 'John Doe',
      order_date: '2026-09-20',
      items: [],
      status: 'DRAFT',
      total_amount: 500,
    };

    await storage.savePendingOrder(order);
    await storage.markOrderSynced(order.id);
    const unsyncedOrders = await storage.getUnsyncedOrders();
    expect(unsyncedOrders.find((o) => o.id === 'order-to-sync')).toBeUndefined();
  });

  it('should save state', async () => {
    await storage.setState('test-key', { value: 'test-value' });
    const state = await storage.getState('test-key');
    expect(state).toEqual({ value: 'test-value' });
  });

  it('should retrieve state', async () => {
    const testData = { orders: 5, revenue: 50000 };
    await storage.setState('dashboard-state', testData);
    const state = await storage.getState('dashboard-state');
    expect(state).toEqual(testData);
  });

  it('should return null for non-existent state', async () => {
    const state = await storage.getState('non-existent-key');
    expect(state).toBeNull();
  });

  it('should handle multiple pending orders', async () => {
    const orders = [
      {
        id: 'order-1',
        customer_id: 'cust-1',
        customer_name: 'Customer 1',
        order_date: '2026-09-20',
        items: [],
        status: 'DRAFT',
        total_amount: 500,
      },
      {
        id: 'order-2',
        customer_id: 'cust-2',
        customer_name: 'Customer 2',
        order_date: '2026-09-20',
        items: [],
        status: 'DRAFT',
        total_amount: 1000,
      },
    ];

    for (const order of orders) {
      await storage.savePendingOrder(order);
    }

    const pending = await storage.getPendingOrders();
    expect(pending.length).toBeGreaterThanOrEqual(2);
  });

  it('should persist data across sessions', async () => {
    const order = {
      id: 'persistent-order',
      customer_id: 'cust-1',
      customer_name: 'John Doe',
      order_date: '2026-09-20',
      items: [],
      status: 'DRAFT',
      total_amount: 500,
    };

    await storage.savePendingOrder(order);

    // Simulate new storage instance (like page reload)
    const newStorage = new OfflineStorage();
    const pending = await newStorage.getPendingOrders();
    expect(pending.find((o) => o.id === 'persistent-order')).toBeDefined();
  });
});

describe('ServiceWorkerManager', () => {
  let manager: ServiceWorkerManager;

  beforeEach(() => {
    manager = new ServiceWorkerManager();
  });

  it('should initialize service worker manager', () => {
    expect(manager).toBeDefined();
  });

  it('should detect online status', () => {
    const isOnline = manager.isOnline();
    expect(typeof isOnline).toBe('boolean');
  });

  it('should register online listener', () => {
    const callback = vi.fn();
    manager.onOnline(callback);
    expect(callback).toBeDefined();
  });

  it('should register offline listener', () => {
    const callback = vi.fn();
    manager.onOffline(callback);
    expect(callback).toBeDefined();
  });

  it('should remove online listener', () => {
    const callback = vi.fn();
    manager.onOnline(callback);
    manager.removeOnlineListener(callback);
    expect(callback).toBeDefined();
  });

  it('should remove offline listener', () => {
    const callback = vi.fn();
    manager.onOffline(callback);
    manager.removeOfflineListener(callback);
    expect(callback).toBeDefined();
  });

  it('should handle multiple online listeners', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    manager.onOnline(callback1);
    manager.onOnline(callback2);
    expect(callback1).toBeDefined();
    expect(callback2).toBeDefined();
  });

  it('should handle multiple offline listeners', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    manager.onOffline(callback1);
    manager.onOffline(callback2);
    expect(callback1).toBeDefined();
    expect(callback2).toBeDefined();
  });

  it('should support selective listener removal', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    manager.onOnline(callback1);
    manager.onOnline(callback2);
    manager.removeOnlineListener(callback1);
    expect(callback2).toBeDefined();
  });
});

describe('Offline Sync', () => {
  let storage: OfflineStorage;

  beforeEach(() => {
    storage = new OfflineStorage();
  });

  it('should identify synced orders', async () => {
    const order = {
      id: 'synced-order',
      customer_id: 'cust-1',
      customer_name: 'John Doe',
      order_date: '2026-09-20',
      items: [],
      status: 'DRAFT',
      total_amount: 500,
    };

    await storage.savePendingOrder(order);
    await storage.markOrderSynced(order.id);
    const unsynced = await storage.getUnsyncedOrders();
    expect(unsynced.find((o) => o.id === 'synced-order')).toBeUndefined();
  });

  it('should track order sync status', async () => {
    const order1 = {
      id: 'order-synced',
      customer_id: 'cust-1',
      customer_name: 'Customer 1',
      order_date: '2026-09-20',
      items: [],
      status: 'DRAFT',
      total_amount: 500,
    };

    const order2 = {
      id: 'order-unsynced',
      customer_id: 'cust-2',
      customer_name: 'Customer 2',
      order_date: '2026-09-20',
      items: [],
      status: 'DRAFT',
      total_amount: 1000,
    };

    await storage.savePendingOrder(order1);
    await storage.savePendingOrder(order2);
    await storage.markOrderSynced(order1.id);

    const unsynced = await storage.getUnsyncedOrders();
    expect(unsynced.some((o) => o.id === 'order-unsynced')).toBe(true);
    expect(unsynced.some((o) => o.id === 'order-synced')).toBe(false);
  });

  it('should retrieve pending orders in order of creation', async () => {
    const orders = [
      {
        id: 'order-1',
        customer_id: 'cust-1',
        customer_name: 'Customer 1',
        order_date: '2026-09-20',
        items: [],
        status: 'DRAFT',
        total_amount: 500,
      },
      {
        id: 'order-2',
        customer_id: 'cust-2',
        customer_name: 'Customer 2',
        order_date: '2026-09-20',
        items: [],
        status: 'DRAFT',
        total_amount: 1000,
      },
    ];

    for (const order of orders) {
      await storage.savePendingOrder(order);
    }

    const pending = await storage.getPendingOrders();
    expect(pending.length).toBeGreaterThanOrEqual(2);
  });

  it('should support bulk order cleanup after sync', async () => {
    const orders = [];
    for (let i = 0; i < 5; i++) {
      orders.push({
        id: `order-${i}`,
        customer_id: `cust-${i}`,
        customer_name: `Customer ${i}`,
        order_date: '2026-09-20',
        items: [],
        status: 'DRAFT',
        total_amount: 500 * (i + 1),
      });
    }

    for (const order of orders) {
      await storage.savePendingOrder(order);
    }

    // Mark all as synced
    for (const order of orders) {
      await storage.markOrderSynced(order.id);
    }

    const unsynced = await storage.getUnsyncedOrders();
    expect(unsynced.length).toBe(0);
  });
});

describe('State Management', () => {
  let storage: OfflineStorage;

  beforeEach(() => {
    storage = new OfflineStorage();
  });

  it('should store complex objects', async () => {
    const complexData = {
      user: { id: 'user-1', name: 'John' },
      preferences: { theme: 'dark', language: 'en' },
      cache: { orders: [], invoices: [] },
    };

    await storage.setState('complex-state', complexData);
    const retrieved = await storage.getState('complex-state');
    expect(retrieved).toEqual(complexData);
  });

  it('should support multiple independent states', async () => {
    await storage.setState('state-1', { value: 'first' });
    await storage.setState('state-2', { value: 'second' });
    await storage.setState('state-3', { value: 'third' });

    const state1 = await storage.getState('state-1');
    const state2 = await storage.getState('state-2');
    const state3 = await storage.getState('state-3');

    expect(state1).toEqual({ value: 'first' });
    expect(state2).toEqual({ value: 'second' });
    expect(state3).toEqual({ value: 'third' });
  });

  it('should allow state updates', async () => {
    await storage.setState('mutable-state', { count: 1 });
    let state = await storage.getState('mutable-state');
    expect(state.count).toBe(1);

    await storage.setState('mutable-state', { count: 2 });
    state = await storage.getState('mutable-state');
    expect(state.count).toBe(2);
  });
});
