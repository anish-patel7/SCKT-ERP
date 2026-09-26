import { useState, useCallback } from 'react';
import { useSalesOrders } from '@/hooks/useSalesOrders';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronRight, Filter, Plus, Trash2 } from 'lucide-react';

interface SalesOrder {
  id: string;
  order_no: string;
  customer: string;
  status: string;
  total_amount: number;
  order_date: string;
}

export function OrderListMobile({ onCreateNew, onOrderSelect }: {
  onCreateNew?: () => void;
  onOrderSelect?: (orderId: string) => void;
}) {
  const { data: orders = [], isLoading } = useSalesOrders();
  const { t } = useLanguage();
  const [filteredOrders, setFilteredOrders] = useState<SalesOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [swipeAction, setSwipeAction] = useState<{ orderId: string; action: 'delete' | null } | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { mutate: deleteOrder } = useSalesOrders();

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent, orderId: string) => {
    if (!touchStart) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (diff > 50) {
      setSwipeAction({ orderId, action: 'delete' });
    } else if (diff < -50) {
      setSwipeAction(null);
    }
    setTouchStart(null);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    if (status === 'all') {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter((o) => o.status === status));
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    deleteOrder({ id: orderId });
    setDeleteConfirm(null);
    setSwipeAction(null);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      CONFIRMED: 'bg-blue-100 text-blue-800',
      ALLOCATED: 'bg-purple-100 text-purple-800',
      SHIPPED: 'bg-yellow-100 text-yellow-800',
      DELIVERED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const statuses = [
    { value: 'all', label: t('common.all') || 'All' },
    { value: 'DRAFT', label: t('sales.status_draft') || 'Draft' },
    { value: 'CONFIRMED', label: t('sales.status_confirmed') || 'Confirmed' },
    { value: 'ALLOCATED', label: t('sales.status_allocated') || 'Allocated' },
    { value: 'SHIPPED', label: t('sales.status_shipped') || 'Shipped' },
    { value: 'DELIVERED', label: t('sales.status_delivered') || 'Delivered' },
    { value: 'CANCELLED', label: t('sales.status_cancelled') || 'Cancelled' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>{t('common.loading') || 'Loading...'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">{t('sales.orders') || 'Orders'}</h1>
          <Button
            size="sm"
            onClick={onCreateNew}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('sales.create_order') || 'New'}
          </Button>
        </div>

        {/* Filter Sheet */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 w-full">
              <Filter className="w-4 h-4" />
              {t('common.filter') || 'Filter'}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-64">
            <SheetHeader>
              <SheetTitle>{t('common.filter') || 'Filter'}</SheetTitle>
              <SheetDescription>{t('sales.status') || 'Status'}</SheetDescription>
            </SheetHeader>
            <div className="py-4 space-y-2">
              {statuses.map((status) => (
                <Button
                  key={status.value}
                  variant={statusFilter === status.value ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => handleStatusFilter(status.value)}
                >
                  {status.label}
                </Button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Orders List */}
      <div className="space-y-2 px-4 py-4">
        {orders.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-gray-600">{t('common.no_data') || 'No orders found'}</p>
          </Card>
        ) : (
          orders.map((order: SalesOrder) => (
            <div
              key={order.id}
              onTouchStart={handleTouchStart}
              onTouchEnd={(e) => handleTouchEnd(e, order.id)}
              className="relative"
            >
              {/* Delete Action Background */}
              {swipeAction?.orderId === order.id && (
                <div className="absolute inset-0 bg-red-500 rounded-lg flex items-center justify-end pr-4 z-0">
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
              )}

              {/* Order Card */}
              <Card
                className={`relative z-10 p-4 cursor-pointer transition-all ${
                  swipeAction?.orderId === order.id ? 'translate-x-full' : 'translate-x-0'
                }`}
                onClick={() => onOrderSelect?.(order.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-sm">{order.order_no}</h3>
                    <p className="text-xs text-gray-600">{order.customer}</p>
                  </div>
                  <Badge className={getStatusColor(order.status)}>
                    {order.status}
                  </Badge>
                </div>

                <div className="flex items-end justify-between">
                  <p className="text-xs text-gray-500">
                    {new Date(order.order_date).toLocaleDateString()}
                  </p>
                  <div className="text-right">
                    <p className="font-semibold text-sm">₹{order.total_amount?.toFixed(2) || '0.00'}</p>
                    <ChevronRight className="w-4 h-4 text-gray-400 inline" />
                  </div>
                </div>

                {/* Delete Button (Swipe Action) */}
                {swipeAction?.orderId === order.id && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-20"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(order.id);
                    }}
                  >
                    {t('common.delete') || 'Delete'}
                  </Button>
                )}
              </Card>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>{t('common.delete') || 'Delete'}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('sales.confirm_cancel') || 'Are you sure you want to delete this order?'}
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>{t('common.cancel') || 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDeleteOrder(deleteConfirm)}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('common.delete') || 'Delete'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
