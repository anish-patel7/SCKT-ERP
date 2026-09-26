import { useProductionOrders, useOrderProgress } from "@/hooks/useProduction";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function WIPDashboard() {
  const { data: orders = [], isLoading } = useProductionOrders({
    status: "IN_PROGRESS",
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading WIP data...</div>;
  }

  const stats = {
    total_wip: orders.length,
    on_track: orders.filter((o: any) => {
      const daysLeft = Math.ceil(
        (new Date(o.target_delivery_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
      );
      const daysUsed = Math.ceil(
        (new Date().getTime() - new Date(o.started_date).getTime()) / (1000 * 60 * 60 * 24),
      );
      const expectedProgress = daysUsed / (daysUsed + daysLeft);
      return (o.qty_completed_metre / o.qty_metre) >= expectedProgress * 0.9;
    }).length,
    at_risk: orders.filter((o: any) => {
      const progress = o.qty_completed_metre / o.qty_metre;
      return progress < 0.5 && o.qty_metre > 0;
    }).length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total WIP Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_wip}</div>
            <p className="text-xs text-muted-foreground">In production</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">On Track</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.on_track}</div>
            <p className="text-xs text-muted-foreground">Meeting delivery</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">At Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.at_risk}</div>
            <p className="text-xs text-muted-foreground">Behind schedule</p>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Work in Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead>Qty (m)</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order: any) => {
                const percentComplete = (order.qty_completed_metre / order.qty_metre) * 100;
                const daysLeft = Math.ceil(
                  (new Date(order.target_delivery_date).getTime() - new Date().getTime()) /
                    (1000 * 60 * 60 * 24),
                );

                let statusColor = "bg-green-100 text-green-800";
                if (daysLeft < 0) statusColor = "bg-red-100 text-red-800";
                else if (daysLeft < 3) statusColor = "bg-amber-100 text-amber-800";

                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.order_no}</TableCell>
                    <TableCell className="text-sm">{order.quality_name}</TableCell>
                    <TableCell>{order.qty_metre}</TableCell>
                    <TableCell>
                      <div className="w-full space-y-1">
                        <Progress value={percentComplete} className="h-2" />
                        <span className="text-xs text-muted-foreground">
                          {percentComplete.toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {daysLeft >= 0 ? `${daysLeft}d` : "Overdue"}
                    </TableCell>
                    <TableCell>
                      {daysLeft < 0 ? (
                        <Badge variant="destructive">Overdue</Badge>
                      ) : daysLeft < 3 ? (
                        <Badge variant="outline" className="bg-amber-50">
                          Urgent
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-50">
                          On Track
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {orders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No work in progress
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
