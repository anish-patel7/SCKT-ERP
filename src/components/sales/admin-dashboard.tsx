import { useAdminDashboard } from '@/hooks/useRoleBasedAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, Users, Zap } from 'lucide-react';

export function AdminDashboard() {
  const { data, isLoading } = useAdminDashboard();

  if (isLoading) {
    return <div className="text-center py-8">Loading admin dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Admin Dashboard</h2>
        <p className="text-muted-foreground">Complete organizational overview and system health</p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.sales_kpis.total_orders || 0}</div>
            <p className="text-xs text-muted-foreground">
              {data?.sales_kpis.delivered_orders || 0} delivered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{(data?.sales_kpis.total_revenue || 0).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg: ₹{(data?.sales_kpis.average_order_value || 0).toLocaleString('en-IN')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Invoice Collection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.invoice_metrics.paid_percentage || 0}%</div>
            <p className="text-xs text-muted-foreground">
              ₹{(data?.invoice_metrics.total_paid || 0).toLocaleString('en-IN')} collected
            </p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Overdue Amount</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ₹{(data?.overdue_amount || 0).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.overdue_count || 0} invoices overdue
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Order Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle>Order Pipeline Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data?.order_pipeline.map((stage) => (
              <div key={stage.status}>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline">{stage.status}</Badge>
                  <span className="font-semibold">{stage.percentage}%</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      stage.status === 'DRAFT'
                        ? 'bg-gray-400'
                        : stage.status === 'CONFIRMED'
                          ? 'bg-blue-500'
                          : stage.status === 'ALLOCATED'
                            ? 'bg-indigo-500'
                            : stage.status === 'SHIPPED'
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                    }`}
                    style={{ width: `${stage.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stage.count} orders · ₹{stage.total_value.toLocaleString('en-IN')}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Invoice Metrics Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Invoice Collection Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Total Invoiced:</span>
              <span className="font-semibold">
                ₹{(data?.invoice_metrics.total_invoiced || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Amount Paid:</span>
              <span className="font-semibold text-green-600">
                ₹{(data?.invoice_metrics.total_paid || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Outstanding:</span>
              <span className="font-semibold text-orange-600">
                ₹{(data?.invoice_metrics.total_outstanding || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="border-t pt-3 flex justify-between">
              <span>Overdue:</span>
              <span className="font-semibold text-red-600">
                ₹{(data?.invoice_metrics.overdue_amount || 0).toLocaleString('en-IN')}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span>Orders Processing:</span>
              <Badge variant="default">{data?.sales_kpis.pending_orders || 0}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Orders in Transit:</span>
              <Badge variant="secondary">{data?.sales_kpis.shipped_orders || 0}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Completed Orders:</span>
              <Badge variant="default">{data?.sales_kpis.delivered_orders || 0}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Collection Health:</span>
              <Badge
                variant={
                  (data?.invoice_metrics.paid_percentage || 0) >= 80
                    ? 'default'
                    : 'destructive'
                }
              >
                {data?.invoice_metrics.paid_percentage || 0}%
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
