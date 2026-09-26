import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersService, type Customer, type CustomerInput } from '@/services/customers';
import { useParties } from '@/hooks/useParties';

export function useCustomers(filters?: { is_active?: boolean }) {
  return useQuery({
    queryKey: ['customers', filters],
    queryFn: () => customersService.list(filters),
    staleTime: 5 * 60 * 1000,
  });
}

export interface CustomerOption {
  id: string;
  name: string;
  code: string;
  /** Default delivery address: the customer's, else the party's postal address. */
  address: string;
}

/**
 * Customers with their display name. A customer's name lives on its linked party
 * (customers.party_id -> parties), so sales documents must look names up here, not in parties
 * by customer_id.
 */
export function useCustomerOptions(filters?: { is_active?: boolean }) {
  const customers = useCustomers(filters);
  const parties = useParties(true);
  const options = useMemo<CustomerOption[]>(() => {
    const byParty = new Map((parties.data ?? []).map((p) => [p.id, p]));
    return (customers.data ?? []).map((c) => {
      const party = c.party_id ? byParty.get(c.party_id) : undefined;
      const partyAddress = party
        ? [party.address_line1, party.address_line2, party.area, party.city, party.state, party.pin_code]
            .filter((part): part is string => Boolean(part && part.trim()))
            .join(', ')
        : '';
      return {
        id: c.id,
        name: party?.party_name ?? '—',
        code: party?.party_code ?? '',
        address: c.default_shipping_address?.trim() || partyAddress,
      };
    });
  }, [customers.data, parties.data]);
  const nameById = useMemo(() => new Map(options.map((o) => [o.id, o.name])), [options]);
  return { options, nameById, isLoading: customers.isLoading || parties.isLoading };
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersService.getById(id),
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  });
}

export function useCustomerByPartyId(partyId: string) {
  return useQuery({
    queryKey: ['customer_by_party', partyId],
    queryFn: () => customersService.getByPartyId(partyId),
    staleTime: 5 * 60 * 1000,
    enabled: !!partyId,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CustomerInput) => customersService.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CustomerInput> }) =>
      customersService.update(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.setQueryData(['customer', data.id], data);
    },
  });
}

export function useDeactivateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => customersService.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useCreditSummary(customerId: string) {
  return useQuery({
    queryKey: ['credit_summary', customerId],
    queryFn: () => customersService.getCreditSummary(customerId),
    staleTime: 2 * 60 * 1000,
    enabled: !!customerId,
  });
}

export function useValidateCreditAvailable(customerId: string, orderAmount: number) {
  return useQuery({
    queryKey: ['validate_credit', customerId, orderAmount],
    queryFn: () => customersService.validateCreditAvailable(customerId, orderAmount),
    staleTime: 1 * 60 * 1000,
    enabled: !!customerId && orderAmount > 0,
  });
}
