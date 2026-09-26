import { describe, it, expect, beforeEach, vi } from 'vitest';
import { salesService } from '../sales';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client');

describe('salesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listOrders', () => {
    it('should fetch all active orders', async () => {
      const mockOrders = [
        { id: '1', order_no: 'ORD-001', customer_id: 'c1', status: 'CONFIRMED', total_amount: 50000, is_active: true },
        { id: '2', order_no: 'ORD-002', customer_id: 'c2', status: 'SHIPPED', total_amount: 75000, is_active: true },
      ];

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockOrders, error: null }),
          }),
        }),
      });

      const result = await salesService.listOrders();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      const mockError = { message: 'Database connection failed' };
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: mockError }),
          }),
        }),
      });

      await expect(salesService.listOrders()).rejects.toThrow();
    });
  });

  describe('getOrderById', () => {
    it('should fetch a single order with all details', async () => {
      const mockOrder = {
        id: '1',
        order_no: 'ORD-001',
        customer_id: 'c1',
        status: 'CONFIRMED',
        total_amount: 50000,
        order_items: [],
        customer: { id: 'c1', name: 'Customer A' },
      };

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockOrder, error: null }),
          }),
        }),
      });

      const result = await salesService.getOrderById('1');
      expect(result.order_no).toBe('ORD-001');
    });

    it('should throw NotFoundError for non-existent order', async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
      });

      await expect(salesService.getOrderById('nonexistent')).rejects.toThrow();
    });
  });

  describe('createOrder', () => {
    it('should create a new order with valid data', async () => {
      const newOrder = {
        order_no: 'ORD-003',
        customer_id: 'c1',
        status: 'DRAFT',
        total_amount: 60000,
      };

      const created = { id: '3', ...newOrder, created_at: new Date().toISOString() };

      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: created, error: null }),
          }),
        }),
      });

      const result = await salesService.createOrder(newOrder as any);
      expect(result.order_no).toBe('ORD-003');
    });

    it('should reject duplicate order number', async () => {
      const newOrder = { order_no: 'ORD-001', customer_id: 'c1', status: 'DRAFT', total_amount: 50000 };

      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { code: '23505' } }),
          }),
        }),
      });

      await expect(salesService.createOrder(newOrder as any)).rejects.toThrow();
    });
  });

  describe('updateOrder', () => {
    it('should update order status', async () => {
      const updated = { id: '1', order_no: 'ORD-001', status: 'SHIPPED', total_amount: 50000 };

      (supabase.from as any).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updated, error: null }),
            }),
          }),
        }),
      });

      const result = await salesService.updateOrder('1', { status: 'SHIPPED' } as any);
      expect(result.status).toBe('SHIPPED');
    });
  });

  describe('cancelOrder', () => {
    it('should mark order as cancelled', async () => {
      (supabase.from as any).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { status: 'CANCELLED' }, error: null }),
            }),
          }),
        }),
      });

      const result = await salesService.cancelOrder('1');
      expect(result.status).toBe('CANCELLED');
    });

    it('should prevent cancellation of shipped orders', async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { status: 'SHIPPED' },
              error: null,
            }),
          }),
        }),
      });

      await expect(salesService.cancelOrder('1')).rejects.toThrow();
    });
  });

  describe('getOrderMetrics', () => {
    it('should calculate order status distribution', async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          then: vi.fn().mockResolvedValue({
            data: [
              { status: 'DRAFT' },
              { status: 'CONFIRMED' },
              { status: 'SHIPPED' },
            ],
            error: null,
          }),
        }),
      });

      const result = await salesService.getOrderMetrics();
      expect(result).toHaveProperty('draft');
      expect(result).toHaveProperty('confirmed');
      expect(result).toHaveProperty('shipped');
    });
  });

  describe('getOrderItems', () => {
    it('should fetch items for an order', async () => {
      const mockItems = [
        { id: '1', order_id: 'o1', design_id: 'd1', quantity: 100 },
        { id: '2', order_id: 'o1', design_id: 'd2', quantity: 50 },
      ];

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            then: vi.fn().mockResolvedValue({ data: mockItems, error: null }),
          }),
        }),
      });

      const result = await salesService.getOrderItems('o1');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('createOrderItem', () => {
    it('should add item to order with validation', async () => {
      const newItem = { order_id: 'o1', design_id: 'd1', quantity: 100 };

      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: '1', ...newItem }, error: null }),
          }),
        }),
      });

      const result = await salesService.createOrderItem(newItem as any);
      expect(result.quantity).toBe(100);
    });

    it('should validate minimum quantity', async () => {
      const invalidItem = { order_id: 'o1', design_id: 'd1', quantity: 0 };
      await expect(salesService.createOrderItem(invalidItem as any)).rejects.toThrow();
    });
  });

  describe('getOrderInvoices', () => {
    it('should retrieve invoices for an order', async () => {
      const mockInvoices = [
        { id: 'i1', invoice_no: 'INV-001', order_id: 'o1', total_amount: 50000, status: 'PAID' },
      ];

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            then: vi.fn().mockResolvedValue({ data: mockInvoices, error: null }),
          }),
        }),
      });

      const result = await salesService.getOrderInvoices('o1');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getOrderFulfillment', () => {
    it('should fetch fulfillment status for order', async () => {
      const mockFulfillment = {
        order_id: 'o1',
        status: 'IN_TRANSIT',
        expected_delivery: '2026-09-30',
      };

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockFulfillment, error: null }),
          }),
        }),
      });

      const result = await salesService.getOrderFulfillment('o1');
      expect(result.status).toBe('IN_TRANSIT');
    });
  });

  describe('getCustomerOrders', () => {
    it('should list all orders for a customer', async () => {
      const mockOrders = [
        { id: '1', order_no: 'ORD-001', customer_id: 'c1', status: 'DELIVERED' },
        { id: '2', order_no: 'ORD-002', customer_id: 'c1', status: 'SHIPPED' },
      ];

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockOrders, error: null }),
          }),
        }),
      });

      const result = await salesService.getCustomerOrders('c1');
      expect(result.length).toBe(2);
    });

    it('should return empty array for customer with no orders', async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      const result = await salesService.getCustomerOrders('c_no_orders');
      expect(result.length).toBe(0);
    });
  });
});
