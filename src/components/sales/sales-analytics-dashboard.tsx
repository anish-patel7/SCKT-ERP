import { useSalesKPIs, useInvoiceMetrics, useOrderMetrics, useFulfillmentMetrics } from '@/hooks/useSalesAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Package, Truck, CheckCircle2, TrendingUp } from 'lucide-react';

export function SalesAnalyticsDashboard() {
  const { data: salesKpis, isLoading: salesLoading } = useSalesKPIs();
  const { data: invoiceMetrics, isLoading: invoiceLoading } = useInvoiceMetrics();
  const { data: orderMetrics, isLoading: orderLoading } = useOrderMetrics();
  const { data: fulfillmentMetrics, isLoading: fulfillmentLoading } = useFulfillmentMetrics();

  const isLoading = salesLoading || invoiceLoading || orderLoading || fulfillmentLoading;

  if (isLoading) {
    return <div className="text-center py-8">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Sales Analytics</h2>
        <p className="text-muted-foreground">Real-time overview of sales, orders, and fulfillment metrics</p>
      </div>

      {/* Sales KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesKpis?.total_orders || 0}</div>
            <p className="text-xs text-muted-foreground">
              {orderMetrics?.delivered || 0} delivered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{(salesKpis?.total_revenue || 0).toLocaleString('en-IN')}</div>
            <p className="text-xs text-muted-foreground">
              Avg: ₹{(salesKpis?.average_order_value || 0).toLocaleString('en-IN')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invoice Collection</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoiceMetrics?.paid_percentage || 0}%</div>
            <p className="text-xs text-muted-foreground">
              ₹{(invoiceMetrics?.total_paid || 0).toLocaleString('en-IN')} collected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{(invoiceMetrics?.total_outstanding || 0).toLocaleString('en-IN')}</div>
            <p className="text-xs text-muted-foreground">
              ₹{(invoiceMetrics?.overdue_amount || 0).toLocaleString('en-IN')} overdue
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Order & Fulfillment Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Order Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Draft</Badge>
                  <span className="text-sm text-muted-foreground">{orderMetrics?.draft || 0} orders</span>
                </div>
                <span className="font-semibold">{((orderMetrics?.draft || 0) / (salesKpis?.total_orders || 1) * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Confirmed</Badge>
                  <span className="text-sm text-muted-foreground">{orderMetrics?.confirmed || 0} orders</span>
                </div>
                <span className="font-semibold">{((orderMetrics?.confirmed || 0) / (salesKpis?.total_orders || 1) * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Allocated</Badge>
                  <span className="text-sm text-muted-foreground">{orderMetrics?.allocated || 0} orders</span>
                </div>
                <span className="font-semibold">{((orderMetrics?.allocated || 0) / (salesKpis?.total_orders || 1) * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="default">Shipped</Badge>
                  <span className="text-sm text-muted-foreground">{orderMetrics?.shipped || 0} orders</span>
                </div>
                <span className="font-semibold">{((orderMetrics?.shipped || 0) / (salesKpis?.total_orders || 1) * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="default">Delivered</Badge>
                  <span className="text-sm text-muted-foreground">{orderMetrics?.delivered || 0} orders</span>
                </div>
                <span className="font-semibold">{((orderMetrics?.delivered || 0) / (salesKpis?.total_orders || 1) * 100).toFixed(0)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fulfillment Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Pending Picking</Badge>
                  <span className="text-sm text-muted-foreground">{fulfillmentMetrics?.pending_picking || 0}</span>
                </div>
                <Truck className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Pending Packing</Badge>
                  <span className="text-sm text-muted-foreground">{fulfillmentMetrics?.pending_packing || 0}</span>
                </div>
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Pending Shipping</Badge>
                  <span className="text-sm text-muted-foreground">{fulfillmentMetrics?.pending_shipping || 0}</span>
                </div>
                <Truck className="h-4 w-4 text-yellow-600" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="default">Completed</Badge>
                  <span className="text-sm text-muted-foreground">{fulfillmentMetrics?.completed || 0}</span>
                </div>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
