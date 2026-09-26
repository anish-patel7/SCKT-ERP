import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bulkOrdersService } from '../bulkOrders';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client');

describe('bulkOrdersService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateBulkImport', () => {
    it('should validate valid bulk order rows', async () => {
      const csvData = [
        {
          order_no: 'ORD-001',
          customer_id: 'c1',
          status: 'DRAFT',
          total_amount: 50000,
          notes: 'Test order',
        },
        {
          order_no: 'ORD-002',
          customer_id: 'c2',
          status: 'CONFIRMED',
          total_amount: 75000,
        },
      ];

      (supabase.from as any)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'c1' } }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'c2' } }),
            }),
          }),
        });

      const result = await bulkOrdersService.validateBulkImport(csvData);

      expect(result.total_rows).toBe(2);
      expect(result.valid_rows).toBe(2);
      expect(result.error_rows).toBe(0);
    });

    it('should detect duplicate order numbers in import', async () => {
      const csvData = [
        {
          order_no: 'ORD-001',
          customer_id: 'c1',
          status: 'DRAFT',
          total_amount: 50000,
        },
        {
          order_no: 'ORD-001',  // Duplicate
          customer_id: 'c2',
          status: 'CONFIRMED',
          total_amount: 75000,
        },
      ];

      (supabase.from as any)
        .mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        });

      const result = await bulkOrdersService.validateBulkImport(csvData);

      expect(result.error_rows).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.message.includes('Duplicate order number'))).toBe(true);
    });

    it('should detect invalid customer IDs', async () => {
      const csvData = [
        {
          order_no: 'ORD-001',
          customer_id: 'invalid-uuid',  // Invalid
          status: 'DRAFT',
          total_amount: 50000,
        },
      ];

      const result = await bulkOrdersService.validateBulkImport(csvData);

      expect(result.error_rows).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.message.includes('Invalid customer ID'))).toBe(true);
    });

    it('should reject negative amounts', async () => {
      const csvData = [
        {
          order_no: 'ORD-001',
          customer_id: 'c1',
          status: 'DRAFT',
          total_amount: -50000,  // Negative
        },
      ];

      const result = await bulkOrdersService.validateBulkImport(csvData);

      expect(result.error_rows).toBeGreaterThan(0);
    });

    it('should return preview data for valid rows', async () => {
      const csvData = Array.from({ length: 15 }, (_, i) => ({
        order_no: `ORD-${String(i + 1).padStart(3, '0')}`,
        customer_id: `c${i + 1}`,
        status: 'DRAFT',
        total_amount: 50000,
      }));

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      });

      const result = await bulkOrdersService.validateBulkImport(csvData);

      expect(result.preview_data.length).toBeLessThanOrEqual(10);
      expect(result.valid_rows).toBe(15);
    });
  });

  describe('bulkCreateOrders', () => {
    it('should create multiple orders atomically', async () => {
      const orders = [
        {
          order_no: 'ORD-001',
          customer_id: 'c1',
          status: 'DRAFT' as const,
          total_amount: 50000,
          items: [],
        },
        {
          order_no: 'ORD-002',
          customer_id: 'c2',
          status: 'CONFIRMED' as const,
          total_amount: 75000,
          items: [],
        },
      ];

      (supabase.rpc as any).mockResolvedValue({
        data: [
          { success: true, order_id: 'o1' },
          { success: true, order_id: 'o2' },
        ],
        error: null,
      });

      const result = await bulkOrdersService.bulkCreateOrders(orders);

      expect(result.status).toBe('success');
      expect(result.created_orders.length).toBe(2);
      expect(result.failed_orders.length).toBe(0);
    });

    it('should handle partial failures', async () => {
      const orders = [
        { order_no: 'ORD-001', customer_id: 'c1', status: 'DRAFT' as const, total_amount: 50000, items: [] },
        { order_no: 'ORD-002', customer_id: 'c2', status: 'CONFIRMED' as const, total_amount: 75000, items: [] },
      ];

      (supabase.rpc as any).mockResolvedValue({
        data: [
          { success: true, order_id: 'o1' },
          { success: false, error: 'Validation failed' },
        ],
        error: null,
      });

      const result = await bulkOrdersService.bulkCreateOrders(orders);

      expect(result.status).toBe('partial_success');
      expect(result.created_orders.length).toBe(1);
      expect(result.failed_orders.length).toBe(1);
    });

    it('should rollback on database error', async () => {
      const orders = [
        { order_no: 'ORD-001', customer_id: 'c1', status: 'DRAFT' as const, total_amount: 50000, items: [] },
      ];

      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'Database constraint violation' },
      });

      const result = await bulkOrdersService.bulkCreateOrders(orders);

      expect(result.status).toBe('failed');
      expect(result.created_orders.length).toBe(0);
      expect(result.failed_orders.length).toBe(1);
    });
  });

  describe('bulkStatusUpdate', () => {
    it('should update multiple orders to new status', async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            then: vi.fn().mockResolvedValue({
              data: [
                { id: 'o1', status: 'DRAFT' },
                { id: 'o2', status: 'DRAFT' },
              ],
              error: null,
            }),
          }),
        }),
      });

      (supabase.from as any).mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue(Promise.resolve({ error: null })),
        }),
      });

      const result = await bulkOrdersService.bulkStatusUpdate(['o1', 'o2'], 'CONFIRMED');

      expect(result.status).toMatch(/success|partial_success/);
    });

    it('should prevent invalid state transitions', async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            then: vi.fn().mockResolvedValue({
              data: [{ id: 'o1', status: 'DELIVERED' }],
              error: null,
            }),
          }),
        }),
      });

      const result = await bulkOrdersService.bulkStatusUpdate(['o1'], 'DRAFT');

      expect(result.failed_orders.length).toBeGreaterThan(0);
    });
  });

  describe('bulkPriceAdjustment', () => {
    it('should apply percentage discount to multiple orders', async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            then: vi.fn().mockResolvedValue({
              data: [
                { id: 'o1', total_amount: 100000 },
                { id: 'o2', total_amount: 50000 },
              ],
              error: null,
            }),
          }),
        }),
      });

      (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

      const result = await bulkOrdersService.bulkPriceAdjustment(['o1', 'o2'], 'percentage', -10);

      expect(result.status).toBe('success');
      expect(result.created_orders.length).toBe(2);
    });

    it('should apply absolute adjustment to multiple orders', async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            then: vi.fn().mockResolvedValue({
              data: [
                { id: 'o1', total_amount: 100000 },
              ],
              error: null,
            }),
          }),
        }),
      });

      (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

      const result = await bulkOrdersService.bulkPriceAdjustment(['o1'], 'absolute', 5000);

      expect(result.status).toBe('success');
    });
  });

  describe('getBulkOperationHistory', () => {
    it('should fetch bulk operation history', async () => {
      const mockOps = [
        {
          id: 'op1',
          operation_type: 'import',
          status: 'completed',
          total_records: 10,
          processed_records: 10,
          error_records: 0,
          error_log: [],
          created_by: 'user@example.com',
          created_at: new Date().toISOString(),
        },
      ];

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn().mockResolvedValue({ data: mockOps, error: null }),
            }),
          }),
        }),
      });

      const result = await bulkOrdersService.getBulkOperationHistory(50);

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
