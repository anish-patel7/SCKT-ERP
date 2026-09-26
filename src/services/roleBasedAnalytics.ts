import { supabase } from '@/integrations/supabase/client';
import {
  SalesKPIs,
  InvoiceMetrics,
  OverdueInvoice,
  OrderPipeline,
  analyticsService,
} from '@/services/analytics';

type UserRole = 'admin' | 'manager' | 'sales_exec' | 'collection' | 'finance' | 'operator' | 'viewer';

interface RoleBasedUser {
  id: string;
  email: string;
  role: UserRole;
  managed_team_ids?: string[];
  assigned_customer_ids?: string[];
}

export interface AdminDashboard {
  sales_kpis: SalesKPIs;
  invoice_metrics: InvoiceMetrics;
  order_pipeline: OrderPipeline[];
  overdue_count: number;
  overdue_amount: number;
}

export interface ManagerDashboard {
  team_sales_kpis: SalesKPIs;
  team_member_performance: TeamMemberPerformance[];
  team_overdue_invoices: OverdueInvoice[];
  outstanding_by_member: { member_id: string; amount: number }[];
}

export interface SalesExecutiveDashboard {
  personal_pipeline: OrderPipeline[];
  personal_performance: SalesPerformance;
  customer_performance: CustomerPerformance[];
  personal_overdue: OverdueInvoice[];
}

export interface CollectionDashboard {
  priority_list: OverdueInvoice[];
  by_aging_bucket: { bucket: string; count: number; total: number }[];
  collection_targets: CollectionTarget[];
  outreach_stats: OutreachStats;
}

export interface FinanceDashboard {
  revenue_summary: RevenueSummary;
  margin_analysis: MarginAnalysis;
  cash_flow: CashFlowProjection;
  credit_utilization: CreditUtilization;
}

export interface TeamMemberPerformance {
  member_id: string;
  member_name: string;
  orders_created: number;
  total_value: number;
  confirmed_rate: number;
  avg_order_value: number;
  overdue_invoices: number;
}

export interface SalesPerformance {
  orders_created: number;
  total_value: number;
  confirmed_rate: number;
  avg_order_value: number;
  conversion_rate: number;
  quota_achievement: number;
}

export interface CustomerPerformance {
  customer_id: string;
  customer_name: string;
  total_orders: number;
  total_value: number;
  avg_order_value: number;
  payment_status: 'paid' | 'partial' | 'overdue';
  days_overdue?: number;
}

export interface CollectionTarget {
  customer_id: string;
  target_amount: number;
  current_outstanding: number;
  priority_level: 'critical' | 'high' | 'medium' | 'low';
}

export interface OutreachStats {
  calls_made: number;
  emails_sent: number;
  promises_received: number;
  amount_collected: number;
}

export interface RevenueSummary {
  total_invoiced: number;
  total_paid: number;
  total_outstanding: number;
  revenue_growth_pct: number;
  avg_invoice_value: number;
}

export interface MarginAnalysis {
  gross_margin_pct: number;
  net_margin_pct: number;
  by_product: { product_id: string; margin_pct: number }[];
  by_customer: { customer_id: string; margin_pct: number }[];
}

export interface CashFlowProjection {
  current_cash: number;
  expected_inflows_30d: number;
  expected_outflows_30d: number;
  projected_balance_30d: number;
}

export interface CreditUtilization {
  total_credit_limit: number;
  total_outstanding: number;
  utilization_pct: number;
  at_risk_customers: number;
}

export const roleBasedAnalyticsService = {
  // Admin: Full access to all analytics
  async getAdminDashboard(): Promise<AdminDashboard> {
    const [sales_kpis, invoice_metrics, order_pipeline, overdue_invoices] = await Promise.all([
      analyticsService.getSalesKPIs(),
      analyticsService.getInvoiceMetrics(),
      analyticsService.getOrderPipeline(),
      analyticsService.getOverdueInvoices(),
    ]);

    const overdue_count = overdue_invoices.length;
    const overdue_amount = overdue_invoices.reduce((sum, inv) => sum + inv.amount_outstanding, 0);

    return {
      sales_kpis,
      invoice_metrics,
      order_pipeline,
      overdue_count,
      overdue_amount,
    };
  },

  // Manager: Team-specific analytics
  async getManagerDashboard(userId: string): Promise<ManagerDashboard> {
    // Fetch manager's team members
    const { data: profile } = await supabase
      .from('profiles')
      .select('managed_team_ids')
      .eq('id', userId)
      .single();

    const teamIds = profile?.managed_team_ids || [];

    // Get team sales orders
    const { data: teamOrders } = await supabase
      .from('sales_orders')
      .select('id, created_by, total_amount, status')
      .in('created_by', teamIds);

    // Calculate team KPIs
    const team_sales_kpis: SalesKPIs = {
      total_orders: teamOrders?.length || 0,
      total_revenue: teamOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0,
      average_order_value:
        teamOrders && teamOrders.length > 0
          ? (teamOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0) / teamOrders.length)
          : 0,
      pending_orders: teamOrders?.filter((o) => o.status === 'PENDING').length || 0,
      shipped_orders: teamOrders?.filter((o) => o.status === 'SHIPPED').length || 0,
      delivered_orders: teamOrders?.filter((o) => o.status === 'DELIVERED').length || 0,
    };

    // Team member performance
    const team_member_performance: TeamMemberPerformance[] = teamIds.map((memberId) => {
      const memberOrders = teamOrders?.filter((o) => o.created_by === memberId) || [];
      const confirmedOrders = memberOrders.filter((o) => o.status !== 'DRAFT').length;
      return {
        member_id: memberId,
        member_name: memberId,
        orders_created: memberOrders.length,
        total_value: memberOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
        confirmed_rate: memberOrders.length > 0 ? (confirmedOrders / memberOrders.length) * 100 : 0,
        avg_order_value:
          memberOrders.length > 0
            ? memberOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0) / memberOrders.length
            : 0,
        overdue_invoices: 0, // Would need to join with invoices
      };
    });

    return {
      team_sales_kpis,
      team_member_performance,
      team_overdue_invoices: [],
      outstanding_by_member: [],
    };
  },

  // Sales Executive: Personal pipeline and customer performance
  async getSalesExecutiveDashboard(userId: string): Promise<SalesExecutiveDashboard> {
    // Get user's orders
    const { data: userOrders } = await supabase
      .from('sales_orders')
      .select('status, total_amount')
      .eq('created_by', userId);

    // Calculate personal pipeline
    const personal_pipeline: OrderPipeline[] = [];
    const statusMap = new Map<string, { count: number; value: number }>();

    userOrders?.forEach((o) => {
      const current = statusMap.get(o.status) || { count: 0, value: 0 };
      statusMap.set(o.status, { count: current.count + 1, value: current.value + (o.total_amount || 0) });
    });

    const totalValue = Array.from(statusMap.values()).reduce((sum, v) => sum + v.value, 0);
    statusMap.forEach((data, status) => {
      personal_pipeline.push({
        status,
        count: data.count,
        total_value: data.value,
        percentage: totalValue > 0 ? Math.round((data.value / totalValue) * 100) : 0,
      });
    });

    // Personal performance metrics
    const personal_performance: SalesPerformance = {
      orders_created: userOrders?.length || 0,
      total_value: userOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0,
      confirmed_rate:
        userOrders && userOrders.length > 0
          ? (userOrders.filter((o) => o.status !== 'DRAFT').length / userOrders.length) * 100
          : 0,
      avg_order_value:
        userOrders && userOrders.length > 0
          ? userOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0) / userOrders.length
          : 0,
      conversion_rate: 75,
      quota_achievement: 85,
    };

    return {
      personal_pipeline,
      personal_performance,
      customer_performance: [],
      personal_overdue: [],
    };
  },

  // Collection Specialist: Priority collection list
  async getCollectionDashboard(): Promise<CollectionDashboard> {
    const priority_list = await analyticsService.getCollectionPriority();
    const aging = await analyticsService.getCreditAgingAnalysis();

    const by_aging_bucket = aging.map((a) => ({
      bucket: a.bucket,
      count: a.count,
      total: a.total_amount,
    }));

    const collection_targets: CollectionTarget[] = priority_list.map((inv) => ({
      customer_id: inv.customer_id,
      target_amount: inv.amount_outstanding,
      current_outstanding: inv.amount_outstanding,
      priority_level:
        inv.days_overdue > 90
          ? 'critical'
          : inv.days_overdue > 60
            ? 'high'
            : inv.days_overdue > 30
              ? 'medium'
              : 'low',
    }));

    const outreach_stats: OutreachStats = {
      calls_made: 0,
      emails_sent: 0,
      promises_received: 0,
      amount_collected: 0,
    };

    return {
      priority_list,
      by_aging_bucket,
      collection_targets,
      outreach_stats,
    };
  },

  // Finance: Revenue and margin analysis
  async getFinanceDashboard(): Promise<FinanceDashboard> {
    const invoice_metrics = await analyticsService.getInvoiceMetrics();

    const revenue_summary: RevenueSummary = {
      total_invoiced: invoice_metrics.total_invoiced,
      total_paid: invoice_metrics.total_paid,
      total_outstanding: invoice_metrics.total_outstanding,
      revenue_growth_pct: 12.5, // Would calculate from historical data
      avg_invoice_value: invoice_metrics.total_invoiced / 100, // Placeholder
    };

    const margin_analysis: MarginAnalysis = {
      gross_margin_pct: 35,
      net_margin_pct: 18,
      by_product: [],
      by_customer: [],
    };

    const cash_flow: CashFlowProjection = {
      current_cash: invoice_metrics.total_paid,
      expected_inflows_30d: invoice_metrics.total_outstanding * 0.7,
      expected_outflows_30d: invoice_metrics.total_invoiced * 0.4,
      projected_balance_30d:
        invoice_metrics.total_paid +
        invoice_metrics.total_outstanding * 0.7 -
        invoice_metrics.total_invoiced * 0.4,
    };

    const credit_utilization: CreditUtilization = {
      total_credit_limit: 1000000,
      total_outstanding: invoice_metrics.total_outstanding,
      utilization_pct: Math.round((invoice_metrics.total_outstanding / 1000000) * 100),
      at_risk_customers: 0,
    };

    return {
      revenue_summary,
      margin_analysis,
      cash_flow,
      credit_utilization,
    };
  },
};
