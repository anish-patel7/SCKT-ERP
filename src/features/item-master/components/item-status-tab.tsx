import { ChecklistMultiSelect } from "@/components/erp/checklist-multi-select";
import { DateField, FieldGrid, FormSection, ReferenceSelect } from "@/components/erp/form-controls";
import { lookupOption } from "@/features/masters/components/master-options";
import type { ItemTabProps } from "@/features/item-master/hooks/use-item-editor";
import type { ItemStatusConfig } from "@/features/item-master/types/item-master";

export function ItemStatusTab({ value, update, readOnly, errors, lookups }: ItemTabProps) {
  const st = value.status;
  const set = <K extends keyof ItemStatusConfig>(key: K, v: ItemStatusConfig[K]) =>
    update((d) => {
      d.status[key] = v;
    });
  const checklist = (
    title: string,
    key: "allowedCompanyIds" | "allowedDepartmentIds" | "allowedProcessIds",
    list: { id: string; code: string; name: string }[],
  ) => (
    <ChecklistMultiSelect
      title={title}
      options={list.map((o) => ({ id: o.id, label: o.name, detail: o.code }))}
      selected={st[key]}
      onChange={(ids) => set(key, ids)}
      {...(readOnly ? { disabled: true } : {})}
    />
  );

  return (
    <div className="space-y-3">
      <FormSection
        title="Status & Validity"
        description="Leave Upto Date empty for open-ended validity."
      >
        <FieldGrid cols={3}>
          <ReferenceSelect
            id="im-status-product-status"
            label="Product Status"
            required
            value={st.productStatusId}
            onChange={(id) => set("productStatusId", id)}
            options={lookups.productStatuses.map(lookupOption)}
            disabled={readOnly}
            error={errors["status.productStatusId"]}
          />
          <DateField
            id="im-status-valid-from"
            label="Valid From Date"
            required
            value={st.validFrom}
            onChange={(v) => set("validFrom", v)}
            error={errors["status.validFrom"]}
            {...(readOnly ? { readOnly } : {})}
          />
          <DateField
            id="im-status-valid-to"
            label="Upto Date"
            value={st.validTo}
            onChange={(v) => set("validTo", v)}
            error={errors["status.validTo"]}
            hint="Optional"
            {...(readOnly ? { readOnly } : {})}
          />
        </FieldGrid>
      </FormSection>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {checklist("Allowed Company", "allowedCompanyIds", lookups.companies)}
        {checklist("Allowed Department", "allowedDepartmentIds", lookups.departments)}
        {checklist("Allowed Process", "allowedProcessIds", lookups.processes)}
      </div>
    </div>
  );
}
