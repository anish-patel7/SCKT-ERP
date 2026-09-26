import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type SalesOrder = Database['public']['Tables']['sales_orders']['Row'];
type SalesInvoice = Database['public']['Tables']['sales_invoices']['Row'];
type SalesFulfillment = Database['public']['Tables']['sales_fulfillment']['Row'];

// KPI Metrics
export interface SalesKPIs {
  total_orders: number;
  total_revenue: number;
  average_order_value: number;
  pending_orders: number;
  shipped_orders: number;
  delivered_orders: number;
}

export interface InvoiceMetrics {
  total_invoiced: number;
  total_paid: number;
  total_outstanding: number;
  overdue_amount: number;
  paid_percentage: number;
}

export interface OrderMetrics {
  draft: number;
  confirmed: number;
  allocated: number;
  shipped: number;
  delivered: number;
}

export interface FulfillmentMetrics {
  pending_picking: number;
  pending_packing: number;
  pending_shipping: number;
  completed: number;
}

export interface OverdueInvoice {
  id: string;
  invoice_no: string;
  customer_id: string;
  amount_outstanding: number;
  due_date: string;
  days_overdue: number;
  aging_bucket: '0-30' | '31-60' | '61-90' | '90+';
}

export interface CreditAgingBucket {
  bucket: '0-30' | '31-60' | '61-90' | '90+';
  count: number;
  total_amount: number;
}

export interface OrderPipeline {
  status: string;
  count: number;
  total_value: number;
  percentage: number;
}

export interface PaymentPattern {
  month: string;
  total_invoiced: number;
  total_paid: number;
  avg_payment_days: number;
}

export const analyticsService = {
  // Sales KPIs
  async getSalesKPIs(): Promise<SalesKPIs> {
    const { data: orders, error } = await supabase
      .from('sales_orders')
      .select('total_amount, status')
      .eq('is_active', true);

    if (error) throw new Error(`Failed to fetch orders: ${error.message}`);

    const total_orders = orders?.length || 0;
    const total_revenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;

    const statuses = orders?.reduce(
      (acc, o) => {
        if (o.status === 'PENDING') acc.pending++;
        if (o.status === 'SHIPPED') acc.shipped++;
        if (o.status === 'DELIVERED') acc.delivered++;
        return acc;
      },
      { pending: 0, shipped: 0, delivered: 0 }
    ) || { pending: 0, shipped: 0, delivered: 0 };

    return {
      total_orders,
      total_revenue: Math.round(total_revenue * 100) / 100,
      average_order_value: total_orders > 0 ? Math.round((total_revenue / total_orders) * 100) / 100 : 0,
      pending_orders: statuses.pending,
      shipped_orders: statuses.shipped,
      delivered_orders: statuses.delivered,
    };
  },

  // Invoice metrics
  async getInvoiceMetrics(): Promise<InvoiceMetrics> {
    const { data: invoices, error } = await supabase
      .from('sales_invoices')
      .select('total_amount, amount_paid, amount_outstanding, due_date, status');

    if (error) throw new Error(`Failed to fetch invoices: ${error.message}`);

    const total_invoiced = invoices?.reduce((sum, i) => sum + (i.total_amount || 0), 0) || 0;
    const total_paid = invoices?.reduce((sum, i) => sum + (i.amount_paid || 0), 0) || 0;
    const total_outstanding = invoices?.reduce((sum, i) => sum + (i.amount_outstanding || 0), 0) || 0;

    const now = new Date();
    const overdue_amount = invoices?.reduce((sum, i) => {
      const dueDate = new Date(i.due_date);
      return sum + (dueDate < now && i.status !== 'PAID' ? i.amount_outstanding : 0);
    }, 0) || 0;

    return {
      total_invoiced: Math.round(total_invoiced * 100) / 100,
      total_paid: Math.round(total_paid * 100) / 100,
      total_outstanding: Math.round(total_outstanding * 100) / 100,
      overdue_amount: Math.round(overdue_amount * 100) / 100,
      paid_percentage: total_invoiced > 0 ? Math.round((total_paid / total_invoiced) * 100) : 0,
    };
  },

  // Order status breakdown
  async getOrderMetrics(): Promise<OrderMetrics> {
    const { data: orders, error } = await supabase
      .from('sales_orders')
      .select('status');

    if (error) throw new Error(`Failed to fetch orders: ${error.message}`);

    const metrics = orders?.reduce(
      (acc, o) => {
        if (o.status === 'DRAFT') acc.draft++;
        if (o.status === 'CONFIRMED') acc.confirmed++;
        if (o.status === 'ALLOCATED') acc.allocated++;
        if (o.status === 'SHIPPED') acc.shipped++;
        if (o.status === 'DELIVERED') acc.delivered++;
        return acc;
      },
      { draft: 0, confirmed: 0, allocated: 0, shipped: 0, delivered: 0 }
    ) || { draft: 0, confirmed: 0, allocated: 0, shipped: 0, delivered: 0 };

    return metrics;
  },

  // Fulfillment status breakdown
  async getFulfillmentMetrics(): Promise<FulfillmentMetrics> {
    const { data: fulfillments, error } = await supabase
      .from('sales_fulfillment')
      .select('status');

    if (error) throw new Error(`Failed to fetch fulfillments: ${error.message}`);

    const metrics = fulfillments?.reduce(
      (acc, f) => {
        if (f.status === 'PENDING') acc.pending_picking++;
        if (f.status === 'PICKING') acc.pending_picking++;
        if (f.status === 'PACKED') acc.pending_packing++;
        if (f.status === 'READY_TO_SHIP') acc.pending_packing++;
        if (f.status === 'SHIPPED') acc.pending_shipping++;
        if (f.status === 'DELIVERED') acc.completed++;
        return acc;
      },
      { pending_picking: 0, pending_packing: 0, pending_shipping: 0, completed: 0 }
    ) || { pending_picking: 0, pending_packing: 0, pending_shipping: 0, completed: 0 };

    return metrics;
  },

  // Overdue invoices with aging
  async getOverdueInvoices(): Promise<OverdueInvoice[]> {
    const { data: invoices, error } = await supabase
      .from('sales_invoices')
      .select('id, invoice_no, customer_id, amount_outstanding, due_date, status')
      .neq('status', 'PAID')
      .order('due_date', { ascending: true });

    if (error) throw new Error(`Failed to fetch invoices: ${error.message}`);

    const now = new Date();
    return (invoices || [])
      .filter((i) => new Date(i.due_date) < now)
      .map((i) => {
        const daysOverdue = Math.floor(
          (now.getTime() - new Date(i.due_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          id: i.id,
          invoice_no: i.invoice_no,
          customer_id: i.customer_id,
          amount_outstanding: i.amount_outstanding,
          due_date: i.due_date,
          days_overdue: daysOverdue,
          aging_bucket: (
            daysOverdue <= 30
              ? '0-30'
              : daysOverdue <= 60
                ? '31-60'
                : daysOverdue <= 90
                  ? '61-90'
                  : '90+'
          ) as '0-30' | '31-60' | '61-90' | '90+',
        };
      });
  },

  // Credit aging analysis
  async getCreditAgingAnalysis(): Promise<CreditAgingBucket[]> {
    const overdueInvoices = await this.getOverdueInvoices();

    const buckets = {
      '0-30': { count: 0, total_amount: 0 },
      '31-60': { count: 0, total_amount: 0 },
      '61-90': { count: 0, total_amount: 0 },
      '90+': { count: 0, total_amount: 0 },
    };

    overdueInvoices.forEach((invoice) => {
      buckets[invoice.aging_bucket].count++;
      buckets[invoice.aging_bucket].total_amount += invoice.amount_outstanding;
    });

    return [
      { bucket: '0-30', ...buckets['0-30'] },
      { bucket: '31-60', ...buckets['31-60'] },
      { bucket: '61-90', ...buckets['61-90'] },
      { bucket: '90+', ...buckets['90+'] },
    ];
  },

  // Order pipeline visualization
  async getOrderPipeline(): Promise<OrderPipeline[]> {
    const { data: orders, error } = await supabase
      .from('sales_orders')
      .select('status, total_amount');

    if (error) throw new Error(`Failed to fetch orders: ${error.message}`);

    const total = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
    const statusMap = new Map<string, { count: number; value: number }>();

    orders?.forEach((o) => {
      const current = statusMap.get(o.status) || { count: 0, value: 0 };
      statusMap.set(o.status, {
        count: current.count + 1,
        value: current.value + (o.total_amount || 0),
      });
    });

    return Array.from(statusMap.entries()).map(([status, data]) => ({
      status,
      count: data.count,
      total_value: Math.round(data.value * 100) / 100,
      percentage: total > 0 ? Math.round((data.value / total) * 100) : 0,
    }));
  },

  // Payment pattern analysis (last 12 months)
  async getPaymentPatterns(): Promise<PaymentPattern[]> {
    const { data: payments, error } = await supabase
      .from('sales_payments')
      .select('payment_date')
      .gte('payment_date', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());

    if (error) throw new Error(`Failed to fetch payments: ${error.message}`);

    const { data: invoices, error: invoiceError } = await supabase
      .from('sales_invoices')
      .select('invoice_date')
      .gte('invoice_date', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());

    if (invoiceError) throw new Error(`Failed to fetch invoices: ${invoiceError.message}`);

    const monthlyData = new Map<string, { invoiced: number; paid: number }>();

    invoices?.forEach((i) => {
      const month = new Date(i.invoice_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
      });
      const current = monthlyData.get(month) || { invoiced: 1, paid: 0 };
      monthlyData.set(month, { ...current, invoiced: current.invoiced + 1 });
    });

    payments?.forEach((p) => {
      const month = new Date(p.payment_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
      });
      const current = monthlyData.get(month) || { invoiced: 0, paid: 1 };
      monthlyData.set(month, { ...current, paid: current.paid + 1 });
    });

    return Array.from(monthlyData.entries()).map(([month, data]) => ({
      month,
      total_invoiced: data.invoiced,
      total_paid: data.paid,
      avg_payment_days: data.invoiced > 0 ? Math.round(30 / (data.paid / data.invoiced)) : 0,
    }));
  },

  // Collection priority list
  async getCollectionPriority(): Promise<OverdueInvoice[]> {
    const overdueInvoices = await this.getOverdueInvoices();

    return overdueInvoices
      .sort((a, b) => {
        // Sort by days overdue descending (oldest first), then by amount descending
        if (a.days_overdue !== b.days_overdue) {
          return b.days_overdue - a.days_overdue;
        }
        return b.amount_outstanding - a.amount_outstanding;
      })
      .slice(0, 20); // Top 20 overdue invoices
  },
};
