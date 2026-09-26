import { useOrderPipeline } from '@/hooks/useSalesAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';

export function OrderPipelineVisualization() {
  const { data: pipeline, isLoading } = useOrderPipeline();

  if (isLoading) {
    return <div className="text-center py-8">Loading pipeline...</div>;
  }

  const totalValue = pipeline?.reduce((sum, p) => sum + p.total_value, 0) || 0;

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    ALLOCATED: 'bg-indigo-100 text-indigo-800',
    SHIPPED: 'bg-yellow-100 text-yellow-800',
    DELIVERED: 'bg-green-100 text-green-800',
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Order Pipeline</h2>
        <p className="text-muted-foreground">Visualize order progression through sales lifecycle</p>
      </div>

      {/* Pipeline Flow */}
      <Card>
        <CardHeader>
          <CardTitle>Status Distribution & Value</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {pipeline?.map((stage, index) => (
              <div key={stage.status}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Badge
                      className={`${statusColors[stage.status] || 'bg-gray-100 text-gray-800'}`}
                    >
                      {stage.status}
                    </Badge>
                    <div>
                      <p className="font-semibold">{stage.count} orders</p>
                      <p className="text-sm text-muted-foreground">
                        ₹{stage.total_value.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-muted-foreground">{stage.percentage}%</span>
                </div>

                {/* Progress bar */}
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-3">
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

                {/* Flow connector */}
                {index < (pipeline?.length || 0) - 1 && (
                  <div className="flex justify-center my-2">
                    <ArrowRight className="h-5 w-5 text-muted-foreground rotate-90" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Pipeline Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalValue.toLocaleString('en-IN')}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {pipeline?.reduce((sum, p) => sum + p.count, 0) || 0} orders in pipeline
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹
              {(
                totalValue / (pipeline?.reduce((sum, p) => sum + p.count, 0) || 1)
              ).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Per order</p>
          </CardContent>
        </Card>
      </div>

      {/* Stage Details */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Stage Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {pipeline?.map((stage) => (
              <div key={stage.status} className="p-3 border rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-2">{stage.status}</p>
                <p className="text-2xl font-bold mb-1">{stage.count}</p>
                <p className="text-xs text-muted-foreground">
                  {stage.percentage}% of pipeline
                </p>
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs font-semibold">
                    ₹{(stage.total_value / 100000).toFixed(1)}L
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
