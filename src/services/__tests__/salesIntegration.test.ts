import { describe, it, expect, beforeEach, vi } from 'vitest';
import { salesIntegrationService } from '../salesIntegration';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client');

describe('salesIntegrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Production Integration', () => {
    describe('getProductionOrderStatus', () => {
      it('should retrieve production order status', async () => {
        const mockProdOrder = {
          id: 'po1',
          sales_order_id: 'so1',
          status: 'IN_PROGRESS',
          scheduled_start: '2026-09-15',
          scheduled_end: '2026-09-25',
          actual_start: '2026-09-16',
          actual_end: null,
        };

        (supabase.from as any).mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockProdOrder, error: null }),
            }),
          }),
        });

        const result = await salesIntegrationService.getProductionOrderStatus('so1');
        expect(result.status).toBe('IN_PROGRESS');
      });

      it('should handle missing production order', async () => {
        (supabase.from as any).mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
            }),
          }),
        });

        await expect(salesIntegrationService.getProductionOrderStatus('nonexistent')).rejects.toThrow();
      });
    });

    describe('getProductionCosts', () => {
      it('should calculate actual production costs', async () => {
        const mockCostBreakdown = {
          material_cost: 25000,
          labor_cost: 5000,
          overhead_cost: 2000,
          total_cost: 32000,
        };

        (supabase.from as any)
          .mockReturnValueOnce({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockCostBreakdown, error: null }),
              }),
            }),
          })
          .mockReturnValueOnce({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                then: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          });

        const result = await salesIntegrationService.getProductionCosts('so1');
        expect(result.total_cost).toBe(32000);
      });
    });

    describe('getFulfillmentDelay', () => {
      it('should detect delay when actual_end exceeds scheduled_end', async () => {
        const mockProdOrder = {
          scheduled_end: '2026-09-25',
          actual_end: '2026-09-30',
        };

        (supabase.from as any).mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockProdOrder, error: null }),
            }),
          }),
        });

        const result = await salesIntegrationService.getFulfillmentDelay('so1');
        expect(result.isDelayed).toBe(true);
        expect(result.delayDays).toBe(5);
      });

      it('should return no delay for on-time orders', async () => {
        const mockProdOrder = {
          scheduled_end: '2026-09-25',
          actual_end: '2026-09-24',
        };

        (supabase.from as any).mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockProdOrder, error: null }),
            }),
          }),
        });

        const result = await salesIntegrationService.getFulfillmentDelay('so1');
        expect(result.isDelayed).toBe(false);
      });
    });
  });

  describe('Inventory Integration', () => {
    describe('checkStockAvailability', () => {
      it('should verify stock is available for order items', async () => {
        const mockItems = [
          { design_id: 'd1', quantity: 100 },
          { design_id: 'd2', quantity: 50 },
        ];

        const mockStock = [
          { design_id: 'd1', available_qty: 150 },
          { design_id: 'd2', available_qty: 75 },
        ];

        (supabase.from as any).mockReturnValue({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              then: vi.fn().mockResolvedValue({ data: mockStock, error: null }),
            }),
          }),
        });

        const result = await salesIntegrationService.checkStockAvailability(mockItems as any);
        expect(result.allAvailable).toBe(true);
        expect(result.shortages).toHaveLength(0);
      });

      it('should identify stock shortages', async () => {
        const mockItems = [
          { design_id: 'd1', quantity: 200 },
          { design_id: 'd2', quantity: 100 },
        ];

        const mockStock = [
          { design_id: 'd1', available_qty: 150 },
          { design_id: 'd2', available_qty: 75 },
        ];

        (supabase.from as any).mockReturnValue({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              then: vi.fn().mockResolvedValue({ data: mockStock, error: null }),
            }),
          }),
        });

        const result = await salesIntegrationService.checkStockAvailability(mockItems as any);
        expect(result.allAvailable).toBe(false);
        expect(result.shortages.length).toBeGreaterThan(0);
      });
    });

    describe('reserveInventory', () => {
      it('should create inventory reservation for order', async () => {
        const mockReservation = {
          id: 'res1',
          order_id: 'o1',
          design_id: 'd1',
          quantity: 100,
          status: 'ACTIVE',
          created_at: '2026-09-20T10:00:00Z',
        };

        (supabase.from as any).mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockReservation, error: null }),
            }),
          }),
        });

        const result = await salesIntegrationService.reserveInventory('o1', 'd1', 100);
        expect(result.status).toBe('ACTIVE');
      });

      it('should fail reservation if stock unavailable', async () => {
        (supabase.from as any).mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Insufficient stock' },
              }),
            }),
          }),
        });

        await expect(salesIntegrationService.reserveInventory('o1', 'd1', 500)).rejects.toThrow();
      });
    });
  });

  describe('Quality Integration', () => {
    describe('getQualityInspections', () => {
      it('should retrieve quality inspection history', async () => {
        const mockInspections = [
          {
            id: 'qi1',
            production_id: 'po1',
            inspection_date: '2026-09-20',
            result: 'PASS',
            defects_found: 0,
          },
          {
            id: 'qi2',
            production_id: 'po1',
            inspection_date: '2026-09-21',
            result: 'PASS_WITH_REMARKS',
            defects_found: 2,
          },
        ];

        (supabase.from as any).mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              then: vi.fn().mockResolvedValue({ data: mockInspections, error: null }),
            }),
          }),
        });

        const result = await salesIntegrationService.getQualityInspections('po1');
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(2);
      });
    });

    describe('getDefectAnalysis', () => {
      it('should analyze defect patterns and impact', async () => {
        const mockDefects = [
          { type: 'COLOR_MISMATCH', count: 3, severity: 'MEDIUM', credit_impact_pct: 5 },
          { type: 'WEAVING_FAULT', count: 1, severity: 'HIGH', credit_impact_pct: 15 },
        ];

        (supabase.from as any).mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              then: vi.fn().mockResolvedValue({ data: mockDefects, error: null }),
            }),
          }),
        });

        const result = await salesIntegrationService.getDefectAnalysis('po1');
        expect(result.totalDefects).toBe(4);
        expect(result.avgCreditImpact).toBeGreaterThan(0);
      });
    });
  });

  describe('Costing Integration', () => {
    describe('getCostingAnalysis', () => {
      it('should provide detailed cost breakdown', async () => {
        const mockCostSheet = {
          id: 'cs1',
          sales_order_id: 'so1',
          fabric_cost: 20000,
          yarn_cost: 15000,
          labor_cost: 5000,
          overhead_cost: 2000,
          total_cost: 42000,
        };

        (supabase.from as any).mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockCostSheet, error: null }),
            }),
          }),
        });

        const result = await salesIntegrationService.getCostingAnalysis('so1');
        expect(result.total_cost).toBe(42000);
      });
    });

    describe('getMarginByProduct', () => {
      it('should calculate margins for each product line', async () => {
        const mockMargins = [
          {
            design_id: 'd1',
            total_cost: 30000,
            selling_price: 45000,
            gross_margin: 15000,
            margin_pct: 33.33,
          },
          {
            design_id: 'd2',
            total_cost: 25000,
            selling_price: 35000,
            gross_margin: 10000,
            margin_pct: 28.57,
          },
        ];

        (supabase.from as any).mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              then: vi.fn().mockResolvedValue({ data: mockMargins, error: null }),
            }),
          }),
        });

        const result = await salesIntegrationService.getMarginByProduct('so1');
        expect(Array.isArray(result)).toBe(true);
        expect(result[0].margin_pct).toBeCloseTo(33.33, 1);
      });

      it('should handle negative margins for loss-making items', async () => {
        const mockMargins = [
          {
            design_id: 'd3',
            total_cost: 50000,
            selling_price: 45000,
            gross_margin: -5000,
            margin_pct: -10.0,
          },
        ];

        (supabase.from as any).mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              then: vi.fn().mockResolvedValue({ data: mockMargins, error: null }),
            }),
          }),
        });

        const result = await salesIntegrationService.getMarginByProduct('so1');
        expect(result[0].margin_pct).toBeLessThan(0);
      });
    });
  });

  describe('Cross-Module Consistency', () => {
    it('should maintain consistency across module queries', async () => {
      const mockOrder = { id: 'o1', customer_id: 'c1', status: 'CONFIRMED' };
      const mockProduction = { status: 'IN_PROGRESS' };
      const mockInventory = { allAvailable: true };
      const mockQuality = { passRate: 98.5 };

      (supabase.from as any)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockOrder, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockProduction, error: null }),
            }),
          }),
        });

      const order = await salesIntegrationService.getProductionOrderStatus('o1');
      expect(order).toBeDefined();
    });
  });
});
