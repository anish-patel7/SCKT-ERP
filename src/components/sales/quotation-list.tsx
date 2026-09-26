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
import { useQuotations, useUpdateQuotationStatus } from '@/hooks/useSales';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { QuotationForm } from './quotation-form';
import { Eye } from 'lucide-react';

const statusColors: Record<string, string> = {
  DRAFT: 'secondary',
  SENT: 'outline',
  ACCEPTED: 'default',
  REJECTED: 'destructive',
  EXPIRED: 'secondary',
  CLOSED: 'secondary',
};

const statusActions: Record<string, string> = {
  DRAFT: 'Send',
  SENT: 'Convert to Order',
};

export function QuotationList() {
  const { data: quotations, isLoading } = useQuotations();
  const updateStatus = useUpdateQuotationStatus();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isLoading) {
    return <div className="text-center py-8">Loading quotations...</div>;
  }

  const handleStatusUpdate = async (quotationId: string, newStatus: string) => {
    try {
      await updateStatus.mutateAsync({
        id: quotationId,
        status: newStatus,
      });
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Quotations</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>+ New Quotation</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Create Quotation</DialogTitle>
            </DialogHeader>
            <QuotationForm onSuccess={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quotation No.</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Quoted Date</TableHead>
              <TableHead>Valid Till</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotations?.map((quotation) => (
              <TableRow key={quotation.id}>
                <TableCell className="font-medium">{quotation.quotation_no}</TableCell>
                <TableCell>{quotation.customer_id}</TableCell>
                <TableCell>{new Date(quotation.quoted_date).toLocaleDateString()}</TableCell>
                <TableCell>{new Date(quotation.valid_till).toLocaleDateString()}</TableCell>
                <TableCell>₹{quotation.total_amount.toLocaleString('en-IN')}</TableCell>
                <TableCell>
                  <Badge variant={statusColors[quotation.status]}>
                    {quotation.status}
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
                        <DialogTitle>Quotation Details</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Quotation No.</p>
                            <p className="font-semibold">{quotation.quotation_no}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Customer</p>
                            <p className="font-semibold">{quotation.customer_id}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Items</p>
                          <div className="border rounded-lg p-4">
                            {/* Items would be displayed here */}
                            <p className="text-sm text-gray-500">Item details</p>
                          </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex justify-between mb-2">
                            <span>Subtotal:</span>
                            <span>₹{quotation.subtotal_amount.toLocaleString('en-IN')}</span>
                          </div>
                          {quotation.discount_amount > 0 && (
                            <div className="flex justify-between mb-2">
                              <span>Discount:</span>
                              <span>-₹{quotation.discount_amount.toLocaleString('en-IN')}</span>
                            </div>
                          )}
                          {quotation.tax_amount > 0 && (
                            <div className="flex justify-between mb-2">
                              <span>Tax:</span>
                              <span>₹{quotation.tax_amount.toLocaleString('en-IN')}</span>
                            </div>
                          )}
                          <div className="border-t pt-2 flex justify-between font-semibold">
                            <span>Total:</span>
                            <span>₹{quotation.total_amount.toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {statusActions[quotation.status] && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (quotation.status === 'DRAFT') {
                          handleStatusUpdate(quotation.id, 'SENT');
                        }
                      }}
                    >
                      {statusActions[quotation.status]}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
