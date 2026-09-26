import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TYPES & VALIDATION
// ============================================================================

export const CustomerSchema = z.object({
  party_id: z.string().uuid('Party ID must be a valid UUID'),
  credit_limit: z.number().nonnegative('Credit limit must be non-negative').default(0),
  payment_terms_days: z.number().int().positive('Payment terms must be positive').default(30),
  default_shipping_address: z.string().optional(),
  contact_person: z.string().max(150).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  is_active: z.boolean().default(true),
});

export type CustomerInput = z.infer<typeof CustomerSchema>;

export interface Customer extends CustomerInput {
  id: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  current_credit_used: number;
}

// ============================================================================
// SERVICE
// ============================================================================

export const customersService = {
  async list(filters?: { is_active?: boolean }): Promise<Customer[]> {
    let query = supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to fetch customers: ${error.message}`);
    }

    return data || [];
  },

  async getById(id: string): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Customer not found: ${id}`);
    }

    return data as Customer;
  },

  async getByPartyId(party_id: string): Promise<Customer | null> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('party_id', party_id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Database error:', error);
      throw new Error(`Failed to fetch customer by party: ${error.message}`);
    }

    return (data as Customer) || null;
  },

  async create(input: unknown): Promise<Customer> {
    const validated = CustomerSchema.parse(input);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('customers')
      .insert([
        {
          ...validated,
          created_by: user?.email || 'system',
          updated_by: user?.email || 'system',
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Customer already exists for this party');
      }
      console.error('Database error:', error);
      throw new Error(`Failed to create customer: ${error.message}`);
    }

    return data as Customer;
  },

  async update(id: string, updates: unknown): Promise<Customer> {
    const partial = CustomerSchema.partial().parse(updates);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('customers')
      .update({
        ...partial,
        updated_by: user?.email || 'system',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to update customer: ${error.message}`);
    }

    return data as Customer;
  },

  async updateCreditUsed(customer_id: string, amount_change: number): Promise<void> {
    const { error } = await supabase.rpc('update_customer_credit_used', {
      p_customer_id: customer_id,
      p_amount_change: amount_change,
    });

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to update credit used: ${error.message}`);
    }
  },

  async getCreditSummary(customer_id: string): Promise<{
    credit_limit: number;
    current_credit_used: number;
    available_credit: number;
  }> {
    const customer = await this.getById(customer_id);

    return {
      credit_limit: customer.credit_limit,
      current_credit_used: customer.current_credit_used,
      available_credit: customer.credit_limit - customer.current_credit_used,
    };
  },

  async validateCreditAvailable(customer_id: string, order_amount: number): Promise<boolean> {
    const summary = await this.getCreditSummary(customer_id);
    return summary.available_credit >= order_amount;
  },

  async deactivate(id: string): Promise<void> {
    const { error } = await supabase
      .from('customers')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to deactivate customer: ${error.message}`);
    }
  },
};
