import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DateField,
  FieldGrid,
  FormField,
  FormSection,
  ReferenceSelect,
  TextField,
} from "@/components/erp/form-controls";
import { DetailGrid } from "@/components/erp/detail-grid";
import { DecimalField } from "@/components/erp/decimal-field";
import { lookupOption } from "@/features/masters/components/master-options";
import { UomSelect } from "@/features/masters/components/master-selects";
import type { ItemTabProps } from "@/features/item-master/hooks/use-item-editor";
import type { PartyAlias } from "@/features/item-master/types/item-master";
import { newRowId } from "@/features/item-master/utils/item-model";

export function ItemBasicTab({ value, update, readOnly, errors, lookups }: ItemTabProps) {
  const b = value.basic;
  const subGroups = lookups.subGroups.filter((s) => !b.groupId || s.groupId === b.groupId);
  const sel = (list: { id: string; code: string; name: string }[]) => list.map(lookupOption);
  const set = <K extends keyof typeof b>(key: K, v: (typeof b)[K]) =>
    update((d) => {
      d.basic[key] = v;
    });

  return (
    <div className="space-y-3">
      <FormSection title="Product">
        <FieldGrid cols={2}>
          <ReferenceSelect
            id="im-product-type"
            label="Product Type"
            required
            value={b.productTypeId}
            onChange={(id) => set("productTypeId", id)}
            options={sel(lookups.productTypes)}
            disabled={readOnly}
            error={errors["basic.productTypeId"]}
          />
          <TextField
            id="im-product-name"
            label="Product Name"
            required
            value={b.productName}
            onChange={(v) => set("productName", v)}
            error={errors["basic.productName"]}
            {...(readOnly ? { readOnly } : {})}
          />
        </FieldGrid>
      </FormSection>

      <FormSection title="Classification">
        <FieldGrid cols={3}>
          <ReferenceSelect
            id="im-category"
            label="Category"
            value={b.categoryId}
            onChange={(id) => set("categoryId", id)}
            options={sel(lookups.categories)}
            disabled={readOnly}
          />
          <ReferenceSelect
            id="im-group"
            label="Group Name"
            value={b.groupId}
            onChange={(id) =>
              update((d) => {
                d.basic.groupId = id;
                const sg = lookups.subGroups.find((s) => s.id === d.basic.subGroupId);
                if (sg && sg.groupId !== id) d.basic.subGroupId = "";
              })
            }
            options={sel(lookups.groups)}
            disabled={readOnly}
          />
          <ReferenceSelect
            id="im-sub-group"
            label="Sub Group Name"
            value={b.subGroupId}
            onChange={(id) => set("subGroupId", id)}
            options={sel(subGroups)}
            disabled={readOnly}
            hint={b.groupId ? undefined : "Choose a group to narrow the list"}
          />
          <ReferenceSelect
            id="im-brand"
            label="Brand Name"
            value={b.brandId}
            onChange={(id) => set("brandId", id)}
            options={sel(lookups.brands)}
            disabled={readOnly}
          />
          <ReferenceSelect
            id="im-shade"
            label="Shade"
            value={b.shadeId}
            onChange={(id) => set("shadeId", id)}
            options={sel(lookups.shades)}
            disabled={readOnly}
          />
          <ReferenceSelect
            id="im-design-group"
            label="Design Group"
            value={b.designGroupId}
            onChange={(id) => set("designGroupId", id)}
            options={sel(lookups.designGroups)}
            disabled={readOnly}
          />
        </FieldGrid>
      </FormSection>

      <FormSection title="Description">
        <FieldGrid cols={2}>
          <TextField
            id="im-short-desc"
            label="Short Description"
            value={b.shortDescription}
            onChange={(v) => set("shortDescription", v)}
            {...(readOnly ? { readOnly } : {})}
          />
          <TextField
            id="im-remark"
            label="Item Remark"
            value={b.itemRemark}
            onChange={(v) => set("itemRemark", v)}
            {...(readOnly ? { readOnly } : {})}
          />
          <TextField
            id="im-work-cut"
            label="Work Cut"
            value={b.workCut}
            onChange={(v) => set("workCut", v)}
            {...(readOnly ? { readOnly } : {})}
          />
          <DateField
            id="im-create-date"
            label="Create Date"
            required
            value={b.createDate}
            onChange={(v) => set("createDate", v)}
            error={errors["basic.createDate"]}
            {...(readOnly ? { readOnly } : {})}
          />
          <TextField
            id="im-menu"
            label="Menu"
            value={b.menu}
            onChange={(v) => set("menu", v)}
            {...(readOnly ? { readOnly } : {})}
          />
          <div className="flex min-h-9 items-end gap-2 pb-1.5">
            <Switch
              id="im-is-service"
              checked={b.isService}
              onCheckedChange={(c) => set("isService", c)}
              disabled={readOnly}
            />
            <Label htmlFor="im-is-service" className="text-sm">
              Is Service
            </Label>
          </div>
        </FieldGrid>
      </FormSection>

      <FormSection title="Units & Tax">
        <FieldGrid cols={3}>
          <UomSelect
            id="im-primary-unit"
            label="Primary Unit"
            value={b.primaryUnitId}
            onChange={(id) => set("primaryUnitId", id)}
            options={lookups.uoms}
            disabled={readOnly}
          />
          <UomSelect
            id="im-secondary-unit"
            label="Secondary Unit"
            value={b.secondaryUnitId}
            onChange={(id) => set("secondaryUnitId", id)}
            options={lookups.uoms}
            disabled={readOnly}
          />
          <TextField
            id="im-hsn"
            label="HSN / SAC Code"
            value={b.hsnSac}
            onChange={(v) => set("hsnSac", v)}
            {...(readOnly ? { readOnly } : {})}
          />
          {(["tax1Pct", "tax2Pct", "tax3Pct"] as const).map((key, i) => (
            <DecimalField
              key={key}
              id={`im-${key}`}
              label={`Tax ${i + 1} (%)`}
              kind="percent"
              value={b[key]}
              onChange={(v) => set(key, v)}
              error={errors[`basic.${key}`]}
              {...(readOnly ? { readOnly } : {})}
            />
          ))}
        </FieldGrid>
      </FormSection>

      <FormSection
        title="Party / Synonyms"
        description="Customer-specific names for this item"
        actions={
          !readOnly && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={() =>
                update((d) => {
                  d.partyAliases.push({ id: newRowId("alias"), partyId: "", synonym: "" });
                })
              }
            >
              <Plus className="size-3.5" /> Add Alias
            </Button>
          )
        }
      >
        <DetailGrid<PartyAlias>
          lines={value.partyAliases}
          lineKey={(l) => l.id}
          lineLabel="Alias"
          emptyText="No party synonyms"
          {...(readOnly
            ? {}
            : {
                onRemove: (i: number) =>
                  update((d) => {
                    d.partyAliases.splice(i, 1);
                  }),
              })}
          columns={[
            {
              id: "party",
              header: "Party Name",
              width: 16,
              render: (l, i) => (
                <ReferenceSelect
                  id={`im-alias-party-${l.id}`}
                  label={`Party for alias ${i + 1}`}
                  hideLabel
                  value={l.partyId}
                  onChange={(id) =>
                    update((d) => {
                      const row = d.partyAliases[i];
                      if (row) row.partyId = id;
                    })
                  }
                  options={sel(lookups.parties)}
                  disabled={readOnly}
                  error={errors[`partyAliases.${i}.partyId`]}
                />
              ),
            },
            {
              id: "synonym",
              header: "Synonym / Party Item Name",
              width: 18,
              render: (l, i) => (
                <FormField
                  htmlFor={`im-alias-syn-${l.id}`}
                  label={`Synonym for alias ${i + 1}`}
                  hideLabel
                  error={errors[`partyAliases.${i}.synonym`]}
                >
                  <Input
                    id={`im-alias-syn-${l.id}`}
                    value={l.synonym}
                    readOnly={readOnly}
                    aria-invalid={!!errors[`partyAliases.${i}.synonym`]}
                    onChange={(e) =>
                      update((d) => {
                        const row = d.partyAliases[i];
                        if (row) row.synonym = e.target.value;
                      })
                    }
                    className="h-9"
                  />
                </FormField>
              ),
            },
          ]}
        />
      </FormSection>
    </div>
  );
}
