import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus,
  CheckCircle2,
  ShieldAlert,
  Award,
  Search,
  Printer,
  Activity,
  Lock,
  Unlock,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { requireAuth } from "@/lib/route-guards";
import { Can } from "@/components/auth";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProductionInspections, useCreateProductionInspection, useOverrideInspectionGrade } from "@/hooks/useProductionInspections";
import type { ProductionInspection } from "@/services/quality";
import { fmt } from "@/lib/costing";
import {
  calculate4PointScore,
  calculatePointsForDefect,
  uid,
  type DefectEntry,
  type DefectType,
  type QualityGrade,
} from "@/lib/quality-store";

export const Route = createFileRoute("/quality/inspection")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "4-Point Quality Inspection — SCKT ERP" },
      {
        name: "description",
        content:
          "Objective fabric grading using international 4-Point System, visual defect mapping, 4-point yard capping (BR-155), and quality hold governance (BR-153).",
      },
      { property: "og:title", content: "Quality Inspection — SCKT ERP" },
      { property: "og:description", content: "Fabric inspection and 4-point quality scoring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InspectionPage,
});

const GRADE_STYLES: Record<string, string> = {
  "Grade A": "bg-emerald-600 hover:bg-emerald-700 text-white font-bold",
  "Grade B": "bg-blue-600 text-white",
  "Grade C": "bg-amber-500 text-black",
  Hold: "bg-rose-600 text-white font-bold",
};

function InspectionPage() {
  const { data: inspections = [], isLoading: inspectionsLoading } = useProductionInspections();
  const { mutate: createInspection, isPending: isCreating } = useCreateProductionInspection();
  const { mutate: overrideGrade, isPending: isOverriding } = useOverrideInspectionGrade("");

  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [openOverrideModal, setOpenOverrideModal] = useState(false);
  const [openCoiModal, setOpenCoiModal] = useState(false);
  const [selectedInsp, setSelectedInsp] = useState<any>(null);
  const { mutate: overrideGradeForSelectedInsp } = selectedInsp?.id
    ? useOverrideInspectionGrade(selectedInsp.id)
    : { mutate: () => {} };

  // Form states
  const [rollNo, setRollNo] = useState("ROL-9901");
  const [itemCode, setItemCode] = useState("ITEM-001");
  const [designNo, setDesignNo] = useState("D-015");
  const [loomNo, setLoomNo] = useState("L-01");
  const [shift, setShift] = useState<"A" | "B" | "C">("A");
  const [operatorName, setOperatorName] = useState("Ramesh Kumar");
  const [rollLengthYd, setRollLengthYd] = useState("100");
  const [rollWidthInch, setRollWidthInch] = useState("44");

  // Defect entries for active inspection form
  const [defectsForm, setDefectsForm] = useState<DefectEntry[]>([
    {
      id: "df-1",
      defect_type: "weft_slub",
      size_inches: 2,
      points_scored: 1,
      yard_position: 15,
      x_position_inch: 12,
    },
    {
      id: "df-2",
      defect_type: "warp_float",
      size_inches: 5,
      points_scored: 2,
      yard_position: 45,
      x_position_inch: 28,
    },
  ]);

  const [newDefectType, setNewDefectType] = useState<DefectType>("weft_slub");
  const [newDefectSize, setNewDefectSize] = useState("3");
  const [newDefectYard, setNewDefectYard] = useState("20");
  const [newDefectX, setNewDefectX] = useState("15");

  // Grade override form
  const [overrideGradeValue, setOverrideGradeValue] = useState<QualityGrade>("Grade A");
  const [overrideReason, setOverrideReason] = useState("");

  // KPI Calculations
  const totalInspected = inspections.length;
  const gradeAPassCount = inspections.filter(
    (i) => (i.manual_grade_override || i.system_grade) === "Grade A",
  ).length;
  const gradeAPassRate = totalInspected > 0 ? (gradeAPassCount / totalInspected) * 100 : 100;
  const holdCount = inspections.filter(
    (i) => (i.manual_grade_override || i.system_grade) === "Hold",
  ).length;
  const totalPointsScored = inspections.reduce((sum, i) => sum + (i.capped_points || 0), 0);

  const filteredInspections = inspections.filter((i) => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return (
      i.inspection_no?.toLowerCase().includes(s) ||
      i.roll_no.toLowerCase().includes(s) ||
      i.item_code.toLowerCase().includes(s) ||
      i.design_no.toLowerCase().includes(s) ||
      i.loom_no.toLowerCase().includes(s) ||
      (i.operator_name && i.operator_name.toLowerCase().includes(s))
    );
  });

  const handleAddDefectToForm = () => {
    const size = Number(newDefectSize) || 1;
    const yard = Number(newDefectYard) || 1;
    const xPos = Number(newDefectX) || 10;
    const pts = calculatePointsForDefect(size, newDefectType);

    const entry: DefectEntry = {
      id: uid("df"),
      defect_type: newDefectType,
      size_inches: size,
      points_scored: pts,
      yard_position: yard,
      x_position_inch: xPos,
    };

    setDefectsForm([...defectsForm, entry]);
    toast.success(`Defect added at Yard ${yard} (${pts} pts)`);
  };

  const handleRemoveDefectFromForm = (id: string) => {
    setDefectsForm(defectsForm.filter((d) => d.id !== id));
  };

  const handleOpenCreate = () => {
    setDefectsForm([
      {
        id: uid("df"),
        defect_type: "weft_slub",
        size_inches: 2,
        points_scored: 1,
        yard_position: 12,
        x_position_inch: 14,
      },
      {
        id: uid("df"),
        defect_type: "warp_float",
        size_inches: 5,
        points_scored: 2,
        yard_position: 34,
        x_position_inch: 28,
      },
    ]);
    setOpenCreate(true);
  };

  const handleCreateInspection = () => {
    const lengthYd = Number(rollLengthYd) || 100;
    const widthInch = Number(rollWidthInch) || 44;

    // Calculate 4-point score with BR-155 capping (max 4 pts per yard) and Acceptance Criteria 2 formula
    const score = calculate4PointScore(lengthYd, widthInch, defectsForm);

    createInspection({
      roll_no: rollNo.trim(),
      item_code: itemCode.trim(),
      design_no: designNo.trim(),
      loom_no: loomNo.trim(),
      shift: shift,
      operator_name: operatorName.trim(),
      roll_length_yd: lengthYd,
      roll_width_inch: widthInch,
      defects: defectsForm,
      total_raw_points: score.totalRawPoints,
      capped_points: score.cappedPoints,
      points_per_100_sq_yd: score.pointsPer100SqYd,
      system_grade: score.systemGrade,
      status: "verified",
      verified_by: "Quality Inspector",
    }, {
      onSuccess: (newInsp) => {
        toast.success(
          `Inspection ${newInsp.inspection_no} saved. System Grade: ${newInsp.system_grade} (${newInsp.points_per_100_sq_yd} pts/100 sq yd).`,
        );
        setOpenCreate(false);
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to save inspection");
      },
    });
  };

  const handleOpenOverride = (insp: any) => {
    setSelectedInsp(insp);
    setOverrideGradeValue((insp.manual_grade_override || insp.system_grade) as QualityGrade);
    setOverrideReason("");
    setOpenOverrideModal(true);
  };

  // BR-152 & BR-153 Grade Override & Hold Governance
  const handleExecuteOverride = () => {
    if (!selectedInsp || !selectedInsp.id) return;

    if (!overrideReason.trim()) {
      toast.error("Audit reason required for manual grade override (BR-152)");
      return;
    }

    overrideGradeForSelectedInsp(
      { grade: overrideGradeValue as string, reason: overrideReason.trim() },
      {
        onSuccess: () => {
          toast.success(
            `Grade override saved for Roll ${selectedInsp.roll_no}. Updated grade to ${overrideGradeValue}.`,
          );
          setOpenOverrideModal(false);
        },
        onError: (err: any) => {
          toast.error(err.message || "Failed to override grade");
        },
      },
    );
  };

  const handlePrintCoi = (insp: ProductionInspection) => {
    setSelectedInsp(insp);
    setOpenCoiModal(true);
  };

  if (inspectionsLoading) {
    return (
      <AppShell
        title="Quality Assurance & Inspection (M35)"
        breadcrumb={[{ label: "Quality" }, { label: "Inspection" }]}
      >
        <Card className="rounded-md border border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading inspections...
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Quality Assurance & Inspection (M35)"
      breadcrumb={[{ label: "Quality" }, { label: "Inspection" }]}
      actions={
        <Can permission="quality:write">
          <Button size="sm" onClick={handleOpenCreate} className="h-7 gap-1 text-xs" disabled={isCreating}>
            <Plus className="size-3.5" /> New 4-Point Roll Inspection
          </Button>
        </Can>
      }
    >
      <div className="space-y-4">
        {/* KPI Bar */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Inspected Rolls</span>
                <Activity className="size-4 text-primary" />
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-foreground">
                {totalInspected} Rolls
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">4-Point scored rolls</span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Grade A Pass Rate</span>
                <Award className="size-4 text-emerald-600" />
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-emerald-600">
                {fmt(gradeAPassRate, 1)}%
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">
                Under 20.0 pts / 100 sq yd
              </span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Quality Hold Count</span>
                <ShieldAlert className="size-4 text-rose-600" />
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-rose-600">{holdCount} Rolls</p>
              <span className="text-[0.6875rem] text-muted-foreground">
                BR-153 Dispatch blocked
              </span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Total Capped Points</span>
                <span className="font-bold text-foreground font-mono">PTS</span>
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-foreground">
                {totalPointsScored} Pts
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">BR-155 4-pt/yd capped</span>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search inspections by Inspection #, Roll #, Item, Design, Loom, Operator..."
              className="pl-9 text-xs"
            />
          </div>
        </div>

        {/* Inspection Table */}
        <Card className="rounded-md border border-border">
          <CardContent className="p-0">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-muted/60 font-semibold text-muted-foreground">
                  <TableHead className="h-8">Inspection #</TableHead>
                  <TableHead className="h-8">Roll # & Quality</TableHead>
                  <TableHead className="h-8">Loom & Shift</TableHead>
                  <TableHead className="h-8 text-right">Length (yd)</TableHead>
                  <TableHead className="h-8 text-right">Width (in)</TableHead>
                  <TableHead className="h-8 text-right">Defect Count</TableHead>
                  <TableHead className="h-8 text-right">Raw Pts</TableHead>
                  <TableHead className="h-8 text-right">Capped Pts (BR-155)</TableHead>
                  <TableHead className="h-8 text-right">Pts / 100 sq yd</TableHead>
                  <TableHead className="h-8">Final Grade</TableHead>
                  <TableHead className="h-8 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInspections.map((insp) => {
                  const finalGrade = insp.manual_grade_override || insp.system_grade;
                  const isOverride = Boolean(insp.manual_grade_override);
                  return (
                    <TableRow key={insp.id} className="hover:bg-muted/40">
                      <TableCell className="py-2 font-mono font-bold text-primary">
                        {insp.inspection_no}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="font-semibold text-foreground">{insp.roll_no}</div>
                        <div className="text-[0.6875rem] text-muted-foreground">
                          {insp.item_code} (Design: {insp.design_no})
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div>
                          Loom {insp.loom_no} (Shift {insp.shift})
                        </div>
                        <div className="text-[0.6875rem] text-muted-foreground">
                          {insp.operator_name}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono font-semibold">
                        {insp.roll_length_yd} yd
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono text-muted-foreground">
                        {insp.roll_width_inch}"
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono">
                        {insp.defects.length}
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono text-muted-foreground">
                        {insp.total_raw_points}
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono font-bold text-foreground">
                        {insp.capped_points}
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono font-bold text-primary">
                        {fmt(insp.points_per_100_sq_yd, 1)}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-1">
                          <Badge className={`text-[0.625rem] ${GRADE_STYLES[finalGrade]}`}>
                            {finalGrade}
                          </Badge>
                          {isOverride && (
                            <Badge
                              variant="outline"
                              className="text-[0.5625rem] font-mono bg-amber-500/10 text-amber-700 border-amber-300"
                            >
                              Override
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePrintCoi(insp)}
                            className="size-6 p-0"
                            title="Print Certificate of Inspection (COI)"
                          >
                            <Printer className="size-3.5 text-primary" />
                          </Button>
                          <Can permission="quality:write">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenOverride(insp)}
                              className="h-6 text-[0.6875rem] gap-1 px-2"
                            >
                              <Lock className="size-3" /> Override / Hold
                            </Button>
                          </Can>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!filteredInspections.length && (
                  <TableRow>
                    <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                      No inspection records found matching search criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* New 4-Point Roll Inspection Dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-xl p-5 text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600" /> New 4-Point Roll Inspection Tool
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Roll Number *</Label>
                <Input
                  className="h-8 text-xs font-mono font-bold"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Item Code</Label>
                <Input
                  className="h-8 text-xs font-semibold"
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Design Number</Label>
                <Input
                  className="h-8 text-xs"
                  value={designNo}
                  onChange={(e) => setDesignNo(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Loom #</Label>
                <Input
                  className="h-8 text-xs font-mono"
                  value={loomNo}
                  onChange={(e) => setLoomNo(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Shift</Label>
                <Select value={shift} onValueChange={(v) => setShift(v as "A" | "B" | "C")}>
                  <SelectTrigger className="h-8 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Shift A</SelectItem>
                    <SelectItem value="B">Shift B</SelectItem>
                    <SelectItem value="C">Shift C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Roll Length (yd) *</Label>
                <Input
                  type="number"
                  className="h-8 text-xs font-mono font-bold"
                  value={rollLengthYd}
                  onChange={(e) => setRollLengthYd(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Width (inch) *</Label>
                <Input
                  type="number"
                  className="h-8 text-xs font-mono font-bold"
                  value={rollWidthInch}
                  onChange={(e) => setRollWidthInch(e.target.value)}
                />
              </div>
            </div>

            {/* Visual Defect Map Entry Grid */}
            <div className="space-y-2 border border-border rounded-lg p-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-primary">
                  Visual Defect Map & Points Logger
                </Label>
                <span className="text-[0.625rem] text-muted-foreground">
                  BR-155: Max 4 pts/linear yard cap applied automatically
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label className="text-[0.6875rem]">Defect Type</Label>
                  <Select
                    value={newDefectType}
                    onValueChange={(v) => setNewDefectType(v as DefectType)}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weft_slub">Weft Slub (1-3 pts)</SelectItem>
                      <SelectItem value="warp_float">Warp Float (2-4 pts)</SelectItem>
                      <SelectItem value="broken_end">Broken End (3 pts)</SelectItem>
                      <SelectItem value="oil_stain">Oil Stain (4 pts)</SelectItem>
                      <SelectItem value="hole">Hole / Cut (4 pts)</SelectItem>
                      <SelectItem value="tension_variation">Tension Variation (2 pts)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[0.6875rem]">Size (Inches)</Label>
                  <Input
                    type="number"
                    className="h-7 text-xs font-mono"
                    value={newDefectSize}
                    onChange={(e) => setNewDefectSize(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[0.6875rem]">Yard Position</Label>
                  <Input
                    type="number"
                    className="h-7 text-xs font-mono"
                    value={newDefectYard}
                    onChange={(e) => setNewDefectYard(e.target.value)}
                  />
                </div>

                <div className="space-y-1 pt-4">
                  <Button
                    size="sm"
                    onClick={handleAddDefectToForm}
                    className="h-7 w-full text-xs gap-1"
                  >
                    <Plus className="size-3" /> Add Defect
                  </Button>
                </div>
              </div>

              {/* Logged Defect Table */}
              <div className="max-h-32 overflow-y-auto rounded border border-border bg-card p-2 space-y-1">
                {defectsForm.map((d, idx) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between text-[0.6875rem] font-mono py-1 px-2 border-b border-border/40 last:border-0"
                  >
                    <div>
                      #{idx + 1}{" "}
                      <span className="font-semibold text-foreground capitalize">
                        {d.defect_type.replace(/_/g, " ")}
                      </span>{" "}
                      at Yard {d.yard_position} (Size: {d.size_inches}")
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="text-[0.5625rem] bg-amber-500 text-black">
                        {d.points_scored} Pts
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveDefectFromForm(d.id)}
                        className="size-5 p-0 text-rose-600 hover:text-rose-700"
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                ))}
                {!defectsForm.length && (
                  <p className="text-center py-2 text-muted-foreground text-[0.6875rem]">
                    No defects logged for this roll.
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => setOpenCreate(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateInspection}>
              Save 4-Point Inspection Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grade Override & Hold Modal (BR-152 & BR-153) */}
      <Dialog open={openOverrideModal} onOpenChange={setOpenOverrideModal}>
        <DialogContent className="max-w-md p-5 text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Lock className="size-4 text-amber-600" /> Grade Override & Quality Hold Governance
              (BR-152 / BR-153)
            </DialogTitle>
          </DialogHeader>
          {selectedInsp && (
            <div className="space-y-3 py-2">
              <div className="rounded border border-border bg-muted/30 p-2.5 font-mono text-xs space-y-1">
                <div className="font-bold text-primary">
                  Roll #: {selectedInsp.roll_no} (Inspection {selectedInsp.inspection_no})
                </div>
                <div>
                  System Computed Grade:{" "}
                  <span className="font-bold text-foreground">{selectedInsp.system_grade}</span> (
                  {selectedInsp.points_per_100_sq_yd} pts/100 sq yd)
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Supervisor Override Grade</Label>
                <Select
                  value={overrideGradeValue}
                  onValueChange={(v) => setOverrideGradeValue(v as QualityGrade)}
                >
                  <SelectTrigger className="h-8 text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Grade A">Grade A (Pass)</SelectItem>
                    <SelectItem value="Grade B">Grade B (Second)</SelectItem>
                    <SelectItem value="Grade C">Grade C (Sub-Standard)</SelectItem>
                    <SelectItem value="Hold">Hold (BR-153 Dispatch Blocked)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Mandatory Audit Reason (BR-152) *</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="e.g. Lab dip shade variance verified by QC supervisor"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => setOpenOverrideModal(false)}>
              Cancel
            </Button>
            <Can permission="quality:write">
              <Button size="sm" onClick={handleExecuteOverride}>
                Save Grade Override
              </Button>
            </Can>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Certificate of Inspection (COI) Printable Modal */}
      <Dialog open={openCoiModal} onOpenChange={setOpenCoiModal}>
        <DialogContent className="max-w-md p-5 text-xs text-center">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center justify-center gap-2">
              <Award className="size-4 text-emerald-600" /> Certificate of Inspection (COI)
            </DialogTitle>
          </DialogHeader>
          {selectedInsp && (
            <div className="space-y-3 py-3 border border-border rounded-lg bg-muted/20 p-4 text-left font-mono">
              <div className="flex justify-between items-center border-b border-border pb-2">
                <div>
                  <h4 className="font-bold text-sm text-foreground">WEAVEONE TEXTILES</h4>
                  <p className="text-[0.625rem] text-muted-foreground">
                    Official Quality Inspection Report
                  </p>
                </div>
                <Badge
                  className={`text-[0.625rem] ${GRADE_STYLES[selectedInsp.manual_grade_override || selectedInsp.system_grade]}`}
                >
                  {selectedInsp.manual_grade_override || selectedInsp.system_grade}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[0.6875rem]">
                <div>
                  Inspection #: <strong>{selectedInsp.inspection_no}</strong>
                </div>
                <div>
                  Roll #: <strong>{selectedInsp.roll_no}</strong>
                </div>
                <div>
                  Item Code: <strong>{selectedInsp.item_code}</strong>
                </div>
                <div>
                  Design #: <strong>{selectedInsp.design_no}</strong>
                </div>
                <div>
                  Length: <strong>{selectedInsp.roll_length_yd} yd</strong>
                </div>
                <div>
                  Width: <strong>{selectedInsp.roll_width_inch} in</strong>
                </div>
                <div>
                  Capped Pts: <strong>{selectedInsp.capped_points}</strong>
                </div>
                <div>
                  Pts/100 sq yd: <strong>{selectedInsp.points_per_100_sq_yd}</strong>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="justify-center pt-1">
            <Button size="sm" className="gap-1 text-xs" onClick={() => window.print()}>
              <Printer className="size-3.5" /> Print Official COI
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
