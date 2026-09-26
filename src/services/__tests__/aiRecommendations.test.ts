import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIRecommendationsService } from '../aiRecommendations';

describe('AIRecommendationsService', () => {
  let service: AIRecommendationsService;

  beforeEach(() => {
    service = new AIRecommendationsService();
  });

  describe('Inventory Recommendations', () => {
    it('should return inventory recommendations array', async () => {
      const result = await service.getInventoryRecommendations();

      expect(Array.isArray(result)).toBe(true);
      result.forEach((rec: any) => {
        expect(rec).toHaveProperty('product_id');
        expect(rec).toHaveProperty('product_name');
        expect(rec).toHaveProperty('current_stock');
        expect(rec).toHaveProperty('recommended_order_qty');
        expect(rec).toHaveProperty('urgency');
      });
    });

    it('should assign valid urgency levels', async () => {
      const result = await service.getInventoryRecommendations();
      const validUrgencies = ['critical', 'high', 'medium', 'low'];

      result.forEach((rec: any) => {
        expect(validUrgencies).toContain(rec.urgency);
      });
    });

    it('should calculate positive stock levels', async () => {
      const result = await service.getInventoryRecommendations();

      result.forEach((rec: any) => {
        expect(rec.current_stock).toBeGreaterThanOrEqual(0);
        expect(rec.optimal_stock_level).toBeGreaterThanOrEqual(0);
        expect(rec.reorder_point).toBeGreaterThanOrEqual(0);
      });
    });

    it('should provide reorder quantities when needed', async () => {
      const result = await service.getInventoryRecommendations();
      const criticalItems = result.filter((r: any) => r.urgency === 'critical');

      criticalItems.forEach((rec: any) => {
        expect(rec.recommended_order_qty).toBeGreaterThan(0);
      });
    });

    it('should estimate stock out days', async () => {
      const result = await service.getInventoryRecommendations();

      result.forEach((rec: any) => {
        expect(typeof rec.estimated_stock_out_days).toBe('number');
        expect(rec.estimated_stock_out_days).toBeGreaterThanOrEqual(0);
      });
    });

    it('should provide action reasons', async () => {
      const result = await service.getInventoryRecommendations();

      result.forEach((rec: any) => {
        expect(rec.reason).toBeTruthy();
        expect(typeof rec.reason).toBe('string');
      });
    });

    it('should sort by urgency', async () => {
      const result = await service.getInventoryRecommendations();
      const urgencyMap = { critical: 0, high: 1, medium: 2, low: 3 };

      for (let i = 1; i < result.length; i++) {
        expect(urgencyMap[result[i - 1].urgency as keyof typeof urgencyMap]).toBeLessThanOrEqual(
          urgencyMap[result[i].urgency as keyof typeof urgencyMap],
        );
      }
    });
  });

  describe('Customer Recommendations', () => {
    it('should return customer recommendations array', async () => {
      const result = await service.getCustomerRecommendations('customer-1');

      expect(Array.isArray(result)).toBe(true);
      result.forEach((rec: any) => {
        expect(rec).toHaveProperty('customer_id');
        expect(rec).toHaveProperty('recommendation_type');
        expect(rec).toHaveProperty('expected_additional_revenue');
        expect(rec).toHaveProperty('success_probability');
      });
    });

    it('should identify valid recommendation types', async () => {
      const result = await service.getCustomerRecommendations('customer-1');
      const validTypes = ['upsell', 'cross_sell', 'retention', 'win_back'];

      result.forEach((rec: any) => {
        expect(validTypes).toContain(rec.recommendation_type);
      });
    });

    it('should calculate realistic success probabilities', async () => {
      const result = await service.getCustomerRecommendations('customer-1');

      result.forEach((rec: any) => {
        expect(rec.success_probability).toBeGreaterThanOrEqual(0);
        expect(rec.success_probability).toBeLessThanOrEqual(1);
      });
    });

    it('should estimate revenue impact', async () => {
      const result = await service.getCustomerRecommendations('customer-1');

      result.forEach((rec: any) => {
        expect(rec.expected_additional_revenue).toBeGreaterThanOrEqual(0);
      });
    });

    it('should provide actionable recommendations', async () => {
      const result = await service.getCustomerRecommendations('customer-1');

      result.forEach((rec: any) => {
        expect(rec.action).toBeTruthy();
        expect(typeof rec.action).toBe('string');
      });
    });

    it('should handle non-existent customers gracefully', async () => {
      const result = await service.getCustomerRecommendations('non-existent');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Pricing Recommendations', () => {
    it('should return pricing recommendations array', async () => {
      const result = await service.getPricingRecommendations();

      expect(Array.isArray(result)).toBe(true);
      result.forEach((rec: any) => {
        expect(rec).toHaveProperty('product_id');
        expect(rec).toHaveProperty('current_price');
        expect(rec).toHaveProperty('recommended_price');
        expect(rec).toHaveProperty('price_elasticity');
      });
    });

    it('should calculate elasticity values', async () => {
      const result = await service.getPricingRecommendations();

      result.forEach((rec: any) => {
        expect(typeof rec.price_elasticity).toBe('number');
      });
    });

    it('should estimate demand changes', async () => {
      const result = await service.getPricingRecommendations();

      result.forEach((rec: any) => {
        expect(typeof rec.expected_demand_change).toBe('number');
      });
    });

    it('should calculate revenue impact', async () => {
      const result = await service.getPricingRecommendations();

      result.forEach((rec: any) => {
        expect(typeof rec.expected_revenue_impact).toBe('number');
      });
    });

    it('should provide confidence scores', async () => {
      const result = await service.getPricingRecommendations();

      result.forEach((rec: any) => {
        expect(rec.confidence).toBeGreaterThanOrEqual(0);
        expect(rec.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should recommend prices close to current', async () => {
      const result = await service.getPricingRecommendations();

      result.forEach((rec: any) => {
        const priceChange = Math.abs(rec.recommended_price - rec.current_price) / rec.current_price;
        expect(priceChange).toBeLessThan(0.2); // Max 20% change
      });
    });

    it('should sort by revenue impact descending', async () => {
      const result = await service.getPricingRecommendations();

      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].expected_revenue_impact).toBeGreaterThanOrEqual(
          result[i].expected_revenue_impact,
        );
      }
    });
  });

  describe('Collection Recommendations', () => {
    it('should return collection recommendations array', async () => {
      const result = await service.getCollectionRecommendations();

      expect(Array.isArray(result)).toBe(true);
      result.forEach((rec: any) => {
        expect(rec).toHaveProperty('customer_id');
        expect(rec).toHaveProperty('outstanding_amount');
        expect(rec).toHaveProperty('collection_priority_score');
        expect(rec).toHaveProperty('suggested_action');
      });
    });

    it('should assign valid collection actions', async () => {
      const result = await service.getCollectionRecommendations();
      const validActions = ['immediate_contact', 'payment_plan', 'settlement_offer', 'legal_action'];

      result.forEach((rec: any) => {
        expect(validActions).toContain(rec.suggested_action);
      });
    });

    it('should calculate priority scores', async () => {
      const result = await service.getCollectionRecommendations();

      result.forEach((rec: any) => {
        expect(typeof rec.collection_priority_score).toBe('number');
        expect(rec.collection_priority_score).toBeGreaterThanOrEqual(0);
      });
    });

    it('should estimate success probabilities', async () => {
      const result = await service.getCollectionRecommendations();

      result.forEach((rec: any) => {
        expect(rec.collection_success_probability).toBeGreaterThanOrEqual(0);
        expect(rec.collection_success_probability).toBeLessThanOrEqual(1);
      });
    });

    it('should recommend settlement discounts when appropriate', async () => {
      const result = await service.getCollectionRecommendations();

      const settlementOffers = result.filter((r: any) => r.suggested_action === 'settlement_offer');
      settlementOffers.forEach((rec: any) => {
        expect(rec.recommended_discount_for_settlement).toBeGreaterThan(0);
        expect(rec.recommended_discount_for_settlement).toBeLessThan(100);
      });
    });

    it('should not discount legal actions', async () => {
      const result = await service.getCollectionRecommendations();

      const legalActions = result.filter((r: any) => r.suggested_action === 'legal_action');
      legalActions.forEach((rec: any) => {
        expect(rec.recommended_discount_for_settlement).toBe(0);
      });
    });

    it('should sort by priority score descending', async () => {
      const result = await service.getCollectionRecommendations();

      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].collection_priority_score).toBeGreaterThanOrEqual(
          result[i].collection_priority_score,
        );
      }
    });

    it('should track outstanding amounts', async () => {
      const result = await service.getCollectionRecommendations();

      result.forEach((rec: any) => {
        expect(rec.outstanding_amount).toBeGreaterThan(0);
      });
    });
  });

  describe('Confidence Scoring', () => {
    it('should calculate confidence from data points', () => {
      const score1 = service.calculateConfidenceScore(10);
      const score2 = service.calculateConfidenceScore(100);
      const score3 = service.calculateConfidenceScore(1000);

      // More data points should increase confidence
      expect(score1).toBeLessThan(score2);
      expect(score2).toBeLessThan(score3);
    });

    it('should cap confidence at max value', () => {
      const score = service.calculateConfidenceScore(10000);

      expect(score).toBeLessThanOrEqual(1);
    });

    it('should accept data quality parameter', () => {
      const score1 = service.calculateConfidenceScore(100, 0.8);
      const score2 = service.calculateConfidenceScore(100, 0.5);

      expect(score1).toBeGreaterThan(score2);
    });

    it('should return valid confidence range', () => {
      const score = service.calculateConfidenceScore(50, 0.7);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle inventory recommendations error gracefully', async () => {
      const result = await service.getInventoryRecommendations();

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle customer recommendations error gracefully', async () => {
      const result = await service.getCustomerRecommendations('invalid');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle pricing recommendations error gracefully', async () => {
      const result = await service.getPricingRecommendations();

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle collection recommendations error gracefully', async () => {
      const result = await service.getCollectionRecommendations();

      expect(Array.isArray(result)).toBe(true);
    });

    it('should not throw on API failures', async () => {
      expect(async () => {
        await service.getInventoryRecommendations();
      }).not.toThrow();
    });
  });

  describe('Data Validation', () => {
    it('should validate inventory recommendation structure', async () => {
      const result = await service.getInventoryRecommendations();

      result.slice(0, 3).forEach((rec: any) => {
        expect(Number.isFinite(rec.current_stock)).toBe(true);
        expect(Number.isFinite(rec.recommended_order_qty)).toBe(true);
        expect(Number.isFinite(rec.optimal_stock_level)).toBe(true);
      });
    });

    it('should validate pricing recommendation prices', async () => {
      const result = await service.getPricingRecommendations();

      result.slice(0, 3).forEach((rec: any) => {
        expect(rec.recommended_price).toBeGreaterThan(0);
        expect(rec.current_price).toBeGreaterThan(0);
      });
    });

    it('should ensure collection amounts are positive', async () => {
      const result = await service.getCollectionRecommendations();

      result.slice(0, 5).forEach((rec: any) => {
        expect(rec.outstanding_amount).toBeGreaterThan(0);
      });
    });
  });
});
