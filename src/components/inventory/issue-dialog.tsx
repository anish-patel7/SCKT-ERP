import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  useRecordIssueTransaction,
  useInventoryItems,
  useAvailableQuantity,
} from "@/hooks/useInventoryLedger";
import { InsufficientStockError } from "@/services/inventory";

/**
 * IssueDialog: Record issue/dispatch transactions
 * - Validates available quantity before issue
 * - Prevents over-issue
 * - Tracks location and reference document
 */

export interface IssueDialogProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: "yarn" | "beam" | "fabric";
  onSuccess?: () => void;
}

export function IssueDialog({ isOpen, onClose, itemType, onSuccess }: IssueDialogProps) {
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [formData, setFormData] = useState({
    qty_issue: "",
    location_to: "",
    reference_doc: "",
    remarks: "",
  });

  // Queries
  const { data: items = [], isLoading: itemsLoading } = useInventoryItems({
    itemType,
    isActive: true,
  });
  const { data: availableQty = 0, isLoading: balanceLoading } =
    useAvailableQuantity(selectedItemId);
  const { mutate: recordIssue, isPending, error: mutationError } =
    useRecordIssueTransaction();

  const selectedItem = items.find((i) => i.id === selectedItemId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate selection
    if (!selectedItemId) {
      alert("Please select an item");
      return;
    }

    if (!formData.qty_issue || !formData.location_to) {
      alert("Please fill in all required fields");
      return;
    }

    const qtyRequested = parseFloat(formData.qty_issue);

    // Validate quantity
    if (isNaN(qtyRequested) || qtyRequested <= 0) {
      alert("Issue quantity must be a positive number");
      return;
    }

    // Client-side stock validation
    if (qtyRequested > availableQty) {
      alert(`Only ${availableQty.toFixed(2)} ${selectedItem?.total_unit} available`);
      return;
    }

    // Record issue (server validates again)
    recordIssue(
      {
        transaction_date: new Date().toISOString(),
        movement_type: "issue_to_production",
        item_id: selectedItemId,
        qty_change: -qtyRequested,  // Negative for issue
        unit: selectedItem?.total_unit as any,
        location_from: selectedItem?.current_location || "WAREHOUSE",
        location_to: formData.location_to,
        reference_doc: formData.reference_doc || undefined,
        remarks: formData.remarks || undefined,
      },
      {
        onSuccess: () => {
          setSelectedItemId("");
          setFormData({
            qty_issue: "",
            location_to: "PRODUCTION",
            reference_doc: "",
            remarks: "",
          });
          onClose();
          onSuccess?.();
        },
      },
    );
  };

  const isInsufficientStock =
    mutationError instanceof InsufficientStockError;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Issue {itemType.charAt(0).toUpperCase() + itemType.slice(1)}</DialogTitle>
          <DialogDescription>
            Record {itemType} issue to production or internal use
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Item Selection */}
          <div>
            <Label htmlFor="select_item">Select {itemType} *</Label>
            <Select value={selectedItemId} onValueChange={setSelectedItemId}>
              <SelectTrigger id="select_item">
                <SelectValue placeholder={`Choose ${itemType} to issue...`} />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.item_code} - {item.item_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {itemsLoading && <p className="text-sm text-muted-foreground">Loading items...</p>}
          </div>

          {/* Stock Status */}
          {selectedItem && !balanceLoading && (
            <Alert variant={availableQty < 100 ? "destructive" : "default"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Available: {availableQty.toFixed(2)} {selectedItem.total_unit} {availableQty < 100 && "(Low Stock)"}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Alert */}
          {isInsufficientStock && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{mutationError?.message}</AlertDescription>
            </Alert>
          )}

          {/* Transaction Fields */}
          <div className="space-y-4 border-t pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="qty_issue">
                  Quantity to Issue * ({selectedItem?.total_unit || "unit"})
                </Label>
                <Input
                  id="qty_issue"
                  type="number"
                  placeholder="200"
                  step="0.01"
                  value={formData.qty_issue}
                  onChange={(e) =>
                    setFormData({ ...formData, qty_issue: e.target.value })
                  }
                />
                {selectedItem && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Max: {availableQty.toFixed(2)} {selectedItem.total_unit}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="location_to">Destination *</Label>
                <Select
                  value={formData.location_to}
                  onValueChange={(value) =>
                    setFormData({ ...formData, location_to: value })
                  }
                >
                  <SelectTrigger id="location_to">
                    <SelectValue placeholder="Select destination..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRODUCTION">Production</SelectItem>
                    <SelectItem value="WARPING-DEPT">Warping Department</SelectItem>
                    <SelectItem value="WEAVING-LOOM">Weaving Loom</SelectItem>
                    <SelectItem value="SAMPLE-DEPT">Sample Department</SelectItem>
                    <SelectItem value="QA-LAB">QA Lab</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="reference_doc">Reference Document (Job Card, PO, etc.)</Label>
              <Input
                id="reference_doc"
                placeholder="Job-5001 or PO-2026-100"
                value={formData.reference_doc}
                onChange={(e) =>
                  setFormData({ ...formData, reference_doc: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="remarks">Remarks</Label>
              <Input
                id="remarks"
                placeholder="Additional notes..."
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              />
            </div>
          </div>

          {/* Footer */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !selectedItemId || balanceLoading}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? "Issuing..." : "Record Issue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
