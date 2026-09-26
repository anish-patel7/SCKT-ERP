import { useCollectionDashboard } from '@/hooks/useRoleBasedAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Phone, Mail } from 'lucide-react';

export function CollectionSpecialistDashboard() {
  const { data, isLoading } = useCollectionDashboard();

  if (isLoading) {
    return <div className="text-center py-8">Loading collection dashboard...</div>;
  }

  const totalOverdue = data?.by_aging_bucket.reduce((sum, b) => sum + b.total, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Collection Dashboard</h2>
        <p className="text-muted-foreground">Priority collection targets and follow-up tracking</p>
      </div>

      {/* Collection Summary */}
      <Card className="border-red-200 bg-red-50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Total Outstanding Amount</CardTitle>
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-red-600">₹{totalOverdue.toLocaleString('en-IN')}</div>
          <p className="text-sm text-muted-foreground mt-1">
            {data?.priority_list.length || 0} invoices to collect
          </p>
        </CardContent>
      </Card>

      {/* Aging Bucket Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {data?.by_aging_bucket.map((bucket) => (
          <Card key={bucket.bucket}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{bucket.bucket} Days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{bucket.count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                ₹{bucket.total.toLocaleString('en-IN')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Outreach Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Calls Made
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data?.outreach_stats.calls_made || 0}</div>
            <p className="text-xs text-muted-foreground">Today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Emails Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data?.outreach_stats.emails_sent || 0}</div>
            <p className="text-xs text-muted-foreground">Today</p>
          </CardContent>
        </Card>
      </div>

      {/* Collection Targets */}
      <Card>
        <CardHeader>
          <CardTitle>Collection Targets (Top 20)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data?.collection_targets.slice(0, 10).map((target) => (
              <div
                key={target.customer_id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium">{target.customer_id}</p>
                  <p className="text-xs text-muted-foreground">
                    Outstanding: ₹{target.current_outstanding.toLocaleString('en-IN')}
                  </p>
                </div>
                <Badge
                  className={
                    target.priority_level === 'critical'
                      ? 'bg-red-600'
                      : target.priority_level === 'high'
                        ? 'bg-orange-600'
                        : target.priority_level === 'medium'
                          ? 'bg-yellow-600'
                          : 'bg-green-600'
                  }
                >
                  {target.priority_level.toUpperCase()}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
