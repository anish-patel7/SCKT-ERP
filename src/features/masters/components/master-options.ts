import type { ReferenceOption } from "@/components/erp/form-controls";

/** Option mappers shared by the master selectors and by pages that render master lists. */
export type MasterOption = { id: string; code: string; name: string };

export const itemOption = (i: MasterOption): ReferenceOption => ({
  id: i.id,
  label: `${i.code} — ${i.name}`,
});

export const yarnOption = (y: MasterOption & { denier?: number | null }): ReferenceOption => ({
  id: y.id,
  label: y.name,
  detail: y.code,
  ...(y.denier != null ? { meta: `${y.denier} D` } : {}),
});

export const uomOption = (u: MasterOption): ReferenceOption => ({
  id: u.id,
  label: u.code,
  detail: u.name,
});

/** Generic lookup (category, brand, status, …): name with the code as secondary text. */
export const lookupOption = (o: MasterOption): ReferenceOption => ({
  id: o.id,
  label: o.name,
  detail: o.code,
});
