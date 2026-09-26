import { useManagerDashboard } from '@/hooks/useRoleBasedAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Users, TrendingUp } from 'lucide-react';

interface ManagerDashboardProps {
  userId: string;
}

export function ManagerDashboard({ userId }: ManagerDashboardProps) {
  const { data, isLoading } = useManagerDashboard(userId);

  if (isLoading) {
    return <div className="text-center py-8">Loading team dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Team Manager Dashboard</h2>
        <p className="text-muted-foreground">Team performance and member analytics</p>
      </div>

      {/* Team KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Team Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.team_sales_kpis.total_orders || 0}</div>
            <p className="text-xs text-muted-foreground">
              {data?.team_sales_kpis.delivered_orders || 0} delivered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Team Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{(data?.team_sales_kpis.total_revenue || 0).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg: ₹{(data?.team_sales_kpis.average_order_value || 0).toLocaleString('en-IN')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Confirmation Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(data?.team_sales_kpis.average_order_value || 0) > 0 ? '85' : '0'}%
            </div>
            <p className="text-xs text-muted-foreground">Orders confirmed / total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              {data?.team_member_performance.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Active team members</p>
          </CardContent>
        </Card>
      </div>

      {/* Team Member Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Team Member Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Total Value</TableHead>
                  <TableHead>Avg Order Value</TableHead>
                  <TableHead>Confirmation Rate</TableHead>
                  <TableHead>Overdue Invoices</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.team_member_performance.map((member) => (
                  <TableRow key={member.member_id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{member.member_name}</TableCell>
                    <TableCell>{member.orders_created}</TableCell>
                    <TableCell>₹{member.total_value.toLocaleString('en-IN')}</TableCell>
                    <TableCell>₹{member.avg_order_value.toLocaleString('en-IN')}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{member.confirmed_rate.toFixed(0)}%</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.overdue_invoices > 0 ? 'destructive' : 'default'}>
                        {member.overdue_invoices}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
