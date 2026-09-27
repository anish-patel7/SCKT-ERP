import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FieldGrid,
  FormField,
  FormSection,
  ReferenceSelect,
  TextField,
} from "@/components/erp/form-controls";
import { DetailGrid } from "@/components/erp/detail-grid";
import { DecimalField } from "@/components/erp/decimal-field";
import { YarnSelect } from "@/features/masters/components/master-selects";
import { lookupOption } from "@/features/masters/components/master-options";
import type { ItemTabProps } from "@/features/item-master/hooks/use-item-editor";
import type { WarpLine } from "@/features/item-master/types/item-master";
import { emptyWarpLine, warpTotals } from "@/features/item-master/utils/item-model";
import { NumberCell, SummaryValue } from "@/features/item-master/components/item-grid-cells";
import { compareQty } from "@/lib/erp/numbers";
import { formatQty } from "@/lib/erp/formatting";

// FINAL BUSINESS FORMULA PENDING CONFIRMATION: warp Per Pcs Yarn, Net Cost, line Amount,
// Qty (Wt) and Per Mtr Yarn (Wt) are entered values; only Total Ends / Total Qty are summed.
const PENDING = "Formula pending business confirmation — entered value";

export function ItemWarpTab({ value, update, readOnly, errors, lookups }: ItemTabProps) {
  const w = value.warp;
  const totals = warpTotals(w);
  const endsMismatch =
    w.totalBeamEnds !== null &&
    w.lines.length > 0 &&
    compareQty(w.totalBeamEnds, totals.totalEnds) !== 0;

  const setLine = <K extends keyof WarpLine>(i: number, key: K, v: WarpLine[K]) =>
    update((d) => {
      const row = d.warp.lines[i];
      if (row) row[key] = v;
    });

  const move = (i: number, by: -1 | 1) =>
    update((d) => {
      const j = i + by;
      const a = d.warp.lines[i];
      const b = d.warp.lines[j];
      if (!a || !b) return;
      d.warp.lines[i] = b;
      d.warp.lines[j] = a;
    });

  const text = (l: WarpLine, i: number, key: "pattern" | "patternSeq", header: string) => (
    <FormField htmlFor={`im-warp-${key}-${l.id}`} label={`${header}, warp row ${i + 1}`} hideLabel>
      <Input
        id={`im-warp-${key}-${l.id}`}
        value={l[key]}
        readOnly={readOnly}
        onChange={(e) => setLine(i, key, e.target.value)}
        className="h-8 text-xs"
      />
    </FormField>
  );

  return (
    <div className="space-y-3">
      <FormSection title="Warp Configuration">
        <FieldGrid cols={3}>
          <DecimalField
            id="im-warp-length"
            label="Length"
            kind="metres"
            value={w.length}
            onChange={(v) =>
              update((d) => {
                d.warp.length = v;
              })
            }
            {...(readOnly ? { readOnly } : {})}
          />
          <TextField
            id="im-warp-denting"
            label="Denting (Bharan)"
            value={w.denting}
            onChange={(v) =>
              update((d) => {
                d.warp.denting = v;
              })
            }
            {...(readOnly ? { readOnly } : {})}
          />
          <DecimalField
            id="im-warp-total-beam-ends"
            label="Total Beam Ends"
            kind="qty"
            value={w.totalBeamEnds}
            onChange={(v) =>
              update((d) => {
                d.warp.totalBeamEnds = v;
              })
            }
            hint={
              endsMismatch
                ? `Differs from the sum of row ends (${formatQty(totals.totalEnds)})`
                : undefined
            }
            {...(readOnly ? { readOnly } : {})}
          />
        </FieldGrid>
        <div className="mt-3">
          <TextField
            id="im-warp-bom"
            label="BOM Description"
            multiline
            value={w.bomDescription}
            onChange={(v) =>
              update((d) => {
                d.warp.bomDescription = v;
              })
            }
            {...(readOnly ? { readOnly } : {})}
          />
        </div>
      </FormSection>

      <FormSection
        title="Warp Detail"
        description="Row type values are placeholders until the warp type master is confirmed."
        actions={
          !readOnly && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={() =>
                update((d) => {
                  d.warp.lines.push(emptyWarpLine());
                })
              }
            >
              <Plus className="size-3.5" /> Add Row
            </Button>
          )
        }
      >
        <DetailGrid<WarpLine>
          lines={w.lines}
          lineKey={(l) => l.id}
          lineLabel="Warp row"
          emptyText="No warp rows"
          {...(readOnly
            ? {}
            : {
                onRemove: (i: number) =>
                  update((d) => {
                    d.warp.lines.splice(i, 1);
                  }),
              })}
          columns={[
            ...(readOnly
              ? []
              : [
                  {
                    id: "order",
                    header: "Order",
                    width: 4.5,
                    render: (_l: WarpLine, i: number) => (
                      <div className="flex gap-0.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label={`Move warp row ${i + 1} up`}
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label={`Move warp row ${i + 1} down`}
                          disabled={i === w.lines.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                      </div>
                    ),
                  },
                ]),
            {
              id: "type",
              header: "Type",
              width: 9,
              render: (l, i) => (
                <ReferenceSelect
                  id={`im-warp-type-${l.id}`}
                  label={`Type, warp row ${i + 1}`}
                  hideLabel
                  value={l.typeId}
                  onChange={(id) => setLine(i, "typeId", id)}
                  options={lookups.warpTypes.map(lookupOption)}
                  disabled={readOnly}
                />
              ),
            },
            {
              id: "product",
              header: "Product Name",
              width: 13,
              render: (l, i) => (
                <YarnSelect
                  id={`im-warp-product-${l.id}`}
                  label={`Product, warp row ${i + 1}`}
                  hideLabel
                  value={l.productId}
                  onChange={(id) =>
                    update((d) => {
                      const row = d.warp.lines[i];
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
                ["denier", "Denier", "qty"],
                ["ends", "Ends", "qty"],
              ] as const
            ).map(([key, header, kind]) => numberColumn(key, header, kind)),
            {
              id: "pattern",
              header: "Pattern",
              width: 6,
              render: (l, i) => text(l, i, "pattern", "Pattern"),
            },
            {
              id: "patternSeq",
              header: "Pattern Seq",
              width: 6,
              render: (l, i) => text(l, i, "patternSeq", "Pattern Seq"),
            },
            ...(
              [
                ["qtyWt", "Qty (Wt)", "weight"],
                ["perMtrYarnWt", "Per Mtr Yarn (Wt)", "conversion"],
                ["yarnRate", "Yarn Rate", "rate"],
                ["amount", "Amount", "amount"],
              ] as const
            ).map(([key, header, kind]) => numberColumn(key, header, kind)),
          ]}
        />
      </FormSection>

      <FormSection title="Warp Summary" description="Totals are plain sums of the rows.">
        <FieldGrid cols={4}>
          <SummaryValue label="Total Ends" value={totals.totalEnds} kind="qty" note="Sum of rows" />
          <SummaryValue
            label="Total Qty (Wt)"
            value={totals.totalQtyWt}
            kind="weight"
            note="Sum of rows"
          />
          {(
            [
              ["perPcsYarn", "Per Pcs Yarn", "weight"],
              ["netCost", "Net Cost", "amount"],
            ] as const
          ).map(([key, label, kind]) => (
            <DecimalField
              key={key}
              id={`im-warp-sum-${key}`}
              label={label}
              kind={kind}
              value={w[key]}
              onChange={(v) =>
                update((d) => {
                  d.warp[key] = v;
                })
              }
              hint={PENDING}
              {...(readOnly ? { readOnly } : {})}
            />
          ))}
        </FieldGrid>
      </FormSection>
    </div>
  );

  function numberColumn(
    key: "denier" | "ends" | "qtyWt" | "perMtrYarnWt" | "yarnRate" | "amount",
    header: string,
    kind: "qty" | "weight" | "conversion" | "rate" | "amount",
  ) {
    return {
      id: key,
      header,
      width: 7,
      align: "right" as const,
      render: (l: WarpLine, i: number) => (
        <NumberCell
          id={`im-warp-${key}-${l.id}`}
          label={`${header}, warp row ${i + 1}`}
          kind={kind}
          value={l[key]}
          onChange={(v) => setLine(i, key, v)}
          readOnly={readOnly}
          error={errors[`warp.lines.${i}.${key}`]}
        />
      ),
    };
  }
}
