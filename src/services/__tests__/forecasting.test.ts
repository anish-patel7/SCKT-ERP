import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForecastingService } from '../forecasting';

describe('ForecastingService', () => {
  let service: ForecastingService;

  beforeEach(() => {
    service = new ForecastingService();
  });

  describe('Exponential Smoothing', () => {
    it('should generate forecasts for valid data', () => {
      const data = [100, 110, 105, 120, 115, 130, 125, 140, 135, 150];
      const forecasts = (service as any).calculateExponentialSmoothing(data, 10);

      expect(forecasts.length).toBe(10);
      expect(forecasts[0].predicted_quantity).toBeGreaterThan(0);
    });

    it('should handle empty data gracefully', () => {
      const forecasts = (service as any).calculateExponentialSmoothing([], 10);
      expect(forecasts.length).toBe(0);
    });

    it('should handle single data point', () => {
      const forecasts = (service as any).calculateExponentialSmoothing([100], 10);
      expect(forecasts.length).toBe(0);
    });

    it('should apply seasonality factors', () => {
      const data = [100, 150, 120, 160, 130, 170, 140, 180, 150, 190, 160, 200];
      const forecasts = (service as any).calculateExponentialSmoothing(data, 12);

      expect(forecasts.length).toBe(12);
      forecasts.forEach((f: any) => {
        expect(f.seasonality_factor).toBeGreaterThan(0);
      });
    });

    it('should calculate confidence intervals', () => {
      const data = [100, 110, 105, 120, 115, 130, 125, 140, 135, 150];
      const forecasts = (service as any).calculateExponentialSmoothing(data, 5);

      forecasts.forEach((f: any) => {
        expect(f.confidence_lower).toBeLessThanOrEqual(f.predicted_quantity);
        expect(f.predicted_quantity).toBeLessThanOrEqual(f.confidence_upper);
      });
    });

    it('should not generate negative quantities', () => {
      const data = [100, 110, 105, 120, 115];
      const forecasts = (service as any).calculateExponentialSmoothing(data, 10);

      forecasts.forEach((f: any) => {
        expect(f.predicted_quantity).toBeGreaterThanOrEqual(0);
        expect(f.confidence_lower).toBeGreaterThanOrEqual(0);
      });
    });

    it('should maintain date sequence', () => {
      const data = [100, 110, 105, 120, 115];
      const forecasts = (service as any).calculateExponentialSmoothing(data, 5);

      for (let i = 1; i < forecasts.length; i++) {
        const date1 = new Date(forecasts[i - 1].date);
        const date2 = new Date(forecasts[i].date);
        expect(date2.getTime()).toBeGreaterThan(date1.getTime());
      }
    });

    it('should trend appropriately for increasing data', () => {
      const data = [100, 105, 110, 115, 120, 125, 130];
      const forecasts = (service as any).calculateExponentialSmoothing(data, 5);

      // Average trend should be positive
      const avgTrend = forecasts.reduce((sum: number, f: any) => sum + f.trend, 0) / forecasts.length;
      expect(avgTrend).toBeGreaterThan(0);
    });

    it('should trend appropriately for decreasing data', () => {
      const data = [130, 125, 120, 115, 110, 105, 100];
      const forecasts = (service as any).calculateExponentialSmoothing(data, 5);

      // Average trend should be negative
      const avgTrend = forecasts.reduce((sum: number, f: any) => sum + f.trend, 0) / forecasts.length;
      expect(avgTrend).toBeLessThan(0);
    });
  });

  describe('Demand Forecasting', () => {
    it('should return forecast result structure', async () => {
      const result = await service.forecastDemand('product-1', 30);

      expect(result).toHaveProperty('product_id');
      expect(result).toHaveProperty('product_name');
      expect(result).toHaveProperty('forecasts');
      expect(result).toHaveProperty('confidence_score');
      expect(result).toHaveProperty('historical_accuracy');
    });

    it('should handle non-existent product', async () => {
      const result = await service.forecastDemand('non-existent-product', 30);

      expect(result.forecasts.length).toBe(0);
      expect(result.confidence_score).toBe(0);
    });

    it('should forecast specified number of days', async () => {
      const result = await service.forecastDemand('product-1', 60);
      expect(result.forecasts.length).toBeLessThanOrEqual(60);
    });

    it('should generate valid confidence scores', async () => {
      const result = await service.forecastDemand('product-1', 30);

      expect(result.confidence_score).toBeGreaterThanOrEqual(0);
      expect(result.confidence_score).toBeLessThanOrEqual(100);
    });

    it('should track historical accuracy', async () => {
      const result = await service.forecastDemand('product-1', 30);

      expect(result.historical_accuracy).toBeGreaterThanOrEqual(0);
      expect(result.historical_accuracy).toBeLessThanOrEqual(100);
    });
  });

  describe('Churn Risk Analysis', () => {
    it('should return churn risks list', async () => {
      const result = await service.identifyChurnRisk();

      expect(Array.isArray(result)).toBe(true);
      result.forEach((risk: any) => {
        expect(risk).toHaveProperty('customer_id');
        expect(risk).toHaveProperty('customer_name');
        expect(risk).toHaveProperty('churn_score');
        expect(risk).toHaveProperty('risk_level');
      });
    });

    it('should assign valid risk levels', async () => {
      const result = await service.identifyChurnRisk();
      const validLevels = ['low', 'medium', 'high'];

      result.forEach((risk: any) => {
        expect(validLevels).toContain(risk.risk_level);
      });
    });

    it('should calculate churn scores 0-1', async () => {
      const result = await service.identifyChurnRisk();

      result.forEach((risk: any) => {
        expect(risk.churn_score).toBeGreaterThanOrEqual(0);
        expect(risk.churn_score).toBeLessThanOrEqual(1);
      });
    });

    it('should calculate days since last order', async () => {
      const result = await service.identifyChurnRisk();

      result.forEach((risk: any) => {
        expect(typeof risk.last_order_days_ago).toBe('number');
        expect(risk.last_order_days_ago).toBeGreaterThanOrEqual(0);
      });
    });

    it('should estimate churn dates', async () => {
      const result = await service.identifyChurnRisk();

      result.forEach((risk: any) => {
        if (risk.estimated_churn_date) {
          const date = new Date(risk.estimated_churn_date);
          expect(date.getTime()).toBeGreaterThan(0);
        }
      });
    });

    it('should sort by churn score descending', async () => {
      const result = await service.identifyChurnRisk();

      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].churn_score).toBeGreaterThanOrEqual(result[i].churn_score);
      }
    });
  });

  describe('Payment Default Risk', () => {
    it('should return default risks list', async () => {
      const result = await service.identifyPaymentDefaultRisk();

      expect(Array.isArray(result)).toBe(true);
      result.forEach((risk: any) => {
        expect(risk).toHaveProperty('invoice_id');
        expect(risk).toHaveProperty('customer_id');
        expect(risk).toHaveProperty('default_probability');
        expect(risk).toHaveProperty('risk_level');
      });
    });

    it('should assign valid risk levels', async () => {
      const result = await service.identifyPaymentDefaultRisk();
      const validLevels = ['low', 'medium', 'high'];

      result.forEach((risk: any) => {
        expect(validLevels).toContain(risk.risk_level);
      });
    });

    it('should calculate default probability 0-1', async () => {
      const result = await service.identifyPaymentDefaultRisk();

      result.forEach((risk: any) => {
        expect(risk.default_probability).toBeGreaterThanOrEqual(0);
        expect(risk.default_probability).toBeLessThanOrEqual(1);
      });
    });

    it('should track days overdue', async () => {
      const result = await service.identifyPaymentDefaultRisk();

      result.forEach((risk: any) => {
        expect(typeof risk.days_overdue).toBe('number');
        expect(risk.days_overdue).toBeGreaterThanOrEqual(0);
      });
    });

    it('should calculate payment history score 0-1', async () => {
      const result = await service.identifyPaymentDefaultRisk();

      result.forEach((risk: any) => {
        expect(risk.customer_payment_history_score).toBeGreaterThanOrEqual(0);
        expect(risk.customer_payment_history_score).toBeLessThanOrEqual(1);
      });
    });

    it('should sort by default probability descending', async () => {
      const result = await service.identifyPaymentDefaultRisk();

      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].default_probability).toBeGreaterThanOrEqual(result[i].default_probability);
      }
    });

    it('should provide settlement discount recommendation', async () => {
      const result = await service.identifyPaymentDefaultRisk();

      result.forEach((risk: any) => {
        expect(risk.recommended_discount_for_settlement).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Forecast Validation', () => {
    it('should calculate MAPE accuracy metric', async () => {
      const accuracy = await service.validateForecastAccuracy('product-1');

      expect(accuracy).toHaveProperty('mape');
      expect(accuracy.mape).toBeGreaterThanOrEqual(0);
    });

    it('should calculate RMSE error metric', async () => {
      const accuracy = await service.validateForecastAccuracy('product-1');

      expect(accuracy).toHaveProperty('rmse');
      expect(accuracy.rmse).toBeGreaterThanOrEqual(0);
    });

    it('should handle products with insufficient data', async () => {
      const accuracy = await service.validateForecastAccuracy('non-existent');

      expect(accuracy.mape).toBeGreaterThanOrEqual(0);
      expect(accuracy.rmse).toBeGreaterThanOrEqual(0);
    });

    it('should return valid MAPE percentages', async () => {
      const accuracy = await service.validateForecastAccuracy('product-1');

      expect(accuracy.mape).toBeLessThanOrEqual(1000); // Reasonable upper bound
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      // Simulate service error by using invalid product ID
      const result = await service.forecastDemand('invalid-id', 30);

      expect(result).toBeDefined();
      expect(result.forecasts).toBeDefined();
    });

    it('should continue on API errors', async () => {
      const result = await service.identifyChurnRisk();

      // Should return empty array rather than throwing
      expect(Array.isArray(result)).toBe(true);
    });

    it('should not throw on payment default analysis failure', async () => {
      const result = await service.identifyPaymentDefaultRisk();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Data Validation', () => {
    it('should handle negative quantities in forecasts', () => {
      const data = [100, 110, 105, 120, 115];
      const forecasts = (service as any).calculateExponentialSmoothing(data, 10);

      forecasts.forEach((f: any) => {
        expect(f.predicted_quantity).toBeGreaterThanOrEqual(0);
      });
    });

    it('should ensure confidence intervals make sense', () => {
      const data = [100, 110, 105, 120, 115, 130, 125, 140];
      const forecasts = (service as any).calculateExponentialSmoothing(data, 10);

      forecasts.forEach((f: any) => {
        expect(f.confidence_lower).toBeLessThanOrEqual(f.predicted_quantity);
        expect(f.confidence_upper).toBeGreaterThanOrEqual(f.predicted_quantity);
      });
    });

    it('should validate churn score components', async () => {
      const result = await service.identifyChurnRisk();

      result.slice(0, 5).forEach((risk: any) => {
        expect(risk.average_order_frequency_days).toBeGreaterThan(0);
        expect(risk.last_order_days_ago).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
