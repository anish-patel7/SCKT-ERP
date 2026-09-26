import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useInvoices } from '@/hooks/useInvoicing';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PaymentForm } from './payment-form';
import { Eye, DollarSign } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const statusColors: Record<string, string> = {
  UNPAID: 'destructive',
  PARTIAL: 'outline',
  PAID: 'default',
  OVERDUE: 'destructive',
  CANCELLED: 'secondary',
};

export function InvoiceList() {
  const { data: invoices, isLoading } = useInvoices();
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  if (isLoading) {
    return <div className="text-center py-8">Loading invoices...</div>;
  }

  const filteredInvoices = filterStatus
    ? invoices?.filter((invoice) => invoice.status === filterStatus)
    : invoices;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Invoices</h2>
          <div className="flex gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                <SelectItem value="UNPAID">Unpaid</SelectItem>
                <SelectItem value="PARTIAL">Partial</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="OVERDUE">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice No.</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Invoice Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Paid Amount</TableHead>
              <TableHead>Outstanding</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices?.map((invoice) => {
              const isOverdue = new Date(invoice.due_date) < new Date() && invoice.status !== 'PAID';
              const status = isOverdue ? 'OVERDUE' : invoice.status;

              return (
                <TableRow key={invoice.invoice_id} className={isOverdue ? 'bg-red-50' : ''}>
                  <TableCell className="font-medium">{invoice.invoice_no}</TableCell>
                  <TableCell>{invoice.customer_id}</TableCell>
                  <TableCell>{new Date(invoice.invoice_date).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                  <TableCell>₹{invoice.total_amount.toLocaleString('en-IN')}</TableCell>
                  <TableCell>₹{invoice.amount_paid.toLocaleString('en-IN')}</TableCell>
                  <TableCell>₹{invoice.amount_outstanding.toLocaleString('en-IN')}</TableCell>
                  <TableCell>
                    <Badge variant={statusColors[status]}>
                      {status}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Invoice Details</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Invoice No.</p>
                              <p className="font-semibold">{invoice.invoice_no}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Customer</p>
                              <p className="font-semibold">{invoice.customer_id}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Invoice Date</p>
                              <p className="font-semibold">
                                {new Date(invoice.invoice_date).toLocaleDateString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Due Date</p>
                              <p className="font-semibold">
                                {new Date(invoice.due_date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                            <div className="border-t pt-2 flex justify-between font-semibold mb-3">
                              <span>Total:</span>
                              <span>₹{invoice.total_amount.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="bg-white p-3 rounded">
                              <div className="flex justify-between mb-1">
                                <span>Paid:</span>
                                <span className="text-green-600">₹{invoice.amount_paid.toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Outstanding:</span>
                                <span className="text-red-600">₹{invoice.amount_outstanding.toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {invoice.status !== 'PAID' && (
                      <Dialog open={paymentDialogOpen && selectedInvoice?.invoice_id === invoice.invoice_id} onOpenChange={setPaymentDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedInvoice(invoice)}
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Record Payment
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Record Payment</DialogTitle>
                          </DialogHeader>
                          {selectedInvoice && (
                            <PaymentForm
                              invoiceId={selectedInvoice.invoice_id}
                              invoiceAmount={selectedInvoice.amount_outstanding}
                              onSuccess={() => {
                                setPaymentDialogOpen(false);
                                setSelectedInvoice(null);
                              }}
                            />
                          )}
                        </DialogContent>
                      </Dialog>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
