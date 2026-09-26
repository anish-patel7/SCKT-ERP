import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reservationsService } from '../reservations';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

describe('reservationsService - Atomic Approval & Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call approve_stock_reservation_atomic RPC during reservation approval', async () => {
    const mockReservationId = 'res-1234-uuid';
    const mockApprovedReservation = {
      id: mockReservationId,
      item_id: 'item-5678-uuid',
      qty_reserved: 100,
      approval_status: 'APPROVED',
      approved_by: 'admin@sckt.com',
    };

    (supabase.rpc as any).mockResolvedValueOnce({ data: { success: true }, error: null });

    const singleMock = vi.fn().mockResolvedValueOnce({ data: mockApprovedReservation, error: null });
    const eqMock = vi.fn().mockReturnValue({ single: singleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    const result = await reservationsService.approveReservation(mockReservationId);

    expect(supabase.rpc).toHaveBeenCalledWith('approve_stock_reservation_atomic', {
      p_reservation_id: mockReservationId,
    });
    expect(supabase.from).toHaveBeenCalledWith('stock_reservations');
    expect(result.approval_status).toBe('APPROVED');
  });

  it('should throw an error if approve_stock_reservation_atomic RPC fails', async () => {
    const mockReservationId = 'res-1234-uuid';

    (supabase.rpc as any).mockResolvedValueOnce({
      data: null,
      error: { message: 'Insufficient stock available' },
    });

    await expect(reservationsService.approveReservation(mockReservationId)).rejects.toThrow(
      'Failed to approve reservation: Insufficient stock available'
    );
  });
});
