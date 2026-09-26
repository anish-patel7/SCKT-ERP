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
import { useOrders, useUpdateOrderStatus, useConfirmOrder, useShipOrder, useDeliverOrder } from '@/hooks/useSales';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { OrderForm } from './order-form';
import { Eye, CheckCircle2, Truck, Package } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const statusColors: Record<string, string> = {
  DRAFT: 'secondary',
  CONFIRMED: 'outline',
  ALLOCATED: 'secondary',
  FULFILLED: 'outline',
  SHIPPED: 'outline',
  DELIVERED: 'default',
  INVOICED: 'secondary',
  PAID: 'default',
  CANCELLED: 'destructive',
};

const statusActions: Record<string, string[]> = {
  DRAFT: ['CONFIRMED'],
  CONFIRMED: ['ALLOCATED'],
  ALLOCATED: ['FULFILLED'],
  FULFILLED: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
};

export function OrderList() {
  const { data: orders, isLoading } = useOrders();
  const updateStatus = useUpdateOrderStatus();
  const confirmOrder = useConfirmOrder();
  const shipOrder = useShipOrder();
  const deliverOrder = useDeliverOrder();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');

  if (isLoading) {
    return <div className="text-center py-8">Loading orders...</div>;
  }

  const filteredOrders = filterStatus
    ? orders?.filter((order) => order.status === filterStatus)
    : orders;

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      if (newStatus === 'CONFIRMED') {
        await confirmOrder.mutateAsync(orderId);
      } else if (newStatus === 'SHIPPED') {
        await shipOrder.mutateAsync(orderId);
      } else if (newStatus === 'DELIVERED') {
        await deliverOrder.mutateAsync(orderId);
      } else {
        await updateStatus.mutateAsync({
          id: orderId,
          status: newStatus,
        });
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Orders</h2>
          <div className="flex gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="ALLOCATED">Allocated</SelectItem>
                <SelectItem value="FULFILLED">Fulfilled</SelectItem>
                <SelectItem value="SHIPPED">Shipped</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>+ New Order</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Create Order</DialogTitle>
            </DialogHeader>
            <OrderForm onSuccess={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order No.</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Order Date</TableHead>
              <TableHead>Delivery Date</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders?.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.order_no}</TableCell>
                <TableCell>{order.customer_id}</TableCell>
                <TableCell>{new Date(order.order_date).toLocaleDateString()}</TableCell>
                <TableCell>{new Date(order.delivery_date).toLocaleDateString()}</TableCell>
                <TableCell>₹{order.total_amount.toLocaleString('en-IN')}</TableCell>
                <TableCell>
                  <Badge variant={statusColors[order.status]}>
                    {order.status}
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
                        <DialogTitle>Order Details</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Order No.</p>
                            <p className="font-semibold">{order.order_no}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Customer</p>
                            <p className="font-semibold">{order.customer_id}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Order Date</p>
                            <p className="font-semibold">
                              {new Date(order.order_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Delivery Date</p>
                            <p className="font-semibold">
                              {new Date(order.delivery_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Shipping Address</p>
                          <p className="text-sm">{order.shipping_address}</p>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex justify-between mb-2">
                            <span>Subtotal:</span>
                            <span>₹{order.subtotal_amount.toLocaleString('en-IN')}</span>
                          </div>
                          {order.discount_amount > 0 && (
                            <div className="flex justify-between mb-2">
                              <span>Discount:</span>
                              <span>-₹{order.discount_amount.toLocaleString('en-IN')}</span>
                            </div>
                          )}
                          {order.tax_amount > 0 && (
                            <div className="flex justify-between mb-2">
                              <span>Tax:</span>
                              <span>₹{order.tax_amount.toLocaleString('en-IN')}</span>
                            </div>
                          )}
                          <div className="border-t pt-2 flex justify-between font-semibold">
                            <span>Total:</span>
                            <span>₹{order.total_amount.toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {statusActions[order.status]?.includes('CONFIRMED') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusUpdate(order.id, 'CONFIRMED')}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Confirm
                    </Button>
                  )}
                  {statusActions[order.status]?.includes('SHIPPED') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusUpdate(order.id, 'SHIPPED')}
                    >
                      <Truck className="h-4 w-4 mr-1" />
                      Ship
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
