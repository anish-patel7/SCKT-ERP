import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Calendar } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useCreateReservation } from "@/hooks/useReservations";

export interface ReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemCode: string;
  itemName: string;
  availableQty: number;
  unit: string;
}

export function ReservationDialog({
  open,
  onOpenChange,
  itemId,
  itemCode,
  itemName,
  availableQty,
  unit,
}: ReservationDialogProps) {
  const [qtyReserved, setQtyReserved] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [referenceDoc, setReferenceDoc] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { mutate, isPending } = useCreateReservation();

  const handleSubmit = async () => {
    setError(null);

    // Validation
    if (!qtyReserved || parseFloat(qtyReserved) <= 0) {
      setError("Please enter a valid quantity");
      return;
    }

    const qty = parseFloat(qtyReserved);
    if (qty > availableQty) {
      setError(`Quantity exceeds available stock (${availableQty} ${unit})`);
      return;
    }

    if (expiresAt && new Date(expiresAt) <= new Date()) {
      setError("Expiration date must be in the future");
      return;
    }

    try {
      mutate(
        {
          item_id: itemId,
          qty_reserved: qty,
          unit,
          expires_at: expiresAt || null,
          reference_doc: referenceDoc || null,
          remarks: remarks || null,
        },
        {
          onSuccess: () => {
            toast.success(`Reserved ${qty} ${unit} of ${itemCode}`);
            // Reset form
            setQtyReserved("");
            setExpiresAt("");
            setReferenceDoc("");
            setRemarks("");
            onOpenChange(false);
          },
          onError: (err: any) => {
            setError(err.message || "Failed to create reservation");
            toast.error("Failed to create reservation");
          },
        },
      );
    } catch (err: any) {
      setError(err.message || "Failed to create reservation");
    }
  };

  const minExpiryDate = format(new Date(), "yyyy-MM-dd");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reserve Stock</DialogTitle>
          <DialogDescription>
            Create a stock reservation for {itemCode} - {itemName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item Info */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Item Code:</span>
              <span className="font-mono font-semibold">{itemCode}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Available Qty:</span>
              <span className="font-semibold text-green-600">
                {availableQty} {unit}
              </span>
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="qty" className="text-sm">
              Quantity to Reserve <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="qty"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={qtyReserved}
                onChange={(e) => {
                  setQtyReserved(e.target.value);
                  setError(null);
                }}
                className="flex-1"
              />
              <div className="flex items-center px-3 rounded-md bg-muted text-sm font-medium">
                {unit}
              </div>
            </div>
          </div>

          {/* Expiration Date */}
          <div className="space-y-2">
            <Label htmlFor="expires" className="text-sm">
              Expires (Optional)
            </Label>
            <div className="flex items-center">
              <Calendar className="absolute ml-3 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="expires"
                type="date"
                min={minExpiryDate}
                value={expiresAt}
                onChange={(e) => {
                  setExpiresAt(e.target.value);
                  setError(null);
                }}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Reservation will auto-expire on this date
            </p>
          </div>

          {/* Reference Doc */}
          <div className="space-y-2">
            <Label htmlFor="ref_doc" className="text-sm">
              Reference (PO, Job Card, etc.)
            </Label>
            <Input
              id="ref_doc"
              placeholder="e.g., PO-2026-001"
              value={referenceDoc}
              onChange={(e) => setReferenceDoc(e.target.value)}
              maxLength={100}
              className="text-sm"
            />
          </div>

          {/* Remarks */}
          <div className="space-y-2">
            <Label htmlFor="remarks" className="text-sm">
              Remarks
            </Label>
            <Textarea
              id="remarks"
              placeholder="Additional notes..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              maxLength={500}
              className="text-sm resize-none h-20"
            />
            <p className="text-xs text-muted-foreground">{remarks.length}/500</p>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !qtyReserved}>
            {isPending ? "Creating..." : "Create Reservation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
