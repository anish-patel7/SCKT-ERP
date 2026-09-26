import { useSalesExecutiveDashboard } from '@/hooks/useRoleBasedAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp } from 'lucide-react';

interface SalesExecDashboardProps {
  userId: string;
}

export function SalesExecDashboard({ userId }: SalesExecDashboardProps) {
  const { data, isLoading } = useSalesExecutiveDashboard(userId);

  if (isLoading) {
    return <div className="text-center py-8">Loading personal dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">My Sales Dashboard</h2>
        <p className="text-muted-foreground">Personal pipeline and customer performance</p>
      </div>

      {/* Personal KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Orders Created</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.personal_performance.orders_created || 0}</div>
            <p className="text-xs text-muted-foreground">Total orders in pipeline</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{(data?.personal_performance.total_value || 0).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg: ₹{(data?.personal_performance.avg_order_value || 0).toLocaleString('en-IN')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Confirmation Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.personal_performance.confirmed_rate.toFixed(0) || 0}%</div>
            <p className="text-xs text-muted-foreground">Orders confirmed / created</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Quota Achievement</CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {data?.personal_performance.quota_achievement || 0}%
            </div>
            <p className="text-xs text-muted-foreground">Of monthly target</p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            My Order Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data?.personal_pipeline.map((stage) => (
              <div key={stage.status}>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline">{stage.status}</Badge>
                  <span className="text-sm font-semibold">{stage.count} orders</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${stage.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ₹{stage.total_value.toLocaleString('en-IN')} · {stage.percentage}%
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
