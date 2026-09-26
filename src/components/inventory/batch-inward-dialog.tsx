import { useState } from "react";
import { Plus, Trash2, Loader2, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRecordBatchInwardTransactions, useInventoryItems } from "@/hooks/useInventoryLedger";
import { WarehouseLocationPicker } from "./warehouse-location-picker";

/**
 * BatchInwardDialog: Record multiple inbound items in a single GRN
 * - Table-based interface for adding items
 * - Atomic batch insert (all or nothing)
 * - Inline add/remove rows
 */

export interface BatchInwardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: "yarn" | "beam" | "fabric";
  onSuccess?: () => void;
}

interface BatchRow {
  id: string;
  item_id: string;
  qty_change: string;
  unit: "kg" | "m" | "beam" | "roll";
  rate_per_unit: string;
  location_to: string;
  remarks: string;
}

export function BatchInwardDialog({
  isOpen,
  onClose,
  itemType,
  onSuccess,
}: BatchInwardDialogProps) {
  const [grnNo, setGrnNo] = useState("");
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [rows, setRows] = useState<BatchRow[]>([
    {
      id: "1",
      item_id: "",
      qty_change: "",
      unit: itemType === "yarn" ? "kg" : itemType === "beam" ? "beam" : "roll",
      rate_per_unit: "",
      location_to: "",
      remarks: "",
    },
  ]);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationPickerRowId, setLocationPickerRowId] = useState<string>("");

  const { data: items = [] } = useInventoryItems({
    itemType,
    isActive: true,
  });

  const { mutate: recordBatch, isPending } =
    useRecordBatchInwardTransactions();

  const defaultUnit =
    itemType === "yarn" ? "kg" : itemType === "beam" ? "beam" : "roll";

  // Add new row
  const handleAddRow = () => {
    const newId = String(Math.max(...rows.map((r) => parseInt(r.id)), 0) + 1);
    setRows([
      ...rows,
      {
        id: newId,
        item_id: "",
        qty_change: "",
        unit: defaultUnit as any,
        rate_per_unit: "",
        location_to: "",
        remarks: "",
      },
    ]);
  };

  // Update row field
  const handleRowChange = (
    id: string,
    field: keyof BatchRow,
    value: string,
  ) => {
    setRows(rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  // Remove row
  const handleRemoveRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter((row) => row.id !== id));
    }
  };

  // Validate and submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate GRN
    if (!grnNo.trim()) {
      alert("Please enter GRN number");
      return;
    }

    // Validate rows
    const validRows = [];
    for (const row of rows) {
      if (!row.item_id) {
        alert(`Row ${row.id}: Please select an item`);
        return;
      }
      if (!row.qty_change || isNaN(parseFloat(row.qty_change))) {
        alert(`Row ${row.id}: Please enter valid quantity`);
        return;
      }
      const qty = parseFloat(row.qty_change);
      if (qty <= 0) {
        alert(`Row ${row.id}: Quantity must be positive`);
        return;
      }
      if (!row.location_to.trim()) {
        alert(`Row ${row.id}: Please enter location`);
        return;
      }

      // Validate rate if provided
      if (row.rate_per_unit) {
        const rate = parseFloat(row.rate_per_unit);
        if (isNaN(rate) || rate <= 0) {
          alert(`Row ${row.id}: Rate must be a positive number`);
          return;
        }
      }

      validRows.push({
        item_id: row.item_id,
        qty_change: parseFloat(row.qty_change),
        unit: row.unit,
        rate_per_unit: row.rate_per_unit ? parseFloat(row.rate_per_unit) : undefined,
        location_to: row.location_to,
        remarks: row.remarks || undefined,
      });
    }

    if (validRows.length === 0) {
      alert("Please add at least one item");
      return;
    }

    // Submit batch
    recordBatch(
      {
        grn_no: grnNo,
        transaction_date: new Date(transactionDate).toISOString(),
        transactions: validRows,
      },
      {
        onSuccess: () => {
          // Reset form
          setGrnNo("");
          setTransactionDate(new Date().toISOString().split("T")[0]);
          setRows([
            {
              id: "1",
              item_id: "",
              qty_change: "",
              unit: defaultUnit as any,
              rate_per_unit: "",
              location_to: "",
              remarks: "",
            },
          ]);
          onClose();
          onSuccess?.();
        },
      },
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Batch Inward Receipt</DialogTitle>
          <DialogDescription>
            Record multiple {itemType} items in a single GRN
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* GRN Header */}
          <div className="grid grid-cols-2 gap-4 border-b pb-4">
            <div>
              <Label htmlFor="grn_no">GRN Number *</Label>
              <Input
                id="grn_no"
                placeholder="GRN-2026-1501"
                value={grnNo}
                onChange={(e) => setGrnNo(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="transaction_date">Transaction Date *</Label>
              <Input
                id="transaction_date"
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
              />
            </div>
          </div>

          {/* Items Table */}
          <div className="rounded-md border border-border overflow-hidden">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-muted/60 font-semibold text-muted-foreground">
                  <TableHead className="h-8 w-40">Item Code</TableHead>
                  <TableHead className="h-8 w-32">Quantity</TableHead>
                  <TableHead className="h-8 w-24">Unit</TableHead>
                  <TableHead className="h-8 w-32">Rate/Unit (₹)</TableHead>
                  <TableHead className="h-8 w-40">Location</TableHead>
                  <TableHead className="h-8 flex-1">Remarks</TableHead>
                  <TableHead className="h-8 w-12 text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/40">
                    {/* Item Selection */}
                    <TableCell className="p-2">
                      <Select value={row.item_id} onValueChange={(v) =>
                        handleRowChange(row.id, "item_id", v)
                      }>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {items.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.item_code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Quantity */}
                    <TableCell className="p-2">
                      <Input
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={row.qty_change}
                        onChange={(e) =>
                          handleRowChange(row.id, "qty_change", e.target.value)
                        }
                        className="h-7 text-xs"
                      />
                    </TableCell>

                    {/* Unit */}
                    <TableCell className="p-2">
                      <Select value={row.unit} onValueChange={(v) =>
                        handleRowChange(row.id, "unit", v)
                      }>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="m">m</SelectItem>
                          <SelectItem value="beam">beam</SelectItem>
                          <SelectItem value="roll">roll</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Rate */}
                    <TableCell className="p-2">
                      <Input
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={row.rate_per_unit}
                        onChange={(e) =>
                          handleRowChange(row.id, "rate_per_unit", e.target.value)
                        }
                        className="h-7 text-xs"
                      />
                    </TableCell>

                    {/* Location */}
                    <TableCell className="p-2">
                      <div className="flex gap-1">
                        <Input
                          placeholder="BIN-A1"
                          value={row.location_to}
                          onChange={(e) =>
                            handleRowChange(row.id, "location_to", e.target.value)
                          }
                          className="h-7 text-xs flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setLocationPickerRowId(row.id);
                            setShowLocationPicker(true);
                          }}
                          className="px-2 h-7 text-xs border border-slate-200 rounded hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          <MapPin className="size-3" />
                        </button>
                      </div>
                    </TableCell>

                    {/* Remarks */}
                    <TableCell className="p-2">
                      <Input
                        placeholder="Notes..."
                        value={row.remarks}
                        onChange={(e) =>
                          handleRowChange(row.id, "remarks", e.target.value)
                        }
                        className="h-7 text-xs"
                      />
                    </TableCell>

                    {/* Remove Button */}
                    <TableCell className="p-2 text-center">
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Add Row Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddRow}
            className="gap-1"
          >
            <Plus className="size-3.5" /> Add Row
          </Button>

          {/* Footer */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending
                ? "Recording..."
                : `Record Batch (${rows.length} item${rows.length > 1 ? "s" : ""})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Location Picker Dialog */}
      <Dialog open={showLocationPicker} onOpenChange={setShowLocationPicker}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Warehouse Location</DialogTitle>
            <DialogDescription>
              Choose a location from the warehouse map
            </DialogDescription>
          </DialogHeader>

          <WarehouseLocationPicker
            onSelectLocation={(code) => {
              if (locationPickerRowId) {
                handleRowChange(locationPickerRowId, "location_to", code);
              }
              setShowLocationPicker(false);
              setLocationPickerRowId("");
            }}
            showAvailableOnly={false}
          />
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
