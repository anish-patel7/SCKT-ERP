import { useState } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRecordPayment } from '@/hooks/useInvoicing';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PaymentFormSchema = z.object({
  invoice_id: z.string().uuid('Invoice is required'),
  payment_date: z.string().date(),
  amount_paid: z.number().positive('Amount must be positive'),
  payment_method: z.enum(['CASH', 'CHEQUE', 'NEFT', 'RTGS', 'BANK_TRANSFER', 'CREDIT']).optional(),
  reference_number: z.string().max(100).optional(),
  remarks: z.string().optional(),
});

type PaymentFormData = z.infer<typeof PaymentFormSchema>;

interface PaymentFormProps {
  invoiceId?: string;
  invoiceAmount?: number;
  onSuccess?: () => void;
}

export function PaymentForm({ invoiceId, invoiceAmount, onSuccess }: PaymentFormProps) {
  const recordPayment = useRecordPayment();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<PaymentFormData>({
    resolver: zodResolver(PaymentFormSchema),
    defaultValues: {
      invoice_id: invoiceId,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'BANK_TRANSFER',
    },
  });

  const onSubmit = async (data: PaymentFormData) => {
    if (invoiceAmount && data.amount_paid > invoiceAmount) {
      toast.error(`Payment amount cannot exceed invoice total (₹${invoiceAmount.toLocaleString('en-IN')})`);
      return;
    }

    try {
      setIsSubmitting(true);
      await recordPayment.mutateAsync(data);
      toast.success('Payment recorded successfully');
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {!invoiceId && (
        <div>
          <Label htmlFor="invoice_id">Invoice *</Label>
          <Input
            id="invoice_id"
            placeholder="Select invoice"
            disabled
            value={watch('invoice_id') || ''}
          />
          {errors.invoice_id && (
            <p className="text-sm text-red-500">{errors.invoice_id.message}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="payment_date">Payment Date</Label>
          <Input id="payment_date" type="date" {...register('payment_date')} />
          {errors.payment_date && (
            <p className="text-sm text-red-500">{errors.payment_date.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="amount_paid">Amount (₹) *</Label>
          <Input
            id="amount_paid"
            type="number"
            step="0.01"
            {...register('amount_paid', { valueAsNumber: true })}
            placeholder="0.00"
          />
          {errors.amount_paid && (
            <p className="text-sm text-red-500">{errors.amount_paid.message}</p>
          )}
          {invoiceAmount && (
            <p className="text-xs text-muted-foreground">
              Invoice Amount: ₹{invoiceAmount.toLocaleString('en-IN')}
            </p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="payment_method">Payment Method</Label>
        <Select value={watch('payment_method')} onValueChange={(value) => setValue('payment_method', value as any)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CASH">Cash</SelectItem>
            <SelectItem value="CHEQUE">Cheque</SelectItem>
            <SelectItem value="NEFT">NEFT</SelectItem>
            <SelectItem value="RTGS">RTGS</SelectItem>
            <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
            <SelectItem value="CREDIT">Credit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="reference_number">Reference Number</Label>
        <Input
          id="reference_number"
          {...register('reference_number')}
          placeholder="Cheque/Transaction number"
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

      <Button type="submit" disabled={isSubmitting || recordPayment.isPending}>
        {isSubmitting ? 'Recording...' : 'Record Payment'}
      </Button>
    </form>
  );
}
