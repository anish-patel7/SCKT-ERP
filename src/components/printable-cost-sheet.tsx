import { Printer, ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { computeCostSheet, fmt, fmtCurr, lineCost, lineKg } from "@/lib/costing";
import type { CostSheetFull } from "@/lib/cost-sheet-store";

interface PrintableCostSheetProps {
  sheet: CostSheetFull;
  onBack?: () => void;
}

export function PrintableCostSheet({ sheet, onBack }: PrintableCostSheetProps) {
  const { header, lines, charges } = sheet;

  const totals = computeCostSheet({
    lines,
    charges,
    wastage_pct: header.wastage_pct,
    card_rate: header.card_rate,
    number_of_cards: header.number_of_cards,
    kg_divisor: header.kg_divisor,
    card_divisor: header.card_divisor,
    markup_pct: header.markup_pct,
    manual_sale_rate: header.manual_sale_rate,
  });

  const warpLines = lines.filter((l) => l.section === "warp" && (l.yarn_name || l.quantity > 0));
  const weftLines = lines.filter((l) => l.section === "weft" && (l.yarn_name || l.quantity > 0));

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar (hidden when printing) */}
      <div className="flex items-center justify-between border-b border-border pb-3 print:hidden">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack} className="gap-1 text-xs">
              <ArrowLeft className="size-3.5" /> Back
            </Button>
          )}
          <h2 className="text-base font-semibold">Printable Cost Sheet — {header.sheet_no}</h2>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handlePrint} className="gap-1 text-xs">
            <Printer className="size-3.5" /> Print / Save as PDF
          </Button>
        </div>
      </div>

      {/* Printable Sheet A4 Container */}
      <div className="mx-auto max-w-[800px] rounded-lg border border-border bg-card p-6 shadow-md print:max-w-none print:border-none print:bg-white print:p-0 print:shadow-none text-foreground text-xs font-sans">
        {/* Company & Document Header */}
        <div className="flex items-start justify-between border-b-2 border-primary pb-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded bg-primary text-sm font-bold text-primary-foreground print:bg-black print:text-white">
              SCKT
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">SCKT ERP</h1>
              <p className="text-[0.6875rem] text-muted-foreground">
                Shree Chehar Krupa Textile · Fabric Costing & Operational System
              </p>
            </div>
          </div>

          <div className="text-right">
            <h2 className="text-base font-bold uppercase tracking-wider text-primary">
              FABRIC COST SHEET
            </h2>
            <p className="font-mono text-sm font-semibold">{header.sheet_no}</p>
            <Badge variant="outline" className="mt-1 text-[0.625rem] font-medium uppercase">
              {header.status} · v{header.version}
            </Badge>
          </div>
        </div>

        {/* Header Information Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-md bg-muted/40 p-3 text-xs border border-border print:bg-gray-50">
          <div>
            <span className="text-muted-foreground block text-[0.6875rem]">Design Number:</span>
            <span className="font-mono font-bold text-primary text-sm">
              {header.design_no || "—"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[0.6875rem]">Customer / Party:</span>
            <span className="font-semibold text-foreground">{header.party_name || "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[0.6875rem]">
              Quality / Description:
            </span>
            <span className="font-medium text-foreground">{header.quality || "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[0.6875rem]">
              Costing Date / Unit:
            </span>
            <span className="font-medium text-foreground">
              {header.costing_date || "Today"} ({header.unit_basis || "per metre"})
            </span>
          </div>
          <div className="col-span-2 flex flex-wrap gap-4 text-[0.6875rem] pt-1 border-t border-border/50">
            <span>
              Reed: <strong className="font-mono">{header.reed || "—"}</strong>
            </span>
            <span>
              Pick: <strong className="font-mono">{header.pick || "—"}</strong>
            </span>
            <span>
              Panna (Width): <strong className="font-mono">{header.panna_inch || "—"}"</strong>
            </span>
            <span>
              Length: <strong className="font-mono">{header.length_metre || "—"} m</strong>
            </span>
            <span>
              Cards: <strong className="font-mono">{header.number_of_cards || "—"}</strong>
            </span>
          </div>
        </div>

        {/* Warp Table */}
        <div className="mt-4 space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b pb-1">
            WARP BREAKDOWN
          </h3>
          <table className="w-full text-left text-xs border-collapse border border-border">
            <thead className="bg-muted/70 font-semibold text-muted-foreground print:bg-gray-100">
              <tr className="border-b border-border">
                <th className="p-1.5 w-16">Label</th>
                <th className="p-1.5">Yarn Name</th>
                <th className="p-1.5 text-right">Ends</th>
                <th className="p-1.5 text-right">Denier</th>
                <th className="p-1.5 text-right">Length (m)</th>
                <th className="p-1.5 text-right">Rate / kg</th>
                <th className="p-1.5 text-right">Warp KG</th>
                <th className="p-1.5 text-right">Cost (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {warpLines.map((l) => (
                <tr key={l.id}>
                  <td className="p-1.5 font-semibold text-muted-foreground">{l.label}</td>
                  <td className="p-1.5 font-medium">{l.yarn_name || "—"}</td>
                  <td className="p-1.5 text-right font-mono">{l.quantity}</td>
                  <td className="p-1.5 text-right font-mono">{l.denier}</td>
                  <td className="p-1.5 text-right font-mono">{l.length_metre}</td>
                  <td className="p-1.5 text-right font-mono">{fmt(l.rate_per_kg, 2)}</td>
                  <td className="p-1.5 text-right font-mono">
                    {fmt(lineKg(l, header.kg_divisor), 4)}
                  </td>
                  <td className="p-1.5 text-right font-mono font-semibold">
                    {fmt(lineCost(l, header.kg_divisor), 2)}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/40 font-bold border-t-2 border-border print:bg-gray-50">
                <td colSpan={2} className="p-1.5">
                  TOTAL WARP
                </td>
                <td className="p-1.5 text-right font-mono">{fmt(totals.totalWarpEnds, 0)}</td>
                <td colSpan={3}></td>
                <td className="p-1.5 text-right font-mono">{fmt(totals.warpKg, 4)}</td>
                <td className="p-1.5 text-right font-mono text-primary">
                  ₹{fmt(totals.warpCost, 2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Weft Table */}
        <div className="mt-4 space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b pb-1">
            WEFT BREAKDOWN
          </h3>
          <table className="w-full text-left text-xs border-collapse border border-border">
            <thead className="bg-muted/70 font-semibold text-muted-foreground print:bg-gray-100">
              <tr className="border-b border-border">
                <th className="p-1.5 w-16">Label</th>
                <th className="p-1.5">Yarn Name</th>
                <th className="p-1.5 text-right">Picks/in</th>
                <th className="p-1.5 text-right">Denier</th>
                <th className="p-1.5 text-right">Length (m)</th>
                <th className="p-1.5 text-right">Panna (in)</th>
                <th className="p-1.5 text-right">Rate / kg</th>
                <th className="p-1.5 text-right">Weft KG</th>
                <th className="p-1.5 text-right">Cost (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {weftLines.map((l) => (
                <tr key={l.id}>
                  <td className="p-1.5 font-semibold text-muted-foreground">{l.label}</td>
                  <td className="p-1.5 font-medium">{l.yarn_name || "—"}</td>
                  <td className="p-1.5 text-right font-mono">{l.quantity}</td>
                  <td className="p-1.5 text-right font-mono">{l.denier}</td>
                  <td className="p-1.5 text-right font-mono">{l.length_metre}</td>
                  <td className="p-1.5 text-right font-mono">{l.panna_inch}</td>
                  <td className="p-1.5 text-right font-mono">{fmt(l.rate_per_kg, 2)}</td>
                  <td className="p-1.5 text-right font-mono">
                    {fmt(lineKg(l, header.kg_divisor), 4)}
                  </td>
                  <td className="p-1.5 text-right font-mono font-semibold">
                    {fmt(lineCost(l, header.kg_divisor), 2)}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/40 font-bold border-t-2 border-border print:bg-gray-50">
                <td colSpan={2} className="p-1.5">
                  TOTAL WEFT
                </td>
                <td className="p-1.5 text-right font-mono">{fmt(totals.totalWeftPicks, 2)}</td>
                <td colSpan={4}></td>
                <td className="p-1.5 text-right font-mono">{fmt(totals.weftKg, 4)}</td>
                <td className="p-1.5 text-right font-mono text-primary">
                  ₹{fmt(totals.weftCost, 2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Cost Calculations & Summary Grid */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          {/* Left Column: Wastage & Process Charges */}
          <div className="space-y-3">
            <div className="rounded-md border border-border p-3 space-y-1.5">
              <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                Process Charges
              </h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-1">Charge Name</th>
                    <th className="text-right py-1">Rate</th>
                    <th className="text-right py-1">Qty/Cut</th>
                    <th className="text-right py-1">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {charges.map((c) => (
                    <tr key={c.id}>
                      <td className="py-1 font-medium">{c.charge_name}</td>
                      <td className="py-1 text-right font-mono">{fmt(c.rate, 2)}</td>
                      <td className="py-1 text-right font-mono">{c.quantity}</td>
                      <td className="py-1 text-right font-mono font-semibold">
                        ₹{fmt(c.rate * c.quantity, 2)}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-bold border-t border-border">
                    <td colSpan={3} className="py-1">
                      Total Process Cost
                    </td>
                    <td className="py-1 text-right font-mono text-primary">
                      ₹{fmt(totals.processCost, 2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rounded-md border border-border p-3 space-y-1">
              <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                Card Costing Calculation
              </h4>
              <div className="flex justify-between text-xs font-mono">
                <span>
                  Formula: ({header.number_of_cards} Cards × ₹{header.card_rate}) / 39.37
                </span>
              </div>
              <div className="flex justify-between text-xs font-bold pt-1 border-t border-border">
                <span>Card Cost:</span>
                <span className="font-mono text-primary">₹{fmt(totals.cardCost, 2)}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Final Summary Breakdown */}
          <div className="rounded-md border-2 border-primary/40 bg-muted/20 p-4 space-y-2 text-xs">
            <h4 className="font-bold text-sm text-primary uppercase tracking-wider border-b border-border pb-1">
              COSTING RECAP
            </h4>
            <div className="flex justify-between">
              <span>Warp Total Cost:</span>
              <span className="font-mono font-medium">₹{fmt(totals.warpCost, 2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Weft Total Cost:</span>
              <span className="font-mono font-medium">₹{fmt(totals.weftCost, 2)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t border-border/60 pt-1">
              <span>Base Fabric Material Cost:</span>
              <span className="font-mono">₹{fmt(totals.baseMaterialCost, 2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Wastage ({header.wastage_pct}%):</span>
              <span className="font-mono">₹{fmt(totals.wastageCost, 2)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t border-border/60 pt-1">
              <span>Material Cost With Wastage:</span>
              <span className="font-mono">₹{fmt(totals.materialWithWastage, 2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Additional Process Cost:</span>
              <span className="font-mono">₹{fmt(totals.processCost, 2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Card Cost:</span>
              <span className="font-mono">₹{fmt(totals.cardCost, 2)}</span>
            </div>

            {/* Final Sale Rate Box */}
            <div className="mt-3 rounded-md bg-primary p-3 text-primary-foreground print:bg-black print:text-white">
              <div className="flex justify-between items-center">
                <div>
                  <span className="block text-[0.6875rem] uppercase font-bold tracking-wider opacity-90">
                    FINAL SELLING RATE / COST ({header.unit_basis || "per metre"})
                  </span>
                  <span className="text-[0.625rem] opacity-75">
                    Arithmetic matching workbook exactly
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-extrabold font-mono">
                    {fmtCurr(totals.saleRate)}
                  </span>
                  <span className="block text-[0.6875rem] font-mono opacity-80">
                    (~ ₹{Math.round(totals.saleRate)})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Approval Signatures Footer */}
        <div className="mt-8 grid grid-cols-3 gap-8 pt-8 border-t border-border text-center text-[0.6875rem] text-muted-foreground">
          <div>
            <div className="h-10 border-b border-dashed border-border"></div>
            <p className="mt-1 font-semibold text-foreground">Prepared By</p>
            <p>{header.prepared_by || "Costing User"}</p>
          </div>
          <div>
            <div className="h-10 border-b border-dashed border-border"></div>
            <p className="mt-1 font-semibold text-foreground">Checked By</p>
            <p>Quality Inspector</p>
          </div>
          <div>
            <div className="h-10 border-b border-dashed border-border"></div>
            <p className="mt-1 font-semibold text-foreground">Authorized Signature</p>
            <p>SCKT Management</p>
          </div>
        </div>
      </div>
    </div>
  );
}
