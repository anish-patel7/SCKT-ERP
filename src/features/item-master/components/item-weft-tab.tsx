import { useState } from "react";
import { Copy, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FieldGrid, FormSection, ReferenceSelect, TextField } from "@/components/erp/form-controls";
import { DetailGrid } from "@/components/erp/detail-grid";
import { DecimalField } from "@/components/erp/decimal-field";
import { YarnSelect } from "@/features/masters/components/master-selects";
import { itemOption } from "@/features/masters/components/master-options";
import { getItemMasterService } from "@/features/item-master/services";
import type { ItemTabProps } from "@/features/item-master/hooks/use-item-editor";
import type { ItemSummary, WeftLine } from "@/features/item-master/types/item-master";
import { copyWeftRecipe, emptyWeftLine, weftTotals } from "@/features/item-master/utils/item-model";
import { NumberCell, SummaryValue } from "@/features/item-master/components/item-grid-cells";

// FINAL BUSINESS FORMULA PENDING CONFIRMATION: beam Cost, row Per Pcs Yarn / Per Pcs Rate,
// Pick Rate, Per Pcs Yarn, Job Rate and Net Cost are entered values. Only Total Pick,
// Total Card and Total Per Pcs Yarn are computed (plain sums of the rows).
const PENDING = "Formula pending business confirmation — entered value";

export function ItemWeftTab({
  value,
  update,
  readOnly,
  errors,
  lookups,
  items,
  currentId,
}: ItemTabProps & { items: ItemSummary[]; currentId: string | null }) {
  const w = value.weft;
  const totals = weftTotals(w);
  const [copying, setCopying] = useState(false);
  const recipeSources = items.filter((i) => i.id !== currentId);

  const setLine = <K extends keyof WeftLine>(i: number, key: K, v: WeftLine[K]) =>
    update((d) => {
      const row = d.weft.lines[i];
      if (row) row[key] = v;
    });

  const copyRecipe = async () => {
    if (!w.copyRecipeItemId) return;
    if (w.lines.length && !confirm("Replace the current weft rows with the copied recipe?")) return;
    setCopying(true);
    try {
      const source = await getItemMasterService().getItem(w.copyRecipeItemId);
      if (!source) throw new Error("Item not found");
      const lines = copyWeftRecipe(source.weft);
      update((d) => {
        d.weft.lines = lines;
      });
      toast.success(`Copied ${lines.length} weft row(s) from ${source.code}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not copy the recipe");
    } finally {
      setCopying(false);
    }
  };

  const num = (
    id: string,
    label: string,
    key: "groundPick" | "cut" | "reedSpace" | "addCutPct" | "saleRate" | "otherCost",
    kind: "qty" | "percent" | "rate" | "amount" | "metres",
    hint?: string,
  ) => (
    <DecimalField
      id={id}
      label={label}
      kind={kind}
      value={w[key]}
      onChange={(v) =>
        update((d) => {
          d.weft[key] = v;
        })
      }
      error={errors[`weft.${key}`]}
      {...(hint ? { hint } : {})}
      {...(readOnly ? { readOnly } : {})}
    />
  );

  return (
    <div className="space-y-3">
      <FormSection title="Weft Configuration">
        <FieldGrid cols={4}>
          {num("im-ground-pick", "Ground Pick", "groundPick", "qty")}
          {num("im-cut", "Cut", "cut", "metres")}
          <TextField
            id="im-width-reed"
            label="Width / Reed"
            value={w.widthReed}
            onChange={(v) =>
              update((d) => {
                d.weft.widthReed = v;
              })
            }
            {...(readOnly ? { readOnly } : {})}
          />
          {num("im-reed-space", "Reed Space", "reedSpace", "qty")}
          {num("im-add-cut", "Add Cut %", "addCutPct", "percent", "Rule pending confirmation")}
          {num("im-sale-rate", "Sale Rate", "saleRate", "rate")}
          {num("im-other-cost", "Other Cost", "otherCost", "amount")}
        </FieldGrid>
      </FormSection>

      <FormSection title="Beam" description="Beam used with this weft recipe">
        <FieldGrid cols={4}>
          <YarnSelect
            id="im-beam-product"
            label="Product"
            value={w.beam.productId}
            onChange={(id) =>
              update((d) => {
                d.weft.beam.productId = id;
                const yarn = lookups.yarns.find((y) => y.id === id);
                if (d.weft.beam.denier === null && yarn?.denier != null)
                  d.weft.beam.denier = yarn.denier;
              })
            }
            options={lookups.yarns}
            disabled={readOnly}
          />
          {(
            [
              ["noOfEnds", "No. of Ends", "qty"],
              ["meter", "Meter", "metres"],
              ["denier", "Denier", "qty"],
              ["weightPerPcs", "Weight Per Pcs", "weight"],
              ["rate", "Rate", "rate"],
              ["cost", "Cost", "amount"],
            ] as const
          ).map(([key, label, kind]) => (
            <DecimalField
              key={key}
              id={`im-beam-${key}`}
              label={label}
              kind={kind}
              value={w.beam[key]}
              onChange={(v) =>
                update((d) => {
                  d.weft.beam[key] = v;
                })
              }
              {...(key === "cost" ? { hint: PENDING } : {})}
              {...(readOnly ? { readOnly } : {})}
            />
          ))}
        </FieldGrid>
      </FormSection>

      <FormSection
        title="Weft Detail"
        actions={
          !readOnly && (
            <div className="flex flex-wrap items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* span keeps the tooltip reachable while the button is disabled */}
                    <span tabIndex={0} className="rounded-md">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-xs"
                        disabled
                      >
                        <Copy className="size-3.5" /> Copy Column
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Rule pending confirmation</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                onClick={() =>
                  update((d) => {
                    d.weft.lines.push(emptyWeftLine());
                  })
                }
              >
                <Plus className="size-3.5" /> Add Row
              </Button>
            </div>
          )
        }
      >
        {!readOnly && (
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <ReferenceSelect
              id="im-copy-recipe"
              label="Copy Recipe"
              className="sm:max-w-sm sm:flex-1"
              placeholder="Select an item to copy from…"
              value={w.copyRecipeItemId}
              onChange={(id) =>
                update((d) => {
                  d.weft.copyRecipeItemId = id;
                })
              }
              options={recipeSources.map((i) =>
                itemOption({ id: i.id, code: i.code, name: i.productName }),
              )}
              hint="Copies that item's weft rows into this item"
            />
            <Button
              type="button"
              size="sm"
              className="h-9 gap-1 text-xs sm:mb-[1.1rem]"
              disabled={!w.copyRecipeItemId || copying}
              onClick={() => void copyRecipe()}
            >
              <Copy className="size-3.5" /> Copy Recipe
            </Button>
          </div>
        )}
        <DetailGrid<WeftLine>
          lines={w.lines}
          lineKey={(l) => l.id}
          lineLabel="Weft row"
          emptyText="No weft rows"
          {...(readOnly
            ? {}
            : {
                onRemove: (i: number) =>
                  update((d) => {
                    d.weft.lines.splice(i, 1);
                  }),
              })}
          columns={[
            {
              id: "product",
              header: "Product Name",
              width: 14,
              render: (l, i) => (
                <YarnSelect
                  id={`im-weft-product-${l.id}`}
                  label={`Product for weft row ${i + 1}`}
                  hideLabel
                  value={l.productId}
                  onChange={(id) =>
                    update((d) => {
                      const row = d.weft.lines[i];
                      if (!row) return;
                      row.productId = id;
                      const yarn = lookups.yarns.find((y) => y.id === id);
                      if (row.denier === null && yarn?.denier != null) row.denier = yarn.denier;
                    })
                  }
                  options={lookups.yarns}
                  disabled={readOnly}
                />
              ),
            },
            ...(
              [
                ["pick", "Pick", "qty"],
                ["card", "Card", "qty"],
                ["denier", "Denier", "qty"],
                ["perPcsYarn", "Per Pcs Yarn", "weight"],
                ["rate", "Rate", "rate"],
                ["perPcsRate", "Per Pcs Rate", "amount"],
              ] as const
            ).map(([key, header, kind]) => ({
              id: key,
              header,
              width: 7,
              align: "right" as const,
              render: (l: WeftLine, i: number) => (
                <NumberCell
                  id={`im-weft-${key}-${l.id}`}
                  label={`${header}, weft row ${i + 1}`}
                  kind={kind}
                  value={l[key]}
                  onChange={(v) => setLine(i, key, v)}
                  readOnly={readOnly}
                  error={errors[`weft.lines.${i}.${key}`]}
                />
              ),
            })),
          ]}
        />
      </FormSection>

      <FormSection
        title="Weft Summary"
        description="Totals are plain sums of the rows. Other figures are entered: their formulas are pending business confirmation."
      >
        <div className="space-y-3">
          <TextField
            id="im-weft-bom"
            label="BOM Description"
            multiline
            value={w.bomDescription}
            onChange={(v) =>
              update((d) => {
                d.weft.bomDescription = v;
              })
            }
            {...(readOnly ? { readOnly } : {})}
          />
          <FieldGrid cols={4}>
            <SummaryValue
              label="Total Pick"
              value={totals.totalPick}
              kind="qty"
              note="Sum of rows"
            />
            <SummaryValue
              label="Total Card"
              value={totals.totalCard}
              kind="qty"
              note="Sum of rows"
            />
            <SummaryValue
              label="Total Per Pcs Yarn"
              value={totals.totalPerPcsYarn}
              kind="weight"
              note="Sum of rows"
            />
            {(
              [
                ["pickRate", "Pick Rate", "rate"],
                ["perPcsYarn", "Per Pcs Yarn", "weight"],
                ["jobRate", "Job Rate", "rate"],
                ["netCost", "Net Cost", "amount"],
              ] as const
            ).map(([key, label, kind]) => (
              <DecimalField
                key={key}
                id={`im-weft-sum-${key}`}
                label={label}
                kind={kind}
                value={w[key]}
                onChange={(v) =>
                  update((d) => {
                    d.weft[key] = v;
                  })
                }
                hint={PENDING}
                {...(readOnly ? { readOnly } : {})}
              />
            ))}
          </FieldGrid>
        </div>
      </FormSection>
    </div>
  );
}
