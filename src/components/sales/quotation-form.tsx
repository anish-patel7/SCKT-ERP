import { useState } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateQuotation } from '@/hooks/useSales';
import { useCustomers } from '@/hooks/useCustomers';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QuotationItemEditor } from './quotation-item-editor';

const QuotationFormSchema = z.object({
  quotation_no: z.string().min(1, 'Quotation number is required'),
  customer_id: z.string().uuid('Customer is required'),
  quoted_date: z.string().date(),
  valid_till: z.string().date(),
  discount_percent: z.number().nonnegative('Discount must be non-negative').default(0),
  tax_amount: z.number().nonnegative('Tax must be non-negative').default(0),
  remarks: z.string().optional(),
});

type QuotationFormData = z.infer<typeof QuotationFormSchema>;

interface QuotationFormProps {
  onSuccess?: () => void;
}

export function QuotationForm({ onSuccess }: QuotationFormProps) {
  const { data: customers } = useCustomers({ is_active: true });
  const createQuotation = useCreateQuotation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [items, setItems] = useState<any[]>([
    { line_number: 1, fabric_quality_name: '', design_no: '', qty_metre: 0, rate_per_metre: 0, line_total: 0 },
  ]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<QuotationFormData>({
    resolver: zodResolver(QuotationFormSchema),
    defaultValues: {
      quoted_date: new Date().toISOString().split('T')[0],
      valid_till: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      discount_percent: 0,
      tax_amount: 0,
    },
  });

  const subtotal = items.reduce((sum, item) => sum + (item.line_total || 0), 0);
  const discountAmount = (subtotal * (watch('discount_percent') || 0)) / 100;
  const totalAmount = subtotal - discountAmount + (watch('tax_amount') || 0);

  const onSubmit = async (data: QuotationFormData) => {
    if (items.length === 0 || items.some((item) => !item.fabric_quality_name || !item.qty_metre)) {
      toast.error('Please add at least one line item with quality name and quantity');
      return;
    }

    try {
      setIsSubmitting(true);
      await createQuotation.mutateAsync({
        quotation: {
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
          rate_per_metre: item.rate_per_metre,
          line_total: item.line_total,
          remarks: item.remarks,
        })),
      });
      toast.success('Quotation created successfully');
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create quotation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="quotation_no">Quotation No. *</Label>
          <Input id="quotation_no" {...register('quotation_no')} placeholder="QT-001" />
          {errors.quotation_no && (
            <p className="text-sm text-red-500">{errors.quotation_no.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="customer_id">Customer *</Label>
          <Select value={watch('customer_id')} onValueChange={(value) => setValue('customer_id', value)}>
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
          <Label htmlFor="quoted_date">Quoted Date</Label>
          <Input id="quoted_date" type="date" {...register('quoted_date')} />
          {errors.quoted_date && <p className="text-sm text-red-500">{errors.quoted_date.message}</p>}
        </div>
        <div>
          <Label htmlFor="valid_till">Valid Till</Label>
          <Input id="valid_till" type="date" {...register('valid_till')} />
          {errors.valid_till && <p className="text-sm text-red-500">{errors.valid_till.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Line Items</h3>
        <QuotationItemEditor items={items} onItemsChange={setItems} />
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
        <Label htmlFor="remarks">Remarks</Label>
        <textarea
          id="remarks"
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          {...register('remarks')}
        />
      </div>

      <Button type="submit" disabled={isSubmitting || createQuotation.isPending}>
        {isSubmitting ? 'Creating...' : 'Create Quotation'}
      </Button>
    </form>
  );
}
