import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

interface InventoryRecommendation {
  product_id: string;
  product_name: string;
  current_stock: number;
  recommended_order_qty: number;
  optimal_stock_level: number;
  reorder_point: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
  estimated_stock_out_days: number;
}

interface CustomerRecommendation {
  customer_id: string;
  customer_name: string;
  recommendation_type: 'upsell' | 'cross_sell' | 'retention' | 'win_back';
  recommended_product_ids: string[];
  expected_additional_revenue: number;
  success_probability: number;
  action: string;
}

interface PricingRecommendation {
  product_id: string;
  product_name: string;
  current_price: number;
  recommended_price: number;
  price_elasticity: number;
  expected_demand_change: number;
  expected_revenue_impact: number;
  confidence: number;
}

interface CollectionRecommendation {
  customer_id: string;
  customer_name: string;
  outstanding_amount: number;
  collection_priority_score: number;
  suggested_action: 'immediate_contact' | 'payment_plan' | 'settlement_offer' | 'legal_action';
  collection_success_probability: number;
  recommended_discount_for_settlement: number;
}

export class AIRecommendationsService {
  /**
   * Generate inventory management recommendations
   */
  async getInventoryRecommendations(): Promise<InventoryRecommendation[]> {
    try {
      // STEP 3K.1: Fixed to use canonical schema (total_qty instead of current_stock)
      const { data: inventory } = await supabase
        .from('inventory_transactions')
        .select(
          `
          item_id,
          qty_change,
          created_at,
          inventory_items (
            id,
            item_name,
            total_qty,
            reorder_point,
            lead_time_days
          )
        `,
        )
        .order('created_at', { ascending: false })
        .limit(1000);

      const recommendations: InventoryRecommendation[] = [];

      // Group by item and calculate velocity
      const itemVelocity: Record<string, { outflows: number; days: number; item: any }> = {};

      (inventory || []).forEach((txn: any) => {
        if (!txn.inventory_items) return;

        const itemId = txn.inventory_items.id;
        if (!itemVelocity[itemId]) {
          itemVelocity[itemId] = {
            outflows: 0,
            days: 0,
            item: txn.inventory_items,
          };
        }

        if (txn.qty_change < 0) {
          itemVelocity[itemId].outflows += Math.abs(txn.qty_change);
        }
      });

      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      Object.entries(itemVelocity).forEach(([itemId, data]) => {
        const dailyConsumption = data.outflows / 30;
        // STEP 3K.1: Use canonical field total_qty
        const currentStock = data.item.total_qty || 0;
        const leadTime = data.item.lead_time_days || 7;
        const safetyStock = dailyConsumption * leadTime * 1.5;
        const reorderPoint = dailyConsumption * leadTime + safetyStock;

        const daysOfStockRemaining = dailyConsumption > 0 ? currentStock / dailyConsumption : 999;

        let urgency: 'critical' | 'high' | 'medium' | 'low' = 'low';
        let reason = 'Stock level optimal';

        if (daysOfStockRemaining <= leadTime) {
          urgency = 'critical';
          reason = `Stock will run out in ${Math.round(daysOfStockRemaining)} days`;
        } else if (daysOfStockRemaining <= leadTime * 1.5) {
          urgency = 'high';
          reason = 'Approaching reorder point';
        } else if (currentStock > leadTime * dailyConsumption * 3) {
          urgency = 'low';
          reason = 'Excess inventory detected';
        }

        const optimalQuantity = Math.ceil(leadTime * dailyConsumption * 2);

        recommendations.push({
          product_id: itemId,
          product_name: data.item.item_name,
          current_stock: currentStock,
          recommended_order_qty: Math.max(optimalQuantity, Math.ceil(reorderPoint - currentStock)),
          optimal_stock_level: Math.ceil(optimalQuantity),
          reorder_point: Math.ceil(reorderPoint),
          urgency,
          reason,
          estimated_stock_out_days: Math.ceil(daysOfStockRemaining),
        });
      });

      return recommendations.sort((a, b) => {
        const urgencyMap = { critical: 0, high: 1, medium: 2, low: 3 };
        return urgencyMap[a.urgency] - urgencyMap[b.urgency];
      });
    } catch (error) {
      console.error('Inventory recommendation error:', error);
      return [];
    }
  }

  /**
   * Generate customer-specific recommendations
   */
  async getCustomerRecommendations(customerId: string): Promise<CustomerRecommendation[]> {
    try {
      // Get customer purchase history
      const { data: orders } = await supabase
        .from('sales_orders')
        .select(
          `
          id,
          sales_order_items (
            product_id,
            quantity,
            unit_price
          )
        `,
        )
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(50);

      const recommendations: CustomerRecommendation[] = [];

      if (!orders || orders.length === 0) {
        return recommendations;
      }

      // Analyze purchase patterns
      const purchasedProductIds = new Set<string>();
      let totalOrderValue = 0;

      orders.forEach((order: any) => {
        order.sales_order_items.forEach((item: any) => {
          purchasedProductIds.add(item.product_id);
          totalOrderValue += item.quantity * item.unit_price;
        });
      });

      const avgOrderValue = totalOrderValue / orders.length;

      // Find complementary products (cross-sell)
      const { data: allProducts } = await supabase
        .from('products')
        .select('id, name, category')
        .limit(500);

      if (allProducts) {
        // Cross-sell: products in same category not yet purchased
        const categories: Record<string, string[]> = {};
        allProducts.forEach((prod: any) => {
          if (!categories[prod.category]) {
            categories[prod.category] = [];
          }
          categories[prod.category].push(prod.id);
        });

        // Find products in categories customer already buys from
        const relevantProductIds: string[] = [];
        Array.from(purchasedProductIds).forEach((prodId) => {
          const product = allProducts.find((p: any) => p.id === prodId);
          if (product && categories[product.category]) {
            categories[product.category].forEach((pid) => {
              if (!purchasedProductIds.has(pid) && pid !== prodId) {
                relevantProductIds.push(pid);
              }
            });
          }
        });

        if (relevantProductIds.length > 0) {
          recommendations.push({
            customer_id: customerId,
            customer_name: '',
            recommendation_type: 'cross_sell',
            recommended_product_ids: relevantProductIds.slice(0, 5),
            expected_additional_revenue: avgOrderValue * 0.15,
            success_probability: 0.35,
            action: 'Recommend complementary products from frequently purchased categories',
          });
        }
      }

      // Upsell: higher-tier products
      recommendations.push({
        customer_id: customerId,
        customer_name: '',
        recommendation_type: 'upsell',
        recommended_product_ids: [],
        expected_additional_revenue: avgOrderValue * 0.25,
        success_probability: 0.25,
        action: 'Offer premium variants or higher quantity discounts',
      });

      return recommendations;
    } catch (error) {
      console.error('Customer recommendation error:', error);
      return [];
    }
  }

  /**
   * Generate pricing recommendations using demand elasticity
   */
  async getPricingRecommendations(): Promise<PricingRecommendation[]> {
    try {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, base_price')
        .limit(100);

      const recommendations: PricingRecommendation[] = [];

      for (const product of products || []) {
        // Get sales history at different price points
        const { data: sales } = await supabase
          .from('sales_order_items')
          .select('unit_price, quantity, created_at')
          .eq('product_id', product.id)
          .order('created_at', { ascending: false })
          .limit(100);

        if (!sales || sales.length < 10) {
          continue;
        }

        // Calculate elasticity using recent sales
        const priceLevels = Array.from(new Set(sales.map((s: any) => Math.round(s.unit_price)))).sort((a, b) => a - b);

        if (priceLevels.length < 2) {
          continue;
        }

        // Simple elasticity calculation
        const avgQuantityLow = sales
          .filter((s: any) => s.unit_price <= priceLevels[0])
          .reduce((sum: number, s: any) => sum + s.quantity, 0) / Math.max(1, sales.filter((s: any) => s.unit_price <= priceLevels[0]).length);

        const avgQuantityHigh = sales
          .filter((s: any) => s.unit_price >= priceLevels[priceLevels.length - 1])
          .reduce((sum: number, s: any) => sum + s.quantity, 0) / Math.max(1, sales.filter((s: any) => s.unit_price >= priceLevels[priceLevels.length - 1]).length);

        const priceDiff = ((priceLevels[priceLevels.length - 1] - priceLevels[0]) / priceLevels[0]) * 100;
        const quantityDiff = ((avgQuantityLow - avgQuantityHigh) / avgQuantityHigh) * 100;

        const elasticity = quantityDiff > 0 ? quantityDiff / priceDiff : -0.5;

        const currentPrice = product.base_price || priceLevels[Math.floor(priceLevels.length / 2)];
        const avgSalesQty = sales.reduce((sum: number, s: any) => sum + s.quantity, 0) / sales.length;

        let recommendedPrice = currentPrice;
        let expectedDemandChange = 0;

        // Price optimization: adjust based on elasticity
        if (elasticity > -0.5) {
          // Inelastic: can increase price
          recommendedPrice = currentPrice * 1.05;
          expectedDemandChange = -elasticity * 5;
        } else if (elasticity < -1.5) {
          // Elastic: should decrease price
          recommendedPrice = currentPrice * 0.95;
          expectedDemandChange = -elasticity * -5;
        }

        const revenueImpact = ((recommendedPrice - currentPrice) / currentPrice * (1 + expectedDemandChange / 100) - 1) * 100;

        recommendations.push({
          product_id: product.id,
          product_name: product.name,
          current_price: currentPrice,
          recommended_price: Math.round(recommendedPrice),
          price_elasticity: elasticity,
          expected_demand_change: expectedDemandChange,
          expected_revenue_impact: revenueImpact,
          confidence: Math.min(0.95, 0.5 + priceLevels.length * 0.1),
        });
      }

      return recommendations.sort((a, b) => b.expected_revenue_impact - a.expected_revenue_impact);
    } catch (error) {
      console.error('Pricing recommendation error:', error);
      return [];
    }
  }

  /**
   * Generate collection strategy recommendations
   */
  async getCollectionRecommendations(): Promise<CollectionRecommendation[]> {
    try {
      const { data: overdue } = await supabase
        .from('invoices')
        .select(
          `
          id,
          customer_id,
          amount,
          due_date,
          status,
          customers (
            name
          ),
          sales_orders (
            total_amount
          )
        `,
        )
        .neq('status', 'paid')
        .limit(200);

      const recommendations: CollectionRecommendation[] = [];
      const today = new Date();

      for (const invoice of overdue || []) {
        const dueDate = new Date(invoice.due_date);
        const daysOverdue = Math.max(
          0,
          Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)),
        );

        if (daysOverdue === 0) continue;

        // Calculate customer payment history
        const { data: history } = await supabase
          .from('invoices')
          .select('status')
          .eq('customer_id', invoice.customer_id)
          .limit(20);

        const paidInvoices = (history || []).filter((h: any) => h.status === 'paid').length;
        const paymentHistoryScore = history && history.length > 0 ? paidInvoices / history.length : 0;

        // Calculate collection priority
        let priorityScore = 0;
        let suggestedAction: 'immediate_contact' | 'payment_plan' | 'settlement_offer' | 'legal_action' = 'immediate_contact';
        let settlementDiscount = 0;

        // Days overdue priority (40%)
        if (daysOverdue <= 7) {
          priorityScore += 10;
        } else if (daysOverdue <= 30) {
          priorityScore += 25;
        } else if (daysOverdue <= 60) {
          priorityScore += 40;
        } else {
          priorityScore += 60;
        }

        // Amount priority (35%)
        const amountScore = Math.min(35, (invoice.amount / 100000) * 35);
        priorityScore += amountScore;

        // Payment history (25%)
        priorityScore += (1 - paymentHistoryScore) * 25;

        // Determine action based on score and history
        if (priorityScore >= 75 && daysOverdue > 60) {
          suggestedAction = 'legal_action';
          settlementDiscount = 0;
        } else if (priorityScore >= 50 && daysOverdue > 30) {
          suggestedAction = 'settlement_offer';
          settlementDiscount = Math.min(10, daysOverdue / 10);
        } else if (daysOverdue > 15) {
          suggestedAction = 'payment_plan';
          settlementDiscount = 0;
        } else {
          suggestedAction = 'immediate_contact';
          settlementDiscount = 0;
        }

        // Calculate success probability
        let successProbability = 0;
        if (paymentHistoryScore > 0.8) {
          successProbability = 0.8;
        } else if (paymentHistoryScore > 0.5) {
          successProbability = 0.6;
        } else {
          successProbability = 0.4;
        }

        recommendations.push({
          customer_id: invoice.customer_id,
          customer_name: invoice.customers?.name || 'Unknown',
          outstanding_amount: invoice.amount,
          collection_priority_score: priorityScore,
          suggested_action: suggestedAction,
          collection_success_probability: successProbability,
          recommended_discount_for_settlement: settlementDiscount,
        });
      }

      return recommendations.sort((a, b) => b.collection_priority_score - a.collection_priority_score);
    } catch (error) {
      console.error('Collection recommendation error:', error);
      return [];
    }
  }

  /**
   * Calculate recommendation confidence scores
   */
  calculateConfidenceScore(dataPoints: number, dataQuality: number = 0.8): number {
    // Confidence increases with more data points, capped at high values
    const dataConfidence = Math.min(0.95, (dataPoints / 100) * 0.95);
    return dataConfidence * dataQuality;
  }
}

export const aiRecommendationsService = new AIRecommendationsService();
