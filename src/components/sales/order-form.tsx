import { useState } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateOrder, useValidateCreditAvailable } from '@/hooks/useSales';
import { useCustomers } from '@/hooks/useCustomers';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OrderItemEditor } from './order-item-editor';

const OrderFormSchema = z.object({
  order_no: z.string().min(1, 'Order number is required'),
  customer_id: z.string().uuid('Customer is required'),
  order_date: z.string().date(),
  delivery_date: z.string().date(),
  shipping_address: z.string().min(1, 'Shipping address is required'),
  billing_address: z.string().min(1, 'Billing address is required'),
  discount_percent: z.number().nonnegative('Discount must be non-negative').default(0),
  tax_amount: z.number().nonnegative('Tax must be non-negative').default(0),
  delivery_instructions: z.string().optional(),
  remarks: z.string().optional(),
});

type OrderFormData = z.infer<typeof OrderFormSchema>;

interface OrderFormProps {
  onSuccess?: () => void;
}

export function OrderForm({ onSuccess }: OrderFormProps) {
  const { data: customers } = useCustomers({ is_active: true });
  const createOrder = useCreateOrder();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [items, setItems] = useState<any[]>([
    { line_number: 1, fabric_quality_name: '', design_no: '', qty_metre: 0, rate_per_metre: 0, line_total: 0 },
  ]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<OrderFormData>({
    resolver: zodResolver(OrderFormSchema),
    defaultValues: {
      order_date: new Date().toISOString().split('T')[0],
      delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      discount_percent: 0,
      tax_amount: 0,
    },
  });

  const subtotal = items.reduce((sum, item) => sum + (item.line_total || 0), 0);
  const discountAmount = (subtotal * (watch('discount_percent') || 0)) / 100;
  const totalAmount = subtotal - discountAmount + (watch('tax_amount') || 0);

  const onSubmit = async (data: OrderFormData) => {
    if (items.length === 0 || items.some((item) => !item.fabric_quality_name || !item.qty_metre)) {
      toast.error('Please add at least one line item with quality name and quantity');
      return;
    }

    try {
      setIsSubmitting(true);
      await createOrder.mutateAsync({
        order: {
          ...data,
          subtotal_amount: subtotal,
          discount_amount: discountAmount,
          total_amount: totalAmount,
          status: 'DRAFT',
        },
        items: items.map((item) => ({
          line_number: item.line_number,
          fabric_quality_name: item.fabric_quality_name,
          design_no: item.design_no,
          qty_metre: item.qty_metre,
          qty_allocated: 0,
          qty_shipped: 0,
          rate_per_metre: item.rate_per_metre,
          line_total: item.line_total,
          remarks: item.remarks,
        })),
      });
      toast.success('Order created successfully');
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="order_no">Order No. *</Label>
          <Input id="order_no" {...register('order_no')} placeholder="SO-001" />
          {errors.order_no && <p className="text-sm text-red-500">{errors.order_no.message}</p>}
        </div>
        <div>
          <Label htmlFor="customer_id">Customer *</Label>
          <Select
            value={selectedCustomer}
            onValueChange={(value) => {
              setSelectedCustomer(value);
              setValue('customer_id', value);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select customer" />
            </SelectTrigger>
            <SelectContent>
              {customers?.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.party_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.customer_id && (
            <p className="text-sm text-red-500">{errors.customer_id.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="order_date">Order Date</Label>
          <Input id="order_date" type="date" {...register('order_date')} />
          {errors.order_date && <p className="text-sm text-red-500">{errors.order_date.message}</p>}
        </div>
        <div>
          <Label htmlFor="delivery_date">Delivery Date</Label>
          <Input id="delivery_date" type="date" {...register('delivery_date')} />
          {errors.delivery_date && (
            <p className="text-sm text-red-500">{errors.delivery_date.message}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="shipping_address">Shipping Address *</Label>
        <textarea
          id="shipping_address"
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          {...register('shipping_address')}
          placeholder="Enter shipping address"
        />
        {errors.shipping_address && (
          <p className="text-sm text-red-500">{errors.shipping_address.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="billing_address">Billing Address *</Label>
        <textarea
          id="billing_address"
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          {...register('billing_address')}
          placeholder="Enter billing address"
        />
        {errors.billing_address && (
          <p className="text-sm text-red-500">{errors.billing_address.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Line Items</h3>
        <OrderItemEditor items={items} onItemsChange={setItems} />
      </div>

      <div className="bg-gray-50 p-4 rounded-lg space-y-2">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>₹{subtotal.toLocaleString('en-IN')}</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="discount_percent">Discount (%)</Label>
            <Input
              id="discount_percent"
              type="number"
              step="0.01"
              {...register('discount_percent', { valueAsNumber: true })}
            />
          </div>
          <div>
            <Label htmlFor="tax_amount">Tax (₹)</Label>
            <Input
              id="tax_amount"
              type="number"
              step="0.01"
              {...register('tax_amount', { valueAsNumber: true })}
            />
          </div>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between">
            <span>Discount Amount:</span>
            <span>-₹{discountAmount.toLocaleString('en-IN')}</span>
          </div>
        )}
        <div className="border-t pt-2 flex justify-between font-semibold">
          <span>Total Amount:</span>
          <span>₹{totalAmount.toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div>
        <Label htmlFor="delivery_instructions">Delivery Instructions</Label>
        <textarea
          id="delivery_instructions"
          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          {...register('delivery_instructions')}
        />
      </div>

      <div>
        <Label htmlFor="remarks">Remarks</Label>
        <textarea
          id="remarks"
          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          {...register('remarks')}
        />
      </div>

      <Button type="submit" disabled={isSubmitting || createOrder.isPending}>
        {isSubmitting ? 'Creating...' : 'Create Order'}
      </Button>
    </form>
  );
}
