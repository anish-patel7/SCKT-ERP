import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FieldGrid, FormSection, ReferenceSelect } from "@/components/erp/form-controls";
import { DecimalField } from "@/components/erp/decimal-field";
import { lookupOption } from "@/features/masters/components/master-options";
import type { ItemTabProps } from "@/features/item-master/hooks/use-item-editor";
import type { ItemSetup } from "@/features/item-master/types/item-master";
import type { PrecisionKind } from "@/lib/erp/numbers";

type NumericKey =
  | "ratePct"
  | "discountPct"
  | "conversion"
  | "avgWeight"
  | "primaryConversionFactor"
  | "multiplier"
  | "specialDiscountPct";

const CONTROLS = [
  ["manageLotNumber", "Manage Lot Number"],
  ["manageQualityControlled", "Manage Quality Controlled"],
  ["manageContainerControlled", "Manage Container Controlled"],
] as const;

export function ItemSetupTab({ value, update, readOnly, errors, lookups }: ItemTabProps) {
  const s = value.setup;
  const set = <K extends keyof ItemSetup>(key: K, v: ItemSetup[K]) =>
    update((d) => {
      d.setup[key] = v;
    });
  const num = (key: NumericKey, label: string, kind: PrecisionKind) => (
    <DecimalField
      key={key}
      id={`im-setup-${key}`}
      label={label}
      kind={kind}
      value={s[key]}
      onChange={(v) => set(key, v)}
      error={errors[`setup.${key}`]}
      {...(readOnly ? { readOnly } : {})}
    />
  );

  return (
    <div className="space-y-3">
      <FormSection title="Inventory Controls">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {CONTROLS.map(([key, label]) => (
            <div
              key={key}
              className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-border px-3"
            >
              <Label htmlFor={`im-setup-${key}`} className="text-sm">
                {label}
              </Label>
              <Switch
                id={`im-setup-${key}`}
                checked={s[key]}
                onCheckedChange={(c) => set(key, c)}
                disabled={readOnly}
              />
            </div>
          ))}
        </div>
      </FormSection>

      <FormSection
        title="Standard References"
        description="Configuration references only; the BOM relationship is pending the backend design."
      >
        <FieldGrid cols={2}>
          <ReferenceSelect
            id="im-setup-bom-beam"
            label="Standard BOM Beam"
            value={s.standardBomBeamId}
            onChange={(id) => set("standardBomBeamId", id)}
            options={lookups.standardBomBeams.map(lookupOption)}
            disabled={readOnly}
          />
          <ReferenceSelect
            id="im-setup-bom"
            label="Standard Bill Of Material (BoM)"
            value={s.standardBomId}
            onChange={(id) => set("standardBomId", id)}
            options={lookups.standardBoms.map(lookupOption)}
            disabled={readOnly}
          />
        </FieldGrid>
      </FormSection>

      <FormSection title="Pricing">
        <div className="space-y-3">
          <FieldGrid cols={4}>{num("ratePct", "Rate %", "percent")}</FieldGrid>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {s.rates.map((rate, i) => (
              <DecimalField
                key={i}
                id={`im-setup-rate-${i + 1}`}
                label={`Rate ${i + 1}`}
                kind="rate"
                value={rate}
                onChange={(v) =>
                  update((d) => {
                    d.setup.rates[i] = v;
                  })
                }
                {...(readOnly ? { readOnly } : {})}
              />
            ))}
          </div>
        </div>
      </FormSection>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <FormSection title="Conversion">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {num("conversion", "Conversion", "conversion")}
            {num("primaryConversionFactor", "Primary Conversion Factor", "conversion")}
            {num("multiplier", "Multiplier", "conversion")}
          </div>
        </FormSection>
        <FormSection title="Weight">{num("avgWeight", "Avg Weight", "weight")}</FormSection>
        <FormSection title="Discount">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {num("discountPct", "Discount (%)", "percent")}
            {num("specialDiscountPct", "Special Dis (%)", "percent")}
          </div>
        </FormSection>
      </div>
    </div>
  );
}
