import { useFulfillmentMetrics } from '@/hooks/useSalesAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Package, Truck } from 'lucide-react';

export function FulfillmentPerformanceReport() {
  const { data: metrics, isLoading } = useFulfillmentMetrics();

  if (isLoading) {
    return <div className="text-center py-8">Loading fulfillment metrics...</div>;
  }

  const totalFulfillments =
    (metrics?.pending_picking || 0) +
    (metrics?.pending_packing || 0) +
    (metrics?.pending_shipping || 0) +
    (metrics?.completed || 0);

  const completionRate =
    totalFulfillments > 0 ? Math.round(((metrics?.completed || 0) / totalFulfillments) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Fulfillment Performance</h2>
        <p className="text-muted-foreground">Track order fulfillment stages and completion rates</p>
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className={completionRate >= 75 ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">Fulfillment Completion Rate</CardTitle>
            <CheckCircle2
              className={`h-5 w-5 ${completionRate >= 75 ? 'text-green-600' : 'text-orange-600'}`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${completionRate >= 75 ? 'text-green-600' : 'text-orange-600'}`}
            >
              {completionRate}%
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {metrics?.completed || 0} of {totalFulfillments} orders delivered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Active Fulfillments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalFulfillments - (metrics?.completed || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pending completion or shipment
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Fulfillment Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle>Fulfillment Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Picking Stage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Picking Stage</span>
                </div>
                <Badge variant="outline">{metrics?.pending_picking || 0} items</Badge>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500"
                  style={{
                    width: `${totalFulfillments > 0 ? ((metrics?.pending_picking || 0) / totalFulfillments) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {totalFulfillments > 0
                  ? Math.round(((metrics?.pending_picking || 0) / totalFulfillments) * 100)
                  : 0}
                % of fulfillments pending picking
              </p>
            </div>

            {/* Packing Stage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Packing Stage</span>
                </div>
                <Badge variant="secondary">{metrics?.pending_packing || 0} items</Badge>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500"
                  style={{
                    width: `${totalFulfillments > 0 ? ((metrics?.pending_packing || 0) / totalFulfillments) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {totalFulfillments > 0
                  ? Math.round(((metrics?.pending_packing || 0) / totalFulfillments) * 100)
                  : 0}
                % of fulfillments awaiting shipment
              </p>
            </div>

            {/* Shipping Stage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Shipping Stage</span>
                </div>
                <Badge variant="secondary">{metrics?.pending_shipping || 0} items</Badge>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500"
                  style={{
                    width: `${totalFulfillments > 0 ? ((metrics?.pending_shipping || 0) / totalFulfillments) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {totalFulfillments > 0
                  ? Math.round(((metrics?.pending_shipping || 0) / totalFulfillments) * 100)
                  : 0}
                % of fulfillments in transit
              </p>
            </div>

            {/* Completed */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Delivered</span>
                </div>
                <Badge variant="default">{metrics?.completed || 0} items</Badge>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{
                    width: `${totalFulfillments > 0 ? ((metrics?.completed || 0) / totalFulfillments) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {totalFulfillments > 0
                  ? Math.round(((metrics?.completed || 0) / totalFulfillments) * 100)
                  : 0}
                % of fulfillments completed
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Alerts */}
      {(metrics?.pending_picking || 0) > 20 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">Picking Bottleneck</CardTitle>
            <AlertCircle className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {metrics?.pending_picking || 0} items awaiting picking. Consider allocating additional resources.
            </p>
          </CardContent>
        </Card>
      )}

      {(metrics?.pending_shipping || 0) > 15 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">Shipping Delay</CardTitle>
            <AlertCircle className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {metrics?.pending_shipping || 0} orders in transit. Monitor carrier performance.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
