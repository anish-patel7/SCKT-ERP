import { useCollectionPriority } from '@/hooks/useSalesAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, Phone, Mail } from 'lucide-react';

export function CollectionPriorityList() {
  const { data: priorityInvoices, isLoading } = useCollectionPriority();

  if (isLoading) {
    return <div className="text-center py-8">Loading priority list...</div>;
  }

  const totalAmount = priorityInvoices?.reduce((sum, inv) => sum + inv.amount_outstanding, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Collection Priority List</h2>
        <p className="text-muted-foreground">Top 20 invoices requiring immediate collection action</p>
      </div>

      {/* Priority Summary */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Priority Collection Target</CardTitle>
          <AlertTriangle className="h-5 w-5 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-orange-600">₹{totalAmount.toLocaleString('en-IN')}</div>
          <p className="text-sm text-muted-foreground mt-1">{priorityInvoices?.length || 0} invoices to collect</p>
        </CardContent>
      </Card>

      {/* Priority List */}
      <Card>
        <CardHeader>
          <CardTitle>Action Required</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead>Invoice No.</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Days Overdue</TableHead>
                  <TableHead>Amount Outstanding</TableHead>
                  <TableHead>Aging</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priorityInvoices?.map((invoice, index) => (
                  <TableRow key={invoice.id} className="hover:bg-gray-50">
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          index < 5
                            ? 'bg-red-100 text-red-800 border-red-300'
                            : index < 10
                              ? 'bg-orange-100 text-orange-800 border-orange-300'
                              : 'bg-yellow-100 text-yellow-800 border-yellow-300'
                        }
                      >
                        #{index + 1}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{invoice.invoice_no}</TableCell>
                    <TableCell>{invoice.customer_id}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(invoice.due_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          invoice.days_overdue > 90
                            ? 'font-bold text-red-600'
                            : invoice.days_overdue > 60
                              ? 'font-bold text-orange-600'
                              : 'text-yellow-600'
                        }
                      >
                        {invoice.days_overdue} days
                      </span>
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
                    <TableCell className="space-x-1">
                      <Button size="sm" variant="outline" className="h-8">
                        <Phone className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-8">
                        <Mail className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {priorityInvoices?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No invoices to collect — all payments current
            </div>
          )}
        </CardContent>
      </Card>

      {/* Collection Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Extreme Priority (90+ days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {priorityInvoices?.filter((i) => i.days_overdue > 90).length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ₹{(priorityInvoices?.filter((i) => i.days_overdue > 90).reduce((sum, i) => sum + i.amount_outstanding, 0) || 0).toLocaleString('en-IN')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">High Priority (60-90 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {priorityInvoices?.filter((i) => i.days_overdue > 60 && i.days_overdue <= 90).length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ₹{(priorityInvoices?.filter((i) => i.days_overdue > 60 && i.days_overdue <= 90).reduce((sum, i) => sum + i.amount_outstanding, 0) || 0).toLocaleString('en-IN')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Medium Priority (30-60 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {priorityInvoices?.filter((i) => i.days_overdue > 30 && i.days_overdue <= 60).length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ₹{(priorityInvoices?.filter((i) => i.days_overdue > 30 && i.days_overdue <= 60).reduce((sum, i) => sum + i.amount_outstanding, 0) || 0).toLocaleString('en-IN')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
