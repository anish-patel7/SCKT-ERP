import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useReceiveNewInventoryItem,
  useRecordInwardTransaction,
} from "@/hooks/useInventoryLedger";
import { useInventoryItems } from "@/hooks/useInventoryLedger";

/**
 * InwardDialog: Record inbound transactions
 * - New yarn/beam/fabric creation
 * - Add to existing inventory
 * - GRN and rate tracking
 */

export interface InwardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: "yarn" | "beam" | "fabric";
  onSuccess?: (itemId: string) => void;
}

export function InwardDialog({ isOpen, onClose, itemType, onSuccess }: InwardDialogProps) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [selectedItemId, setSelectedItemId] = useState<string>("");

  // Queries
  const { data: existingItems = [], isLoading: itemsLoading } = useInventoryItems({
    itemType,
    isActive: true,
  });
  const { mutate: recordInward, isPending: isRecording } = useRecordInwardTransaction();
  const { mutate: receiveNewItem, isPending: isReceiving } = useReceiveNewInventoryItem();
  const isPending = isRecording || isReceiving;

  // Form state
  const [formData, setFormData] = useState({
    // New item fields
    item_code: "",
    item_name: "",
    lot_no: "",
    grn_no: "",

    // Transaction fields
    qty: "",
    unit: itemType === "yarn" ? "kg" : itemType === "beam" ? "beam" : "roll",
    rate_per_unit: "",
    location_to: "",
    remarks: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.qty || !formData.location_to) {
      alert("Please fill in all required fields");
      return;
    }

    const qtyValue = parseFloat(formData.qty);
    const rateValue = formData.rate_per_unit ? parseFloat(formData.rate_per_unit) : undefined;

    if (isNaN(qtyValue) || qtyValue <= 0) {
      alert("Quantity must be a positive number");
      return;
    }

    if (rateValue !== undefined && (isNaN(rateValue) || rateValue <= 0)) {
      alert("Rate must be a positive number");
      return;
    }

    const unit = formData.unit as "kg" | "m" | "beam" | "roll";
    const transaction = {
      transaction_date: new Date().toISOString(),
      movement_type: "inward_purchase",
      qty_change: qtyValue,
      unit,
      location_to: formData.location_to,
      rate_per_unit: rateValue,
      reference_doc: formData.grn_no || undefined,
      remarks: formData.remarks || undefined,
    };
    const callbacks = {
      onSuccess: (result: { item_id: string }) => {
        setFormData({
          item_code: "",
          item_name: "",
          lot_no: "",
          grn_no: "",
          qty: "",
          unit: itemType === "yarn" ? "kg" : itemType === "beam" ? "beam" : "roll",
          rate_per_unit: "",
          location_to: "",
          remarks: "",
        });
        setSelectedItemId("");
        setMode("new");
        onClose();
        onSuccess?.(result.item_id);
      },
    };

    if (mode === "new") {
      if (!formData.item_code.trim() || !formData.item_name.trim()) {
        alert("Please enter item code and name for new item");
        return;
      }
      // Creates the inventory item first, then records the inward against its id.
      receiveNewItem(
        {
          item: {
            item_type: itemType,
            item_code: formData.item_code,
            item_name: formData.item_name,
            lot_no: formData.lot_no || undefined,
            grn_no: formData.grn_no || undefined,
            total_qty: 0,
            total_unit: unit,
            rate_per_unit: rateValue,
            current_location: formData.location_to,
          },
          transaction,
        },
        callbacks,
      );
      return;
    }

    if (!selectedItemId) {
      alert("Please select an existing item");
      return;
    }
    recordInward({ ...transaction, item_id: selectedItemId }, callbacks);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Inbound {itemType.charAt(0).toUpperCase() + itemType.slice(1)}</DialogTitle>
          <DialogDescription>
            Add new {itemType} or increase stock for existing {itemType}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Mode Selection */}
          <Tabs
            value={mode}
            onValueChange={(v) => {
              setMode(v as "new" | "existing");
              setSelectedItemId("");
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new">New {itemType}</TabsTrigger>
              <TabsTrigger value="existing">Add to Existing</TabsTrigger>
            </TabsList>

            {/* New Item Tab */}
            <TabsContent value="new" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="item_code">Item Code *</Label>
                  <Input
                    id="item_code"
                    placeholder={itemType === "yarn" ? "Y-001" : itemType === "beam" ? "B-001" : "F-001"}
                    value={formData.item_code}
                    onChange={(e) =>
                      setFormData({ ...formData, item_code: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="item_name">Item Name *</Label>
                  <Input
                    id="item_name"
                    placeholder="e.g., Premium Silk"
                    value={formData.item_name}
                    onChange={(e) =>
                      setFormData({ ...formData, item_name: e.target.value })
                    }
                  />
                </div>
              </div>

              {itemType === "yarn" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="lot_no">Lot Number</Label>
                    <Input
                      id="lot_no"
                      placeholder="L-001"
                      value={formData.lot_no}
                      onChange={(e) =>
                        setFormData({ ...formData, lot_no: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="grn_no">GRN Number</Label>
                    <Input
                      id="grn_no"
                      placeholder="GRN-2026-1501"
                      value={formData.grn_no}
                      onChange={(e) =>
                        setFormData({ ...formData, grn_no: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Existing Item Tab */}
            <TabsContent value="existing" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="select_item">Select {itemType} *</Label>
                <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                  <SelectTrigger id="select_item">
                    <SelectValue placeholder={`Choose existing ${itemType}...`} />
                  </SelectTrigger>
                  <SelectContent>
                    {existingItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.item_code} - {item.item_name} ({item.available_qty.toFixed(2)} {item.total_unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {itemsLoading && <p className="text-sm text-muted-foreground">Loading items...</p>}
              </div>
            </TabsContent>
          </Tabs>

          {/* Common Transaction Fields */}
          <div className="space-y-4 border-t pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="qty">Quantity * ({formData.unit})</Label>
                <Input
                  id="qty"
                  type="number"
                  placeholder="500"
                  step="0.01"
                  value={formData.qty}
                  onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="rate">Rate per Unit (₹)</Label>
                <Input
                  id="rate"
                  type="number"
                  placeholder="232"
                  step="0.01"
                  value={formData.rate_per_unit}
                  onChange={(e) =>
                    setFormData({ ...formData, rate_per_unit: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="location">Bin/Rack Location *</Label>
              <Input
                id="location"
                placeholder="BIN-A1 or RACK-01"
                value={formData.location_to}
                onChange={(e) =>
                  setFormData({ ...formData, location_to: e.target.value })
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
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? "Saving..." : "Save Inbound"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
