import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

interface HistoricalSalesData {
  date: string;
  quantity: number;
  revenue: number;
  customer_id: string;
  product_id: string;
}

interface ForecastResult {
  date: string;
  predicted_quantity: number;
  confidence_lower: number;
  confidence_upper: number;
  seasonality_factor: number;
  trend: number;
}

interface ChurnRisk {
  customer_id: string;
  customer_name: string;
  churn_score: number; // 0-1
  risk_level: 'low' | 'medium' | 'high';
  last_order_days_ago: number;
  average_order_frequency_days: number;
  estimated_churn_date: string;
}

interface PaymentDefaultRisk {
  invoice_id: string;
  customer_id: string;
  customer_name: string;
  default_probability: number; // 0-1
  risk_level: 'low' | 'medium' | 'high';
  days_overdue: number;
  invoice_amount: number;
  customer_payment_history_score: number;
}

interface DemandForecast {
  product_id: string;
  product_name: string;
  forecasts: ForecastResult[];
  confidence_score: number;
  historical_accuracy: number;
}

export class ForecastingService {
  /**
   * Calculate exponential smoothing forecast
   * Uses triple exponential smoothing (Holt-Winters) for seasonal data
   */
  private calculateExponentialSmoothing(
    data: number[],
    periods: number = 30,
    alpha: number = 0.3,
    beta: number = 0.2,
    gamma: number = 0.1,
  ): ForecastResult[] {
    const results: ForecastResult[] = [];

    if (data.length < 2) {
      return results;
    }

    let level = data[0];
    let trend = (data[1] - data[0]) / (data.length > 1 ? data.length : 1);
    const seasonal = new Array(12).fill(1); // Monthly seasonality

    for (let t = 1; t < data.length; t++) {
      const observation = data[t];
      const seasonalIndex = t % 12;

      // Calculate components
      const prevLevel = level;
      level = alpha * observation / seasonal[seasonalIndex] + (1 - alpha) * (level + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
      seasonal[seasonalIndex] = gamma * observation / level + (1 - gamma) * seasonal[seasonalIndex];
    }

    // Generate forecasts
    const baseDate = new Date();
    for (let i = 1; i <= periods; i++) {
      const forecastDate = new Date(baseDate);
      forecastDate.setDate(forecastDate.getDate() + i);
      const seasonalIndex = (data.length + i) % 12;

      const predicted = (level + trend * i) * seasonal[seasonalIndex];
      const stdError = Math.sqrt(
        data.reduce((sum, val, idx) => {
          const fitted = idx === 0 ? data[0] : (level + trend * (idx - data.length)) * seasonal[idx % 12];
          return sum + Math.pow(val - fitted, 2);
        }, 0) / Math.max(data.length - 1, 1),
      );

      results.push({
        date: forecastDate.toISOString().split('T')[0],
        predicted_quantity: Math.max(0, Math.round(predicted)),
        confidence_lower: Math.max(0, Math.round(predicted - 1.96 * stdError)),
        confidence_upper: Math.round(predicted + 1.96 * stdError),
        seasonality_factor: seasonalIndex > 0 ? seasonal[seasonalIndex] : 1,
        trend: trend,
      });
    }

    return results;
  }

  /**
   * Forecast demand for a product
   */
  async forecastDemand(productId: string, forecastDays: number = 90): Promise<DemandForecast> {
    try {
      // Fetch historical sales data
      const { data: sales, error } = await supabase
        .from('sales_order_items')
        .select(
          `
          quantity,
          created_at,
          sales_orders (
            customer_id,
            total_amount
          )
        `,
        )
        .eq('product_id', productId)
        .order('created_at', { ascending: true })
        .limit(365);

      if (error) throw new Error(`Failed to fetch sales data: ${error.message}`);

      // Aggregate daily sales
      const dailyQuantities: Record<string, number> = {};
      (sales || []).forEach((item: any) => {
        const date = item.created_at.split('T')[0];
        dailyQuantities[date] = (dailyQuantities[date] || 0) + item.quantity;
      });

      const quantityArray = Object.values(dailyQuantities).map((q) => Number(q));

      if (quantityArray.length < 2) {
        return {
          product_id: productId,
          product_name: '',
          forecasts: [],
          confidence_score: 0,
          historical_accuracy: 0,
        };
      }

      // Calculate forecast
      const forecasts = this.calculateExponentialSmoothing(quantityArray, forecastDays);

      // Calculate historical accuracy (MAPE)
      const testPeriod = Math.min(30, Math.floor(quantityArray.length / 3));
      let mapeSum = 0;
      for (let i = quantityArray.length - testPeriod; i < quantityArray.length; i++) {
        const actual = quantityArray[i];
        const predicted = quantityArray[i - testPeriod] || actual;
        if (actual > 0) {
          mapeSum += Math.abs((actual - predicted) / actual);
        }
      }
      const mape = (1 - mapeSum / Math.max(testPeriod, 1)) * 100;

      return {
        product_id: productId,
        product_name: '',
        forecasts,
        confidence_score: Math.min(100, Math.max(0, mape)),
        historical_accuracy: Math.min(100, Math.max(0, mape)),
      };
    } catch (error) {
      console.error('Forecasting error:', error);
      return {
        product_id: productId,
        product_name: '',
        forecasts: [],
        confidence_score: 0,
        historical_accuracy: 0,
      };
    }
  }

  /**
   * Identify customers at risk of churning
   */
  async identifyChurnRisk(): Promise<ChurnRisk[]> {
    try {
      const { data: customers, error } = await supabase
        .from('profiles')
        .select(
          `
          id,
          name,
          sales_orders (
            created_at,
            order_no
          )
        `,
        )
        .limit(500);

      if (error) throw new Error(`Failed to fetch customers: ${error.message}`);

      const churnRisks: ChurnRisk[] = [];
      const today = new Date();

      (customers || []).forEach((customer: any) => {
        const orders = customer.sales_orders || [];
        if (orders.length === 0) return;

        // Sort by date
        const sortedOrders = [...orders].sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );

        const lastOrderDate = new Date(sortedOrders[0].created_at);
        const daysSinceLastOrder = Math.floor(
          (today.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        // Calculate average order frequency
        const orderDates = sortedOrders.map((o: any) => new Date(o.created_at).getTime());
        let totalDays = 0;
        for (let i = 0; i < orderDates.length - 1; i++) {
          totalDays += (orderDates[i] - orderDates[i + 1]) / (1000 * 60 * 60 * 24);
        }
        const avgFrequencyDays = Math.ceil(totalDays / Math.max(orderDates.length - 1, 1));

        // Calculate churn score
        let churnScore = 0;

        // Factor 1: Recency (40% weight)
        if (avgFrequencyDays > 0) {
          const recencyRatio = daysSinceLastOrder / avgFrequencyDays;
          churnScore += Math.min(0.4, (recencyRatio - 1) * 0.1) * 100;
        }

        // Factor 2: Order frequency decline (30% weight)
        const recentOrderCount = sortedOrders.filter(
          (o: any) =>
            (today.getTime() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24) < 90,
        ).length;
        const historicalAvg = orders.length / Math.max((daysSinceLastOrder || 1) / avgFrequencyDays, 1);
        if (historicalAvg > 0) {
          const frequencyDecline = Math.max(0, 1 - recentOrderCount / historicalAvg);
          churnScore += frequencyDecline * 30;
        }

        // Factor 3: Time since last order (30% weight)
        const daysThreshold = avgFrequencyDays * 1.5;
        if (daysSinceLastOrder > daysThreshold) {
          churnScore += (daysSinceLastOrder / daysThreshold) * 30;
        }

        churnScore = Math.min(100, churnScore);

        const estimatedChurnDate = new Date(lastOrderDate);
        estimatedChurnDate.setDate(estimatedChurnDate.getDate() + avgFrequencyDays * 2);

        churnRisks.push({
          customer_id: customer.id,
          customer_name: customer.name || 'Unknown',
          churn_score: churnScore / 100,
          risk_level: churnScore > 70 ? 'high' : churnScore > 40 ? 'medium' : 'low',
          last_order_days_ago: daysSinceLastOrder,
          average_order_frequency_days: avgFrequencyDays,
          estimated_churn_date: estimatedChurnDate.toISOString().split('T')[0],
        });
      });

      return churnRisks.sort((a, b) => b.churn_score - a.churn_score);
    } catch (error) {
      console.error('Churn analysis error:', error);
      return [];
    }
  }

  /**
   * Identify invoices at payment default risk
   */
  async identifyPaymentDefaultRisk(): Promise<PaymentDefaultRisk[]> {
    try {
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(
          `
          id,
          customer_id,
          amount,
          due_date,
          status,
          sales_orders (
            customer_id,
            customers (
              name
            )
          )
        `,
        )
        .eq('status', 'pending')
        .limit(500);

      if (error) throw new Error(`Failed to fetch invoices: ${error.message}`);

      const risks: PaymentDefaultRisk[] = [];
      const today = new Date();

      for (const invoice of invoices || []) {
        const dueDate = new Date(invoice.due_date);
        const daysOverdue = Math.max(
          0,
          Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)),
        );

        // Fetch customer payment history
        const { data: customerInvoices } = await supabase
          .from('invoices')
          .select('status, due_date, created_at')
          .eq('customer_id', invoice.customer_id)
          .limit(20);

        let paymentHistory = 0;
        if (customerInvoices && customerInvoices.length > 0) {
          const paidOnTime = (customerInvoices as any[]).filter(
            (inv: any) =>
              inv.status === 'paid' &&
              new Date(inv.created_at).getTime() <= new Date(inv.due_date).getTime(),
          ).length;
          paymentHistory = paidOnTime / customerInvoices.length;
        }

        // Calculate default probability
        let defaultProbability = 0;

        // Factor 1: Days overdue (50% weight)
        if (daysOverdue > 0) {
          const overdueRatio = daysOverdue / 90; // 90 days is critical
          defaultProbability += Math.min(0.5, overdueRatio * 0.5);
        }

        // Factor 2: Payment history (30% weight)
        defaultProbability += (1 - paymentHistory) * 0.3;

        // Factor 3: Invoice amount (20% weight) - larger amounts more risky
        const avgInvoiceAmount = 50000; // Expected average
        if (invoice.amount > avgInvoiceAmount) {
          defaultProbability += Math.min(0.2, (invoice.amount / (avgInvoiceAmount * 2)) * 0.2);
        }

        defaultProbability = Math.min(1, defaultProbability);

        risks.push({
          invoice_id: invoice.id,
          customer_id: invoice.customer_id,
          customer_name: invoice.sales_orders?.customers?.name || 'Unknown',
          default_probability: defaultProbability,
          risk_level: defaultProbability > 0.7 ? 'high' : defaultProbability > 0.4 ? 'medium' : 'low',
          days_overdue: daysOverdue,
          invoice_amount: invoice.amount,
          customer_payment_history_score: paymentHistory,
        });
      }

      return risks.sort((a, b) => b.default_probability - a.default_probability);
    } catch (error) {
      console.error('Payment default analysis error:', error);
      return [];
    }
  }

  /**
   * Validate forecast accuracy using historical data
   */
  async validateForecastAccuracy(productId: string): Promise<{ mape: number; rmse: number }> {
    try {
      const { data: sales } = await supabase
        .from('sales_order_items')
        .select('quantity, created_at')
        .eq('product_id', productId)
        .order('created_at', { ascending: true })
        .limit(365);

      const quantities = (sales || []).map((s: any) => Number(s.quantity));

      if (quantities.length < 2) {
        return { mape: 0, rmse: 0 };
      }

      // Use last 30% of data as test set
      const testSize = Math.ceil(quantities.length * 0.3);
      const trainSet = quantities.slice(0, quantities.length - testSize);
      const testSet = quantities.slice(quantities.length - testSize);

      // Generate predictions using training set
      const predictions = this.calculateExponentialSmoothing(trainSet, testSize);

      // Calculate MAPE and RMSE
      let mapeSum = 0;
      let rmseSum = 0;

      for (let i = 0; i < testSet.length && i < predictions.length; i++) {
        const actual = testSet[i];
        const predicted = predictions[i].predicted_quantity;

        if (actual > 0) {
          mapeSum += Math.abs((actual - predicted) / actual);
        }
        rmseSum += Math.pow(actual - predicted, 2);
      }

      const mape = (mapeSum / Math.max(testSet.length, 1)) * 100;
      const rmse = Math.sqrt(rmseSum / Math.max(testSet.length, 1));

      return { mape, rmse };
    } catch (error) {
      console.error('Validation error:', error);
      return { mape: 0, rmse: 0 };
    }
  }
}

export const forecastingService = new ForecastingService();
