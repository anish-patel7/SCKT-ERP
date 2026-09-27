import { toast } from "sonner";
import { sumQty } from "@/lib/erp/numbers";

/** Loom row as returned by the existing loomService.listLooms(). */
export type LiveLoom = {
  id: string;
  loom_no: string;
  loom_type: string | null;
  panna_inch: number | null;
  status: string | null;
  current_job_card_id: string | null;
  remarks: string | null;
};

/** Job card row as returned by the existing productionService.getAllJobCards(). */
export type LiveJobCard = {
  id: string;
  card_no: string;
  status: string | null;
  qty_metre: number | null;
  loom_id: string | null;
  production_orders?: { order_no: string | null } | null;
  daily_production?: { metre_produced: number | null }[] | null;
  production_order_id?: string | null;
  party_id?: string | null;
  sub_party_id?: string | null;
  issued_date?: string | null;
};

export const INACTIVE_STATUS = "DECOMMISSIONED";
export const wovenMetres = (card: LiveJobCard) =>
  sumQty((card.daily_production ?? []).map((d) => d.metre_produced ?? 0));

export function toastError(action: string) {
  return (error: unknown) => {
    console.error(`${action} error:`, error);
    toast.error(error instanceof Error ? error.message : `Failed to ${action.toLowerCase()}`);
  };
}
