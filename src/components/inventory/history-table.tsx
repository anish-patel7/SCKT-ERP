import { useMemo } from "react";
import { Download, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTransactionHistory } from "@/hooks/useInventoryLedger";
import type { InventoryTransaction } from "@/services/inventory";

/**
 * HistoryTable: Display immutable transaction ledger
 * - Shows all transactions for an item
 * - Color-coded movement types
 * - Export functionality
 */

export interface HistoryTableProps {
  itemId?: string;
  limit?: number;
}

const MOVEMENT_TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  inward_purchase: {
    bg: "bg-green-100",
    text: "text-green-800",
    label: "Inward Purchase",
  },
  inward_production_return: {
    bg: "bg-green-100",
    text: "text-green-800",
    label: "Return from Production",
  },
  issue_to_production: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    label: "Issue to Production",
  },
  issue_internal: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    label: "Internal Issue",
  },
  location_transfer: {
    bg: "bg-gray-100",
    text: "text-gray-800",
    label: "Location Transfer",
  },
  quality_rejection: {
    bg: "bg-red-100",
    text: "text-red-800",
    label: "Quality Rejection",
  },
  dispatch: {
    bg: "bg-purple-100",
    text: "text-purple-800",
    label: "Dispatch",
  },
};

export function HistoryTable({ itemId, limit = 50 }: HistoryTableProps) {
  const { data: transactions = [], isLoading, error } = useTransactionHistory(itemId, limit);

  // Calculate running balance
  const transactionsWithBalance = useMemo(() => {
    let balance = 0;
    return transactions.map((tx) => {
      balance += tx.qty_change;
      return { ...tx, balance };
    });
  }, [transactions]);

  const handleExport = () => {
    if (!itemId) return;

    // Generate CSV
    const headers = ["Date", "Type", "Reference", "Qty", "Balance", "Rate", "Cost", "User"];
    const rows = transactionsWithBalance.map((tx) => [
      new Date(tx.transaction_date).toLocaleDateString(),
      MOVEMENT_TYPE_COLORS[tx.movement_type]?.label || tx.movement_type,
      tx.reference_doc || "-",
      tx.qty_change.toFixed(2),
      tx.balance.toFixed(2),
      tx.rate_per_unit?.toFixed(2) || "-",
      tx.cost_value.toFixed(2),
      tx.created_by || "System",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");

    // Download
    const element = document.createElement("a");
    element.setAttribute("href", `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`);
    element.setAttribute(
      "download",
      `inventory-history-${itemId}-${new Date().toISOString().split("T")[0]}.csv`,
    );
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (!itemId) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        Select an item to view transaction history
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-12 text-red-600">
        Failed to load transaction history
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        No transactions recorded yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{transactions.length} transactions</p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={transactions.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead className="w-24">Date</TableHead>
              <TableHead className="w-32">Type</TableHead>
              <TableHead className="w-24">Reference</TableHead>
              <TableHead className="text-right w-20">Qty</TableHead>
              <TableHead className="text-right w-20">Balance</TableHead>
              <TableHead className="text-right w-20">Rate</TableHead>
              <TableHead className="text-right w-24">Cost</TableHead>
              <TableHead className="w-24">User</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactionsWithBalance.map((tx) => {
              const typeColors = MOVEMENT_TYPE_COLORS[tx.movement_type] || {
                bg: "bg-gray-100",
                text: "text-gray-800",
                label: tx.movement_type,
              };

              const isInbound = tx.qty_change > 0;
              const isOutbound = tx.qty_change < 0;

              return (
                <TableRow key={tx.id} className="hover:bg-muted/50">
                  <TableCell className="text-sm">
                    {new Date(tx.transaction_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`${typeColors.bg} ${typeColors.text}`}>
                      {typeColors.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {tx.reference_doc || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={isInbound ? "text-green-600 font-semibold" : isOutbound ? "text-red-600 font-semibold" : ""}>
                      {isInbound ? "+" : ""}{tx.qty_change.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {tx.balance.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {tx.rate_per_unit ? `₹${tx.rate_per_unit.toFixed(2)}` : "-"}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    ₹{tx.cost_value.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {tx.created_by ? tx.created_by.split("@")[0] : "System"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Summary Footer */}
      <div className="bg-muted p-3 rounded-lg text-sm">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-muted-foreground">Total Inbound</p>
            <p className="font-semibold text-green-600">
              +{transactionsWithBalance
                .reduce((sum, tx) => sum + (tx.qty_change > 0 ? tx.qty_change : 0), 0)
                .toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Outbound</p>
            <p className="font-semibold text-red-600">
              {transactionsWithBalance
                .reduce((sum, tx) => sum + (tx.qty_change < 0 ? tx.qty_change : 0), 0)
                .toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Current Balance</p>
            <p className="font-semibold">
              {transactionsWithBalance[transactionsWithBalance.length - 1]?.balance.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Value</p>
            <p className="font-semibold">
              ₹
              {transactionsWithBalance
                .reduce((sum, tx) => sum + tx.cost_value, 0)
                .toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Remarks Display */}
      {transactionsWithBalance.some((tx) => tx.remarks) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-900 mb-2">Notes & Remarks</p>
          <div className="space-y-1 text-xs text-blue-800">
            {transactionsWithBalance
              .filter((tx) => tx.remarks)
              .map((tx) => (
                <div key={tx.id}>
                  <span className="font-mono">{tx.reference_doc}:</span> {tx.remarks}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
