import { useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { useProductionMode } from "@/features/production/hooks/use-production";
import type { ReferenceOption } from "@/components/erp/form-controls";
import { defaultRange } from "@/lib/erp/formatting";
import type { DateRange, MasterOption, Party } from "@/features/production/types/production";
import { formatNumber } from "@/lib/erp/formatting";
import { parseDecimal, type PrecisionKind } from "@/lib/erp/numbers";

/** Existing catalog permission for creating production documents (no new codes). */
export const PRODUCTION_CREATE_PERMISSION = "production:create";

/** Add New is shown only with production:create and a working service (demo mode). */
export function useCanEnterProduction(): boolean {
  const { can } = usePermissions();
  const mode = useProductionMode();
  return can(PRODUCTION_CREATE_PERMISSION) && mode === "demo";
}

export function useRegisterRange(days = 30): [DateRange, (r: DateRange) => void] {
  return useState<DateRange>(() => defaultRange(days));
}

export function masterOptions(list: MasterOption[] | undefined): ReferenceOption[] {
  return (list ?? []).map((m) => ({
    id: m.id,
    label: m.name,
    ...(m.code !== m.name ? { detail: m.code } : {}),
  }));
}

export function partyOptions(parties: Party[] | undefined, kind: Party["kind"]): ReferenceOption[] {
  return masterOptions((parties ?? []).filter((p) => p.kind === kind));
}

/** Form text → number (invalid or empty → NaN, which the service rejects). */
export const num = (text: string): number => parseDecimal(text);

/** Number → form text (NaN / non-finite → empty). */
export const text = (value: number): string => (Number.isFinite(value) ? String(value) : "");

/** Formatted preview of a form value, or "—" while the input is not a number. */
export function preview(textValue: string, kind: PrecisionKind): string {
  const n = parseDecimal(textValue);
  return Number.isFinite(n) ? formatNumber(n, kind) : "—";
}
