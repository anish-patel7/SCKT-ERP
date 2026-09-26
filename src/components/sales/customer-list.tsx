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
import { useCustomers } from '@/hooks/useCustomers';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CustomerForm } from './customer-form';

export function CustomerList() {
  const { data: customers, isLoading } = useCustomers({ is_active: true });
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isLoading) {
    return <div className="text-center py-8">Loading customers...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Customers</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>+ New Customer</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Customer</DialogTitle>
            </DialogHeader>
            <CustomerForm onSuccess={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Party Name</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Credit Limit</TableHead>
              <TableHead>Used</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Terms (Days)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers?.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="font-medium">{customer.party_id}</TableCell>
                <TableCell>{customer.contact_person || '-'}</TableCell>
                <TableCell>{customer.email || '-'}</TableCell>
                <TableCell>₹{customer.credit_limit.toLocaleString('en-IN')}</TableCell>
                <TableCell>₹{customer.current_credit_used.toLocaleString('en-IN')}</TableCell>
                <TableCell>
                  ₹{(customer.credit_limit - customer.current_credit_used).toLocaleString('en-IN')}
                </TableCell>
                <TableCell>{customer.payment_terms_days}</TableCell>
                <TableCell>
                  <Badge variant={customer.is_active ? 'default' : 'secondary'}>
                    {customer.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCustomer(customer)}
                      >
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Customer</DialogTitle>
                      </DialogHeader>
                      {selectedCustomer && (
                        <CustomerForm
                          initialData={selectedCustomer}
                          onSuccess={() => {
                            setSelectedCustomer(null);
                          }}
                        />
                      )}
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
