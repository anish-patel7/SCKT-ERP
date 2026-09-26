import { useState } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateCustomer, useUpdateCustomer } from '@/hooks/useCustomers';
import { useParties } from '@/hooks/useParties';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CustomerFormSchema = z.object({
  party_id: z.string().uuid('Party is required'),
  credit_limit: z.number().nonnegative('Credit limit must be non-negative'),
  payment_terms_days: z.number().int().positive('Payment terms must be positive'),
  contact_person: z.string().optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  default_shipping_address: z.string().optional(),
});

type CustomerFormData = z.infer<typeof CustomerFormSchema>;

interface CustomerFormProps {
  initialData?: {
    id: string;
    party_id: string;
    credit_limit: number;
    payment_terms_days: number;
    contact_person?: string;
    phone?: string;
    email?: string;
    default_shipping_address?: string;
  };
  onSuccess?: () => void;
}

export function CustomerForm({ initialData, onSuccess }: CustomerFormProps) {
  const { data: parties } = useParties({ is_active: true });
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CustomerFormData>({
    resolver: zodResolver(CustomerFormSchema),
    defaultValues: initialData
      ? {
          party_id: initialData.party_id,
          credit_limit: initialData.credit_limit,
          payment_terms_days: initialData.payment_terms_days,
          contact_person: initialData.contact_person,
          phone: initialData.phone,
          email: initialData.email,
          default_shipping_address: initialData.default_shipping_address,
        }
      : {
          credit_limit: 0,
          payment_terms_days: 30,
        },
  });

  const onSubmit = async (data: CustomerFormData) => {
    try {
      setIsSubmitting(true);
      if (initialData) {
        await updateCustomer.mutateAsync({
          id: initialData.id,
          updates: data,
        });
        toast.success('Customer updated successfully');
      } else {
        await createCustomer.mutateAsync(data);
        toast.success('Customer created successfully');
      }
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="party_id">Party *</Label>
        <Select
          value={watch('party_id')}
          onValueChange={(value) => setValue('party_id', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a party" />
          </SelectTrigger>
          <SelectContent>
            {parties?.map((party) => (
              <SelectItem key={party.id} value={party.id}>
                {party.party_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.party_id && <p className="text-sm text-red-500">{errors.party_id.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="credit_limit">Credit Limit (₹)</Label>
          <Input
            id="credit_limit"
            type="number"
            step="0.01"
            {...register('credit_limit', { valueAsNumber: true })}
          />
          {errors.credit_limit && (
            <p className="text-sm text-red-500">{errors.credit_limit.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="payment_terms_days">Payment Terms (Days)</Label>
          <Input
            id="payment_terms_days"
            type="number"
            {...register('payment_terms_days', { valueAsNumber: true })}
          />
          {errors.payment_terms_days && (
            <p className="text-sm text-red-500">{errors.payment_terms_days.message}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="contact_person">Contact Person</Label>
        <Input id="contact_person" {...register('contact_person')} />
        {errors.contact_person && (
          <p className="text-sm text-red-500">{errors.contact_person.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" {...register('phone')} />
          {errors.phone && <p className="text-sm text-red-500">{errors.phone.message}</p>}
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register('email')} />
          {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
        </div>
      </div>

      <div>
        <Label htmlFor="default_shipping_address">Default Shipping Address</Label>
        <textarea
          id="default_shipping_address"
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          {...register('default_shipping_address')}
        />
        {errors.default_shipping_address && (
          <p className="text-sm text-red-500">{errors.default_shipping_address.message}</p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting || createCustomer.isPending || updateCustomer.isPending}>
        {isSubmitting ? 'Saving...' : initialData ? 'Update Customer' : 'Create Customer'}
      </Button>
    </form>
  );
}
