import { useState, useEffect, useRef, useMemo } from "react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
  X,
  Check,
  RotateCcw,
  Sparkles,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DesignWithDetails, BeamColour, Feeder } from "@/types/design";
import { saveDraft, clearDraft } from "@/lib/design-store";
import { useYarnMaterials } from "@/hooks/useYarnMaterials";
import { getErrorMessage, useSaveDesign } from "@/hooks/useDesigns";

interface DesignEntryProps {
  initialDesign?: DesignWithDetails | null | undefined;
  isClone?: boolean | undefined;
  onBack: () => void;
  onSaveSuccess: (saved: DesignWithDetails) => void;
}

const WORK_TYPES = [
  "Jacquard Pashmina",
  "Brocade Work",
  "Floral Motif",
  "Embroidery & Jacquard",
  "Dobhy Weave",
  "Plain Grey",
  "Zari Border",
];

export interface BeamColourColumn {
  id: string;
  beamColourName: string;
  displayOrder: number;
}

export interface FeederMatrixRow {
  id: string;
  feederNumber: string;
  pick: string;
  card: string;
  beamColourValues: Record<string, string>;
  displayOrder: number;
}

export function DesignEntry({
  initialDesign,
  isClone = false,
  onBack,
  onSaveSuccess,
}: DesignEntryProps) {
  // 1. Design Header Form State
  const [designNumber, setDesignNumber] = useState(
    isClone ? "" : initialDesign?.designNumber || "",
  );
  const [designName, setDesignName] = useState(
    initialDesign
      ? isClone
        ? `${initialDesign.designName} (Copy)`
        : initialDesign.designName
      : "",
  );
  const [dn, setDn] = useState(initialDesign?.dn || "");
  const [dnCode, setDnCode] = useState(initialDesign?.dnCode || "");
  const [reed, setReed] = useState<string>(
    initialDesign?.reed !== undefined ? String(initialDesign.reed) : "",
  );
  const [patti, setPatti] = useState<string>(
    initialDesign?.patti !== undefined ? String(initialDesign.patti) : "",
  );
  const [totalDC, setTotalDC] = useState<string>(
    initialDesign?.totalDC !== undefined ? String(initialDesign.totalDC) : "",
  );
  const [totalCut, setTotalCut] = useState<string>(
    initialDesign?.totalCut !== undefined ? String(initialDesign.totalCut) : "",
  );
  const [work, setWork] = useState(initialDesign?.work || "Jacquard Pashmina");
  const [blueApt, setBlueApt] = useState(initialDesign?.blueApt || "");
  const [description, setDescription] = useState(initialDesign?.description || "");
  const [remarks, setRemarks] = useState(initialDesign?.remarks || "");
  const [image, setImage] = useState(initialDesign?.image || "");

  // 2. Feeder × Beam Colour Matrix State
  const [beamColourColumns, setBeamColourColumns] = useState<BeamColourColumn[]>(() => {
    if (initialDesign && initialDesign.beamColours && initialDesign.beamColours.length > 0) {
      return initialDesign.beamColours.map((bc, idx) => ({
        id: bc.id,
        beamColourName: bc.beamColour,
        displayOrder: idx + 1,
      }));
    }
    return [{ id: "bc-1", beamColourName: "BEAM COLOUR #1", displayOrder: 1 }];
  });

  const [feederRows, setFeederRows] = useState<FeederMatrixRow[]>(() => {
    if (initialDesign && initialDesign.beamColours && initialDesign.beamColours.length > 0) {
      // Find all unique feeder numbers across beam colours
      const feederMap: Record<
        string,
        {
          id: string;
          feederNumber: string;
          pick: string;
          card: string;
          values: Record<string, string>;
          order: number;
        }
      > = {};

      initialDesign.beamColours.forEach((bc) => {
        bc.feeders.forEach((f, fIdx) => {
          const num = f.feederNumber || `FDR-${fIdx + 1}`;
          if (!feederMap[num]) {
            feederMap[num] = {
              id: f.id || `fdr-${num}`,
              feederNumber: num,
              pick:
                f.pick !== undefined
                  ? String(f.pick)
                  : initialDesign.pick !== undefined
                    ? String(initialDesign.pick)
                    : "160",
              card:
                f.card !== undefined
                  ? String(f.card)
                  : initialDesign.cards !== undefined
                    ? String(initialDesign.cards)
                    : "64",
              values: {},
              order: fIdx + 1,
            };
          }
          feederMap[num].values[bc.id] = f.colorName || "";
        });
      });

      const sortedRows = Object.values(feederMap).sort((a, b) => a.order - b.order);
      if (sortedRows.length > 0) {
        return sortedRows.map((r, idx) => ({
          id: r.id,
          feederNumber: `FDR-${idx + 1}`,
          pick: r.pick,
          card: r.card,
          beamColourValues: r.values,
          displayOrder: idx + 1,
        }));
      }
    }

    // Default 1 initial feeder row
    return [
      {
        id: "fdr-1",
        feederNumber: "FDR-1",
        pick: "160",
        card: "64",
        beamColourValues: { "bc-1": "110/72 N.Blue" },
        displayOrder: 1,
      },
    ];
  });

  // Modal states for removal confirmations
  const [feederToRemove, setFeederToRemove] = useState<FeederMatrixRow | null>(null);
  const [colToRemove, setColToRemove] = useState<BeamColourColumn | null>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Available Yarn suggestions from Yarn Master (materials table)
  const { data: yarnRows = [] } = useYarnMaterials({ status: "Active" });
  const yarnSuggestions = useMemo(
    () => yarnRows.map((y) => (y.denier ? `${y.denier}D ${y.name}` : y.name)),
    [yarnRows],
  );
  const saveDesignMutation = useSaveDesign();

  // Auto-save draft logic
  useEffect(() => {
    const draftData: Partial<DesignWithDetails> = {
      designNumber,
      designName,
      dn: dn || undefined,
      dnCode: dnCode || undefined,
      reed: reed ? Number(reed) : undefined,
      patti: patti ? Number(patti) : undefined,
      totalDC: totalDC ? Number(totalDC) : undefined,
      totalCut: totalCut ? Number(totalCut) : undefined,
      work: work || undefined,
      blueApt: blueApt || undefined,
      description: description || undefined,
      remarks: remarks || undefined,
      image: image || undefined,
    };

    const timer = setTimeout(() => {
      saveDraft(draftData);
    }, 500);

    return () => clearTimeout(timer);
  }, [
    designNumber,
    designName,
    dn,
    dnCode,
    reed,
    patti,
    totalDC,
    totalCut,
    work,
    blueApt,
    description,
    remarks,
    image,
  ]);

  // Image Upload handler
  const handleImageFile = (file: File) => {
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      toast.error("Unsupported file format. Please upload JPG, PNG, or WEBP.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error("File size exceeds maximum limit of 20MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImage(e.target.result as string);
        toast.success("Image uploaded successfully");
      }
    };
    reader.readAsDataURL(file);
  };

  // Matrix Action: + Add Feeder
  const handleAddFeeder = () => {
    const nextNum = feederRows.length + 1;
    const newFeederNumber = `FDR-${nextNum}`;
    const newRow: FeederMatrixRow = {
      id: `fdr-${Date.now()}-${nextNum}`,
      feederNumber: newFeederNumber,
      pick: "", // blank by default per section 6
      card: "", // blank by default per section 6
      beamColourValues: {},
      displayOrder: nextNum,
    };

    setFeederRows([...feederRows, newRow]);
    toast.success(`Added Feeder ${newFeederNumber}`);
  };

  // Matrix Action: + Add Beam Colour
  const handleAddBeamColour = () => {
    const nextNum = beamColourColumns.length + 1;
    const newColId = `bc-${Date.now()}-${nextNum}`;
    const newColName = `BEAM COLOUR #${nextNum}`;
    const newCol: BeamColourColumn = {
      id: newColId,
      beamColourName: newColName,
      displayOrder: nextNum,
    };

    setBeamColourColumns([...beamColourColumns, newCol]);
    toast.success(`Added ${newColName}`);
  };

  // Remove Feeder Handler (with auto-renumbering FDR-1, FDR-2...)
  const confirmRemoveFeeder = () => {
    if (!feederToRemove) return;

    const filtered = feederRows.filter((r) => r.id !== feederToRemove.id);
    const renumbered = filtered.map((r, idx) => ({
      ...r,
      feederNumber: `FDR-${idx + 1}`,
      displayOrder: idx + 1,
    }));

    setFeederRows(renumbered);
    setFeederToRemove(null);
    toast.success(`Removed ${feederToRemove.feederNumber}`);
  };

  // Remove Beam Colour Column Handler
  const confirmRemoveBeamColour = () => {
    if (!colToRemove) return;

    const filteredCols = beamColourColumns.filter((c) => c.id !== colToRemove.id);
    const reorderedCols = filteredCols.map((c, idx) => ({
      ...c,
      displayOrder: idx + 1,
    }));

    // Remove cell values for this column from feeder rows
    const updatedRows = feederRows.map((r) => {
      const copy = { ...r.beamColourValues };
      delete copy[colToRemove.id];
      return { ...r, beamColourValues: copy };
    });

    setBeamColourColumns(reorderedCols);
    setFeederRows(updatedRows);
    setColToRemove(null);
    toast.success(`Removed Beam Colour column`);
  };

  // Cell Value Change Handler
  const handleCellValueChange = (feederId: string, colId: string, value: string) => {
    setFeederRows(
      feederRows.map((r) => {
        if (r.id !== feederId) return r;
        return {
          ...r,
          beamColourValues: {
            ...r.beamColourValues,
            [colId]: value,
          },
        };
      }),
    );
  };

  // Feeder Pick / Card Change Handler
  const handleFeederFieldValueChange = (
    feederId: string,
    field: "pick" | "card",
    value: string,
  ) => {
    setFeederRows(
      feederRows.map((r) => {
        if (r.id !== feederId) return r;
        return { ...r, [field]: value };
      }),
    );
  };

  // Save handler
  const handleSave = async () => {
    if (!designNumber.trim()) {
      toast.error("Design Number is required.");
      return;
    }
    if (!designName.trim()) {
      toast.error("Design Name is required.");
      return;
    }

    if (feederRows.length === 0) {
      toast.error("At least one Feeder row is required.");
      return;
    }

    if (beamColourColumns.length === 0) {
      toast.error("At least one Beam Colour column is required.");
      return;
    }

    // Validate Feeder Pick and Card values
    for (let i = 0; i < feederRows.length; i++) {
      const row = feederRows[i];
      if (!row || !row.pick || isNaN(Number(row.pick)) || Number(row.pick) <= 0) {
        toast.error(`Feeder ${row?.feederNumber || i + 1} requires a valid positive Pick value.`);
        return;
      }
      if (!row.card || isNaN(Number(row.card)) || Number(row.card) <= 0) {
        toast.error(`Feeder ${row?.feederNumber || i + 1} requires a valid positive Card value.`);
        return;
      }
    }

    // Validate Beam Colour column names
    for (let i = 0; i < beamColourColumns.length; i++) {
      const col = beamColourColumns[i];
      if (!col || !col.beamColourName.trim()) {
        toast.error(`Beam Colour #${i + 1} column name cannot be empty.`);
        return;
      }
    }

    // Map matrix state into BeamColour[] format for storage
    const beamColoursPayload: BeamColour[] = beamColourColumns.map((col) => {
      const feedersPayload: Feeder[] = feederRows.map((row) => ({
        id: `${row.id}-${col.id}`,
        beamColourId: col.id,
        feederNumber: row.feederNumber,
        pick: Number(row.pick),
        card: Number(row.card),
        colorName: row.beamColourValues[col.id] || "",
        displayOrder: row.displayOrder,
      }));

      return {
        id: col.id,
        designId: initialDesign?.id || "",
        beamColour: col.beamColourName.trim(),
        displayOrder: col.displayOrder,
        feeders: feedersPayload,
      };
    });

    try {
      const payload = {
        id: isClone ? undefined : initialDesign?.id,
        designNumber: designNumber.trim(),
        designName: designName.trim(),
        dn: dn.trim() || undefined,
        dnCode: dnCode.trim() || undefined,
        reed: reed ? Number(reed) : undefined,
        patti: patti ? Number(patti) : undefined,
        totalDC: totalDC ? Number(totalDC) : undefined,
        totalCut: totalCut ? Number(totalCut) : undefined,
        work: work || undefined,
        blueApt: blueApt.trim() || undefined,
        description: description.trim() || undefined,
        remarks: remarks.trim() || undefined,
        image: image || undefined,
        beamColours: beamColoursPayload,
      };

      const saved = await saveDesignMutation.mutateAsync({ id: payload.id, input: payload });
      clearDraft();
      toast.success(
        isClone
          ? `Design cloned successfully as ${saved.designNumber}!`
          : initialDesign
            ? `Design ${saved.designNumber} updated successfully!`
            : `Design ${saved.designNumber} created successfully!`,
      );
      onSaveSuccess(saved);
    } catch (err) {
      toast.error(`Unable to save design: ${getErrorMessage(err)}`);
    }
  };

  const isEditing = Boolean(initialDesign && !isClone);
  const pageTitle = isClone
    ? "Clone Design"
    : isEditing
      ? `Edit Design — ${initialDesign?.designNumber}`
      : "New Design";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 px-2 text-xs">
            <ArrowLeft className="size-4" /> Back to Designs
          </Button>
          <span className="h-4 w-px bg-border" />
          <h2 className="text-lg font-semibold tracking-tight">{pageTitle}</h2>
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          >
            <Check className="mr-1 size-3" /> Auto-save: ON
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack} className="h-8 text-xs">
            Discard
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSave()}
            disabled={saveDesignMutation.isPending}
            className="h-8 gap-1 text-xs font-semibold"
          >
            <Check className="size-4" /> Save Design
          </Button>
        </div>
      </div>

      {/* 1. Design Information Card (Without Global Pick & Cards fields) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Design Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Row 1: Number, Name, Work Type */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="designNumber">
                Design Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="designNumber"
                placeholder="e.g. D-015"
                value={designNumber}
                onChange={(e) => setDesignNumber(e.target.value)}
                className="font-mono font-bold text-primary"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="designName">
                Design Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="designName"
                placeholder="e.g. Kashmiri Pashmina"
                value={designName}
                onChange={(e) => setDesignName(e.target.value)}
                className="font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="work">Work Type</Label>
              <Select value={work} onValueChange={setWork}>
                <SelectTrigger id="work">
                  <SelectValue placeholder="Select work type" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_TYPES.map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Design Image Upload Component */}
          <div className="space-y-1.5">
            <Label>Design Image (JPG, PNG, WEBP — Max 20MB)</Label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files?.[0]) handleImageFile(e.dataTransfer.files[0]);
              }}
              className={`relative flex min-h-24 flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                isDragOver
                  ? "border-primary bg-primary/5"
                  : image
                    ? "border-border bg-surface"
                    : "border-border hover:bg-accent/50"
              }`}
            >
              {image ? (
                <div className="flex flex-wrap items-center gap-4">
                  <img
                    src={image}
                    alt="Design Preview"
                    className="size-20 rounded-md border border-border object-cover shadow-sm"
                  />
                  <div className="text-left">
                    <p className="text-xs font-medium text-foreground">Design image uploaded</p>
                    <p className="text-[0.6875rem] text-muted-foreground">
                      Supported format JPG/PNG/WEBP
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <RotateCcw className="mr-1 size-3" /> Replace
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setImage("")}
                      >
                        <X className="mr-1 size-3" /> Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="cursor-pointer flex flex-col items-center justify-center py-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mb-1 size-6 text-muted-foreground" />
                  <p className="text-xs font-medium">Click to upload or drag & drop</p>
                  <p className="text-[0.6875rem] text-muted-foreground">
                    JPG, PNG, WEBP (Max 20MB)
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleImageFile(e.target.files[0]);
                }}
              />
            </div>
          </div>

          {/* Technical Specs Rows (Reed, Patti, Total DC, Total Cut) */}
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="dn">DN Number</Label>
              <Input
                id="dn"
                placeholder="e.g. DN-440"
                value={dn}
                onChange={(e) => setDn(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dnCode">DN Code</Label>
              <Input
                id="dnCode"
                placeholder="e.g. DN-440-KASH"
                value={dnCode}
                onChange={(e) => setDnCode(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reed">Reed</Label>
              <Input
                id="reed"
                type="number"
                placeholder="120"
                value={reed}
                onChange={(e) => setReed(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="patti">Patti</Label>
              <Input
                id="patti"
                type="number"
                placeholder="12"
                value={patti}
                onChange={(e) => setPatti(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="totalDC">Total D.C.</Label>
              <Input
                id="totalDC"
                type="number"
                placeholder="14400"
                value={totalDC}
                onChange={(e) => setTotalDC(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="totalCut">Total Cut</Label>
              <Input
                id="totalCut"
                type="number"
                placeholder="4"
                value={totalCut}
                onChange={(e) => setTotalCut(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="blueApt">Blue + APT</Label>
              <Input
                id="blueApt"
                placeholder="e.g. Blue-99 / APT-A"
                value={blueApt}
                onChange={(e) => setBlueApt(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="remarks">Remarks</Label>
              <Input
                id="remarks"
                placeholder="Special instructions..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={2}
              placeholder="Comprehensive description of design construction..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. CONSOLIDATED FEEDER × BEAM COLOUR MATRIX */}
      <Card className="border-primary/20 bg-card shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border py-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Layers className="size-4 text-primary" /> FEEDER PROGRAM & BEAM COLOUR MATRIX
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage Feeder rows with fixed Feeder Pick and Card values against dynamic Beam Colour
              columns.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddFeeder}
              className="h-8 text-xs gap-1 font-semibold"
            >
              <Plus className="size-3.5" /> Add Feeder
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleAddBeamColour}
              className="h-8 text-xs gap-1 font-semibold"
            >
              <Plus className="size-3.5" /> Add Beam Colour
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Responsive Matrix Table Container with Horizontal Scroll */}
          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
            <table className="w-full min-w-[700px] border-collapse text-xs">
              <thead>
                <tr className="bg-muted/70 border-b border-border font-semibold text-muted-foreground">
                  <th className="border-r border-border px-3 py-2 text-left min-w-[100px] font-bold text-foreground">
                    FEEDER
                  </th>
                  <th className="border-r border-border px-3 py-2 text-center min-w-[90px] font-bold text-foreground">
                    PICK *
                  </th>
                  <th className="border-r border-border px-3 py-2 text-center min-w-[90px] font-bold text-foreground">
                    CARD *
                  </th>

                  {/* Beam Colour Columns */}
                  {beamColourColumns.map((col, colIdx) => (
                    <th key={col.id} className="border-r border-border px-3 py-2 min-w-[180px]">
                      <div className="flex items-center justify-between gap-1">
                        <Input
                          value={col.beamColourName}
                          onChange={(e) =>
                            setBeamColourColumns(
                              beamColourColumns.map((c) =>
                                c.id === col.id ? { ...c, beamColourName: e.target.value } : c,
                              ),
                            )
                          }
                          className="h-7 text-xs font-bold text-primary bg-background border-border text-center"
                          placeholder={`BEAM COLOUR #${colIdx + 1}`}
                          list={`yarn-suggestions-${col.id}`}
                        />
                        <datalist id={`yarn-suggestions-${col.id}`}>
                          {yarnSuggestions.map((y, idx) => (
                            <option key={idx} value={y} />
                          ))}
                        </datalist>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => setColToRemove(col)}
                          title="Remove Beam Colour Column"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    </th>
                  ))}

                  <th className="px-2 py-2 text-center min-w-[60px]">ACTION</th>
                </tr>
              </thead>

              <tbody>
                {feederRows.map((row, rIdx) => (
                  <tr
                    key={row.id}
                    className="border-b border-border hover:bg-muted/30 transition-colors"
                  >
                    {/* FEEDER Label */}
                    <td className="border-r border-border p-2 font-mono font-bold text-primary text-left">
                      <Badge
                        variant="outline"
                        className="font-mono font-bold text-xs bg-primary/10 text-primary border-primary/30"
                      >
                        {row.feederNumber}
                      </Badge>
                    </td>

                    {/* PICK Input */}
                    <td className="border-r border-border p-2">
                      <Input
                        type="number"
                        min={1}
                        placeholder="Pick"
                        value={row.pick}
                        onChange={(e) =>
                          handleFeederFieldValueChange(row.id, "pick", e.target.value)
                        }
                        className="h-8 text-xs font-mono font-bold text-center border-border"
                      />
                    </td>

                    {/* CARD Input */}
                    <td className="border-r border-border p-2">
                      <Input
                        type="number"
                        min={1}
                        placeholder="Card"
                        value={row.card}
                        onChange={(e) =>
                          handleFeederFieldValueChange(row.id, "card", e.target.value)
                        }
                        className="h-8 text-xs font-mono font-bold text-center border-border"
                      />
                    </td>

                    {/* Beam Colour Cell Inputs */}
                    {beamColourColumns.map((col) => (
                      <td key={col.id} className="border-r border-border p-2">
                        <Input
                          placeholder="e.g. 110/72 N.Blue"
                          value={row.beamColourValues[col.id] || ""}
                          onChange={(e) => handleCellValueChange(row.id, col.id, e.target.value)}
                          className="h-8 text-xs text-center font-medium bg-background"
                          list={`yarn-cell-suggestions-${row.id}-${col.id}`}
                        />
                        <datalist id={`yarn-cell-suggestions-${row.id}-${col.id}`}>
                          {yarnSuggestions.map((y, idx) => (
                            <option key={idx} value={y} />
                          ))}
                        </datalist>
                      </td>
                    ))}

                    {/* Remove Feeder Action */}
                    <td className="p-2 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setFeederToRemove(row)}
                        title={`Remove ${row.feederNumber}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}

                {!feederRows.length && (
                  <tr>
                    <td
                      colSpan={4 + beamColourColumns.length}
                      className="py-8 text-center text-muted-foreground"
                    >
                      <p className="text-xs font-semibold">No feeder rows added yet.</p>
                      <p className="text-[0.6875rem] text-muted-foreground">
                        Click "+ Add Feeder" to add a feeder row.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Remove Feeder Confirmation Dialog */}
      <AlertDialog
        open={Boolean(feederToRemove)}
        onOpenChange={(open) => !open && setFeederToRemove(null)}
      >
        {feederToRemove && (
          <AlertDialogContent className="max-w-md text-xs">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-bold">
                Remove Feeder {feederToRemove.feederNumber}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground pt-1">
                Are you sure you want to remove <strong>{feederToRemove.feederNumber}</strong>?
                Remaining feeders will be automatically re-sequenced.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel onClick={() => setFeederToRemove(null)} className="h-8 text-xs">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRemoveFeeder}
                className="h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold"
              >
                Remove Feeder
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      {/* Remove Beam Colour Column Confirmation Dialog */}
      <AlertDialog
        open={Boolean(colToRemove)}
        onOpenChange={(open) => !open && setColToRemove(null)}
      >
        {colToRemove && (
          <AlertDialogContent className="max-w-md text-xs">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-bold">
                Remove {colToRemove.beamColourName}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground pt-1">
                Are you sure you want to remove <strong>{colToRemove.beamColourName}</strong> and
                all feeder entries in this column? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel onClick={() => setColToRemove(null)} className="h-8 text-xs">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRemoveBeamColour}
                className="h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold"
              >
                Remove Column
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  );
}
