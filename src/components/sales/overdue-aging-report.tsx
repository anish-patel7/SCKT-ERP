import { useCreditAgingAnalysis, useOverdueInvoices } from '@/hooks/useSalesAnalytics';
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
import { AlertCircle, Clock } from 'lucide-react';

export function OverdueAgingReport() {
  const { data: agingBuckets, isLoading: bucketsLoading } = useCreditAgingAnalysis();
  const { data: overdueInvoices, isLoading: invoicesLoading } = useOverdueInvoices();

  const isLoading = bucketsLoading || invoicesLoading;

  if (isLoading) {
    return <div className="text-center py-8">Loading aging report...</div>;
  }

  const totalOverdue = agingBuckets?.reduce((sum, b) => sum + b.total_amount, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Overdue Aging Analysis</h2>
        <p className="text-muted-foreground">Track invoice aging and payment delays by bucket</p>
      </div>

      {/* Aging Buckets Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {agingBuckets?.map((bucket) => (
          <Card key={bucket.bucket}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {bucket.bucket} Days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{bucket.count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                ₹{bucket.total_amount.toLocaleString('en-IN')}
              </p>
              <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    bucket.bucket === '0-30'
                      ? 'bg-yellow-500'
                      : bucket.bucket === '31-60'
                        ? 'bg-orange-500'
                        : bucket.bucket === '61-90'
                          ? 'bg-red-500'
                          : 'bg-red-700'
                  }`}
                  style={{
                    width: `${totalOverdue > 0 ? (bucket.total_amount / totalOverdue) * 100 : 0}%`,
                  }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Total Overdue Summary */}
      <Card className="border-red-200 bg-red-50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Total Outstanding Amount</CardTitle>
          <AlertCircle className="h-5 w-5 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-red-600">₹{totalOverdue.toLocaleString('en-IN')}</div>
          <p className="text-sm text-muted-foreground mt-1">{overdueInvoices?.length || 0} overdue invoices</p>
        </CardContent>
      </Card>

      {/* Overdue Invoices Detail */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Overdue Invoices (Latest First)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice No.</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Days Overdue</TableHead>
                  <TableHead>Amount Outstanding</TableHead>
                  <TableHead>Aging Bucket</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueInvoices?.map((invoice) => (
                  <TableRow key={invoice.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{invoice.invoice_no}</TableCell>
                    <TableCell>{invoice.customer_id}</TableCell>
                    <TableCell>{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          invoice.days_overdue <= 30
                            ? 'outline'
                            : invoice.days_overdue <= 60
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {invoice.days_overdue} days
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">
                      ₹{invoice.amount_outstanding.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          invoice.aging_bucket === '0-30'
                            ? 'bg-yellow-100 text-yellow-800'
                            : invoice.aging_bucket === '31-60'
                              ? 'bg-orange-100 text-orange-800'
                              : invoice.aging_bucket === '61-90'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-red-600 text-white'
                        }
                      >
                        {invoice.aging_bucket}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {overdueInvoices?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No overdue invoices
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
