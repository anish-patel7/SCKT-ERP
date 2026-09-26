import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useRecordQAInspection } from "@/hooks/useApprovalWorkflow";

export interface QAInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
  itemCode: string;
  itemName: string;
  qtyReceived: number;
  unit: string;
  referenceDoc?: string;
}

const QUALITY_GRADES = [
  { value: "A", label: "Grade A - Pass", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "B", label: "Grade B - Pass with Notes", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "C", label: "Grade C - Conditional Pass", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  { value: "REJECTED", label: "Rejected - No Pass", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

export function QAInspectionDialog({
  open,
  onOpenChange,
  transactionId,
  itemCode,
  itemName,
  qtyReceived,
  unit,
  referenceDoc,
}: QAInspectionDialogProps) {
  const [qualityGrade, setQualityGrade] = useState<string>("");
  const [sampleSize, setSampleSize] = useState("");
  const [defectCount, setDefectCount] = useState("");
  const [defects, setDefects] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { mutate, isPending } = useRecordQAInspection();

  const handleSubmit = async () => {
    setError(null);

    if (!qualityGrade) {
      setError("Please select a quality grade");
      return;
    }

    if (sampleSize && (parseFloat(sampleSize) <= 0 || parseFloat(sampleSize) > qtyReceived)) {
      setError(`Sample size must be between 1 and ${qtyReceived}`);
      return;
    }

    try {
      const defectsList = defects
        .split("\n")
        .map((d) => d.trim())
        .filter((d) => d.length > 0);

      mutate(
        {
          transaction_id: transactionId,
          quality_grade: qualityGrade,
          sample_size: sampleSize ? parseInt(sampleSize) : undefined,
          defect_count: defectCount ? parseInt(defectCount) : undefined,
          defects_found: defectsList.length > 0 ? defectsList : undefined,
          remarks: remarks || undefined,
        },
        {
          onSuccess: () => {
            toast.success(`Inspection recorded - ${qualityGrade}`);
            // Reset form
            setQualityGrade("");
            setSampleSize("");
            setDefectCount("");
            setDefects("");
            setRemarks("");
            onOpenChange(false);
          },
          onError: (err: any) => {
            setError(err.message || "Failed to record inspection");
            toast.error("Failed to record inspection");
          },
        },
      );
    } catch (err: any) {
      setError(err.message || "Failed to record inspection");
    }
  };

  const selectedGrade = QUALITY_GRADES.find((g) => g.value === qualityGrade);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quality Inspection Report</DialogTitle>
          <DialogDescription>
            Inspect {itemCode} - {itemName} (Qty: {qtyReceived} {unit})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item Info */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Item:</span>
              <span className="font-semibold">{itemCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quantity Received:</span>
              <span className="font-semibold">{qtyReceived} {unit}</span>
            </div>
            {referenceDoc && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reference:</span>
                <span className="font-mono text-xs">{referenceDoc}</span>
              </div>
            )}
          </div>

          {/* Quality Grade Selection */}
          <div className="space-y-2">
            <Label htmlFor="grade" className="text-sm font-semibold">
              Quality Grade <span className="text-red-500">*</span>
            </Label>
            <Select value={qualityGrade} onValueChange={setQualityGrade}>
              <SelectTrigger id="grade">
                <SelectValue placeholder="Select quality grade..." />
              </SelectTrigger>
              <SelectContent>
                {QUALITY_GRADES.map((grade) => (
                  <SelectItem key={grade.value} value={grade.value}>
                    {grade.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedGrade && (
              <div className={`p-2 rounded text-sm ${selectedGrade.color}`}>
                <strong>{selectedGrade.label}</strong>
                <p className="text-xs mt-1">
                  {selectedGrade.value === "A" &&
                    "Item meets all specifications and quality standards."}
                  {selectedGrade.value === "B" &&
                    "Item meets specifications with minor notes that don't affect functionality."}
                  {selectedGrade.value === "C" &&
                    "Item meets specifications with conditions that require monitoring."}
                  {selectedGrade.value === "REJECTED" &&
                    "Item does not meet specifications and is rejected."}
                </p>
              </div>
            )}
          </div>

          {/* Sample Size */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sample" className="text-sm">
                Sample Size Inspected
              </Label>
              <Input
                id="sample"
                type="number"
                min="1"
                placeholder={`Max: ${qtyReceived}`}
                value={sampleSize}
                onChange={(e) => setSampleSize(e.target.value)}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">Units inspected from batch</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defects" className="text-sm">
                Defect Count
              </Label>
              <Input
                id="defects"
                type="number"
                min="0"
                placeholder="0"
                value={defectCount}
                onChange={(e) => setDefectCount(e.target.value)}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">Total defects found</p>
            </div>
          </div>

          {/* Defects Found */}
          <div className="space-y-2">
            <Label htmlFor="defect-list" className="text-sm">
              Defects Found (One per line)
            </Label>
            <Textarea
              id="defect-list"
              placeholder="e.g.&#10;Torn fabric in corner&#10;Color variation in 2 meters&#10;Wrong ply count"
              value={defects}
              onChange={(e) => setDefects(e.target.value)}
              className="text-sm resize-none h-24 font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              List specific defects or quality issues found
            </p>
          </div>

          {/* Remarks */}
          <div className="space-y-2">
            <Label htmlFor="remarks" className="text-sm">
              Inspection Remarks
            </Label>
            <Textarea
              id="remarks"
              placeholder="Additional notes, recommendations, or observations..."
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
          <Button onClick={handleSubmit} disabled={isPending || !qualityGrade}>
            {isPending ? "Recording..." : "Record Inspection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
