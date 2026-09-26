import { usePaymentPatterns } from '@/hooks/useSalesAnalytics';
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
import { TrendingUp } from 'lucide-react';

export function PaymentPatternAnalysis() {
  const { data: patterns, isLoading } = usePaymentPatterns();

  if (isLoading) {
    return <div className="text-center py-8">Loading payment patterns...</div>;
  }

  const avgPaymentDays =
    patterns?.length && patterns?.length > 0
      ? Math.round(patterns.reduce((sum, p) => sum + p.avg_payment_days, 0) / patterns.length)
      : 0;

  const totalInvoiced = patterns?.reduce((sum, p) => sum + p.total_invoiced, 0) || 0;
  const totalPaid = patterns?.reduce((sum, p) => sum + p.total_paid, 0) || 0;
  const overallPaymentRate = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Payment Pattern Analysis</h2>
        <p className="text-muted-foreground">12-month trend of invoice creation and payment rates</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Average Payment Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgPaymentDays} days</div>
            <p className="text-xs text-muted-foreground mt-1">
              Last 12 months average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Invoiced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoiced}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Invoices created last year
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Payment Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallPaymentRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalPaid} / {totalInvoiced} invoices paid
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Invoice & Payment Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Invoices Created</TableHead>
                  <TableHead>Payments Received</TableHead>
                  <TableHead>Payment Rate</TableHead>
                  <TableHead>Avg Days to Pay</TableHead>
                  <TableHead>Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patterns?.map((pattern, index) => {
                  const paymentRate =
                    pattern.total_invoiced > 0
                      ? Math.round((pattern.total_paid / pattern.total_invoiced) * 100)
                      : 0;

                  const prevPattern = patterns[index - 1];
                  const trend =
                    prevPattern &&
                    (paymentRate > Math.round((prevPattern.total_paid / prevPattern.total_invoiced) * 100)
                      ? 'up'
                      : 'down');

                  return (
                    <TableRow key={pattern.month} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{pattern.month}</TableCell>
                      <TableCell>{pattern.total_invoiced}</TableCell>
                      <TableCell>{pattern.total_paid}</TableCell>
                      <TableCell>
                        <Badge variant={paymentRate >= 75 ? 'default' : 'secondary'}>
                          {paymentRate}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            pattern.avg_payment_days <= 30
                              ? 'text-green-600 font-semibold'
                              : pattern.avg_payment_days <= 60
                                ? 'text-yellow-600'
                                : 'text-red-600'
                          }
                        >
                          {pattern.avg_payment_days} days
                        </span>
                      </TableCell>
                      <TableCell>
                        {trend && (
                          <Badge
                            variant={trend === 'up' ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {trend === 'up' ? '↑ Improving' : '↓ Declining'}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Payment Efficiency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fast Payers (≤30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {patterns?.filter((p) => p.avg_payment_days <= 30).length || 0}
            </div>
            <p className="text-sm text-muted-foreground mt-1">months with quick payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Slow Payers (&gt;60 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {patterns?.filter((p) => p.avg_payment_days > 60).length || 0}
            </div>
            <p className="text-sm text-muted-foreground mt-1">months with delayed payment</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
