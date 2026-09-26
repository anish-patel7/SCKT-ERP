import { useState } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSalesOrders } from '@/hooks/useSalesOrders';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, X } from 'lucide-react';

const OrderItemSchema = z.object({
  product_id: z.string().min(1, 'Required'),
  quantity: z.number().positive('Must be positive'),
  unit_price: z.number().positive('Must be positive'),
  discount_percent: z.number().min(0).max(100).default(0),
});

const OrderFormSchema = z.object({
  customer_id: z.string().min(1, 'Customer required'),
  customer_name: z.string().min(1, 'Customer name required'),
  order_date: z.string().min(1, 'Date required'),
  status: z.enum(['DRAFT', 'CONFIRMED']).default('DRAFT'),
  items: z.array(OrderItemSchema).min(1, 'At least one item required'),
  notes: z.string().optional(),
});

type OrderFormData = z.infer<typeof OrderFormSchema>;

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  total: number;
}

export function OrderFormMobile({ initialData, onSuccess, onCancel }: {
  initialData?: any;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const { t } = useLanguage();
  const { mutate: createOrder } = useSalesOrders();
  const [items, setItems] = useState<OrderItem[]>(initialData?.items || []);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [productName, setProductName] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [discount, setDiscount] = useState('0');

  const form = useForm<OrderFormData>({
    resolver: zodResolver(OrderFormSchema),
    defaultValues: {
      customer_id: initialData?.customer_id || '',
      customer_name: initialData?.customer || '',
      order_date: initialData?.order_date || new Date().toISOString().split('T')[0],
      status: 'DRAFT',
      items: [],
      notes: initialData?.notes || '',
    },
  });

  const handleAddItem = () => {
    if (!productId || !quantity || !unitPrice) {
      toast.error(t('validation.required_field') || 'Required fields missing');
      return;
    }

    const newItem: OrderItem = {
      product_id: productId,
      product_name: productName || productId,
      quantity: parseFloat(quantity),
      unit_price: parseFloat(unitPrice),
      discount_percent: parseFloat(discount) || 0,
      total: (parseFloat(quantity) * parseFloat(unitPrice)) * (1 - parseFloat(discount) / 100),
    };

    setItems([...items, newItem]);
    setProductId('');
    setProductName('');
    setQuantity('1');
    setUnitPrice('');
    setDiscount('0');
    setAddItemOpen(false);
    toast.success(t('sales.add_item') || 'Item added');
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);

  const onSubmit = async (data: OrderFormData) => {
    const payload = {
      ...data,
      items: items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent,
      })),
      total_amount: totalAmount,
    };

    createOrder(payload);
    toast.success(t('sales.order_created') || 'Order created successfully');
    onSuccess?.();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('sales.create_order') || 'Create Order'}</h1>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
          {/* Customer Section */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">{t('sales.customer') || 'Customer'}</h2>

            <FormField
              control={form.control}
              name="customer_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">{t('sales.customer') || 'Customer'}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('sales.customer') || 'Enter customer name'}
                      {...field}
                      className="text-sm"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="order_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">{t('sales.order_date') || 'Order Date'}</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} className="text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>

          {/* Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">{t('sales.items') || 'Items'}</h2>
              <Sheet open={addItemOpen} onOpenChange={setAddItemOpen}>
                <SheetTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-2">
                    <Plus className="w-4 h-4" />
                    {t('sales.add_item') || 'Add'}
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-96">
                  <SheetHeader>
                    <SheetTitle>{t('sales.add_item') || 'Add Item'}</SheetTitle>
                  </SheetHeader>

                  <div className="space-y-3 py-4">
                    <div>
                      <label className="text-xs font-semibold">{t('sales.customer') || 'Product'}</label>
                      <Input
                        placeholder={t('common.search') || 'Search product'}
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        className="text-sm mt-1"
                      />
                      <input
                        type="hidden"
                        value={productId}
                        onChange={(e) => setProductId(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold">{t('sales.quantity') || 'Qty'}</label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          className="text-sm mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold">{t('sales.unit_price') || 'Price'}</label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={unitPrice}
                          onChange={(e) => setUnitPrice(e.target.value)}
                          className="text-sm mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold">{t('sales.discount') || 'Discount %'}</label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                        className="text-sm mt-1"
                      />
                    </div>

                    <Button
                      onClick={handleAddItem}
                      className="w-full"
                    >
                      {t('common.add') || 'Add'}
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {items.length === 0 ? (
              <Card className="p-4 text-center">
                <p className="text-xs text-gray-600">{t('common.no_data') || 'No items added'}</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <Card key={index} className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold">{item.product_name}</p>
                        <p className="text-xs text-gray-600">
                          {item.quantity} × ₹{item.unit_price.toFixed(2)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                    {item.discount_percent > 0 && (
                      <Badge variant="secondary" className="text-xs mb-2">
                        {item.discount_percent}% {t('sales.discount') || 'off'}
                      </Badge>
                    )}
                    <div className="flex justify-between pt-2 border-t border-gray-200">
                      <span className="text-xs font-semibold">{t('sales.amount') || 'Total'}</span>
                      <span className="text-sm font-bold">₹{item.total.toFixed(2)}</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Total Section */}
          {items.length > 0 && (
            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-sm">{t('sales.total_amount') || 'Total'}</span>
                <span className="text-lg font-bold text-blue-900">₹{totalAmount.toFixed(2)}</span>
              </div>
            </Card>
          )}

          {/* Notes Section */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">{t('sales.notes') || 'Notes'}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t('sales.notes') || 'Add notes...'}
                    {...field}
                    className="text-sm resize-none min-h-20"
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onCancel}
            >
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={items.length === 0}
            >
              {t('common.save') || 'Save'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
