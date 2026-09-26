/**
 * Form state -> canonical service payload for the Yarn and Warehouse master dialogs.
 * The dialogs keep UI-friendly fields (remark, status, pincode); the services and tables use
 * remarks, active and pin_code. Codes are never sent on create: the services generate them.
 */

export interface YarnFormState {
  name: string;
  denier: string;
  rate_per_kg: string;
  remark: string;
  status: string;
}

export interface YarnPayload {
  name: string;
  denier: number | null;
  rate_per_kg: number;
  remarks: string | null;
  active: boolean;
}

export function yarnFormToPayload(form: YarnFormState): YarnPayload {
  return {
    name: form.name.trim(),
    denier: form.denier !== "" ? Number(form.denier) : null,
    rate_per_kg: form.rate_per_kg !== "" ? Number(form.rate_per_kg) : 0,
    remarks: form.remark.trim() || null,
    active: form.status === "Active",
  };
}

export type WarehouseFormState = Record<string, unknown> & {
  warehouse_code?: string | null;
  warehouse_name?: string | null;
  pincode?: string | null;
};

export function warehouseFormToPayload(
  form: WarehouseFormState,
  isEdit: boolean,
): Record<string, unknown> {
  // Drop the UI-only pincode and any stale pin_code carried over from the loaded row.
  const { pincode, pin_code: _stale, ...rest } = form;
  return {
    ...rest,
    pin_code: pincode ?? null,
    warehouse_name: (form.warehouse_name ?? "").trim(),
    warehouse_code: isEdit ? form.warehouse_code : undefined,
  };
}
