// @ts-nocheck
import { useState, useMemo } from "react";
import {
  Plus,
  Search,
  Edit,
  Power,
  Trash2,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { fmt } from "@/lib/costing";
import {
  useYarnMaterials,
  useCreateYarnMaterial,
  useUpdateYarnMaterial,
  useSetYarnMaterialStatus,
  useDeleteYarnMaterial,
  useNextYarnCode,
} from "@/hooks/useYarnMaterials";
import { formatServiceError } from "@/lib/master-codes";
import { yarnFormToPayload } from "@/components/master-form-payloads";

type SortField = "code" | "name" | "denier" | "rate_per_kg" | "remarks" | "active";
type SortOrder = "asc" | "desc" | null;

export function YarnMasterView() {
  // State declarations
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingYarn, setEditingYarn] = useState<any | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    denier: "",
    rate_per_kg: "",
    remark: "",
    status: "Active",
  });
  const [errors, setErrors] = useState<{
    name?: string;
    denier?: string;
    rate_per_kg?: string;
  }>({});
  const [statusTarget, setStatusTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteBlockedMsg, setDeleteBlockedMsg] = useState<string | null>(null);

  // Query hooks
  // Rows are canonical materials records (active: boolean, remarks); filtering is client-side
  // so the record count badge can show "n of total".
  const { data: allYarns = [], isLoading: yarnsLoading } = useYarnMaterials();
  const { data: nextCode, isFetching: nextCodeLoading } = useNextYarnCode(formOpen && !editingYarn);

  // Mutation hooks
  const createMutation = useCreateYarnMaterial();
  const updateMutation = useUpdateYarnMaterial(editingYarn?.id || "dummy");
  const setStatusMutation = useSetYarnMaterialStatus(statusTarget?.id || "dummy");
  const deleteMutation = useDeleteYarnMaterial(deleteTarget?.id || "dummy");
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Cycle column sorting: Default -> Ascending -> Descending -> Default
  const handleSort = (field: SortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortOrder("asc");
    } else if (sortOrder === "asc") {
      setSortOrder("desc");
    } else if (sortOrder === "desc") {
      setSortField(null);
      setSortOrder(null);
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Render Sort Indicator Icon
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field || !sortOrder) {
      return <ArrowUpDown className="ml-1 inline size-3 text-muted-foreground/50" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-1 inline size-3 text-primary font-bold" />
    ) : (
      <ArrowDown className="ml-1 inline size-3 text-primary font-bold" />
    );
  };

  // Search & Filter & Sort Logic
  const filteredAndSortedRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    let result = allYarns.filter((item: any) => {
      // Status Filter
      if (statusFilter === "Active" && item.active !== true) return false;
      if (statusFilter === "Inactive" && item.active !== false) return false;

      // Search Query Filter
      if (!q) return true;
      const codeMatch = item.code.toLowerCase().includes(q);
      const nameMatch = item.name.toLowerCase().includes(q);
      const denierMatch = String(item.denier || "").includes(q);
      const remarkMatch = (item.remarks || "").toLowerCase().includes(q);

      return codeMatch || nameMatch || denierMatch || remarkMatch;
    });

    // Column Sorting
    if (sortField && sortOrder) {
      result = [...result].sort((a: any, b: any) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];

        // Numeric Sorting for denier & rate_per_kg
        if (sortField === "denier" || sortField === "rate_per_kg") {
          valA = Number(valA || 0);
          valB = Number(valB || 0);
        } else if (sortField === "remarks") {
          valA = String(valA || "").toLowerCase();
          valB = String(valB || "").toLowerCase();
        } else if (sortField === "code") {
          // Custom Code sorting (e.g. Y-01, Y-02, Y-100)
          const numA = parseInt(String(valA).replace(/\D/g, "") || "0", 10);
          const numB = parseInt(String(valB).replace(/\D/g, "") || "0", 10);
          valA = numA;
          valB = numB;
        } else if (typeof valA === "string") {
          valA = valA.toLowerCase();
          valB = String(valB).toLowerCase();
        }

        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [allYarns, search, statusFilter, sortField, sortOrder]);

  // Handle Open Create
  const handleOpenCreate = () => {
    setEditingYarn(null);
    setForm({
      code: "",
      name: "",
      denier: "",
      rate_per_kg: "",
      remark: "",
      status: "Active",
    });
    setErrors({});
    setFormOpen(true);
  };

  // Handle Open Edit
  const handleOpenEdit = (yarn: any) => {
    setEditingYarn(yarn);
    setForm({
      code: yarn.code,
      name: yarn.name,
      denier: String(yarn.denier ?? ""),
      rate_per_kg: String(yarn.rate_per_kg ?? ""),
      remark: yarn.remarks || "",
      status: yarn.active ? "Active" : "Inactive",
    });
    setErrors({});
    setFormOpen(true);
  };

  // Handle Form Submit
  const handleSave = () => {
    const trimmedName = form.name.trim();
    const newErrors: typeof errors = {};

    if (!trimmedName) {
      newErrors.name = "Yarn Name is required";
    }

    if (form.denier !== "" && (isNaN(Number(form.denier)) || Number(form.denier) < 0)) {
      newErrors.denier = "Denier cannot be negative";
    }

    if (
      form.rate_per_kg !== "" &&
      (isNaN(Number(form.rate_per_kg)) || Number(form.rate_per_kg) < 0)
    ) {
      newErrors.rate_per_kg = "Rate cannot be negative";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload = yarnFormToPayload(form);

    if (editingYarn?.id) {
      updateMutation.mutate(payload, {
        onSuccess: (saved) => {
          setFormOpen(false);
          toast.success(`Yarn ${saved.code} updated successfully!`);
        },
        onError: (error) => {
          toast.error(`Unable to update Yarn: ${formatServiceError(error)}`);
        },
      });
    } else {
      // A blank code lets the service assign the next sequential code.
      // No code is sent: the service assigns the next sequential code at save time.
      createMutation.mutate(payload, {
        onSuccess: (saved) => {
          setFormOpen(false);
          toast.success(`Yarn ${saved.code} created successfully!`);
        },
        onError: (error) => {
          toast.error(`Unable to create Yarn: ${formatServiceError(error)}`);
        },
      });
    }
  };

  // Handle Status Toggle
  const handleConfirmStatusToggle = () => {
    if (!statusTarget || !setStatusMutation) return;

    const newStatus = statusTarget.active ? "Inactive" : "Active";
    setStatusMutation.mutate(newStatus, {
      onSuccess: () => {
        toast.success(
          `Yarn ${statusTarget.code} has been ${newStatus === "Active" ? "activated" : "deactivated"}`,
        );
        setStatusTarget(null);
      },
      onError: (error) => {
        toast.error(`Unable to change Yarn status: ${formatServiceError(error)}`);
      },
    });
  };

  // Handle Delete Click
  const handleDeleteClick = (yarn: any) => {
    setDeleteTarget(yarn);
    // TODO: Check if yarn is used in cost sheets
    setDeleteBlockedMsg(null);
  };

  // Handle Confirm Delete
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success(`Yarn ${deleteTarget.code} deleted successfully`);
        setDeleteTarget(null);
        setDeleteBlockedMsg(null);
      },
      onError: (error) => {
        toast.error(`Unable to delete Yarn: ${formatServiceError(error)}`);
      },
    });
  };

  if (yarnsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Loading yarns...</p>
      </div>
    );
  }

  return (
    <AppShell
      title="Yarn Master"
      breadcrumb={[{ label: "Masters" }, { label: "Yarn" }]}
      actions={
        <Button onClick={handleOpenCreate} size="sm" className="h-7 gap-1 text-xs">
          <Plus className="size-3.5" /> New Yarn
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Search, Filter & Record Count Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
          <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[260px]">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Yarn by code, name, denier, remark..."
                className="pl-9 text-xs"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All
                </SelectItem>
                <SelectItem value="Active" className="text-xs">
                  Active
                </SelectItem>
                <SelectItem value="Inactive" className="text-xs">
                  Inactive
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Badge variant="secondary" className="text-xs font-medium">
            {filteredAndSortedRows.length === allYarns.length
              ? `${allYarns.length} Yarn Records`
              : `${filteredAndSortedRows.length} of ${allYarns.length} Yarn Records`}
          </Badge>
        </div>

        {/* Yarn Master Table */}
        <Card className="rounded-md border border-border">
          <CardContent className="p-0">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-muted/60 font-semibold text-muted-foreground">
                  <TableHead
                    className="h-8 w-28 cursor-pointer select-none"
                    onClick={() => handleSort("code")}
                  >
                    Code {renderSortIcon("code")}
                  </TableHead>
                  <TableHead
                    className="h-8 cursor-pointer select-none"
                    onClick={() => handleSort("name")}
                  >
                    Name {renderSortIcon("name")}
                  </TableHead>
                  <TableHead
                    className="h-8 w-24 text-right cursor-pointer select-none"
                    onClick={() => handleSort("denier")}
                  >
                    Denier {renderSortIcon("denier")}
                  </TableHead>
                  <TableHead
                    className="h-8 w-32 text-right cursor-pointer select-none"
                    onClick={() => handleSort("rate_per_kg")}
                  >
                    Rate / kg {renderSortIcon("rate_per_kg")}
                  </TableHead>
                  <TableHead
                    className="h-8 cursor-pointer select-none"
                    onClick={() => handleSort("remarks")}
                  >
                    Remark {renderSortIcon("remarks")}
                  </TableHead>
                  <TableHead
                    className="h-8 w-28 cursor-pointer select-none"
                    onClick={() => handleSort("active")}
                  >
                    Status {renderSortIcon("active")}
                  </TableHead>
                  <TableHead className="h-8 w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedRows.map((item: any) => (
                  <TableRow key={item.id} className="hover:bg-muted/40">
                    <TableCell className="num py-2 font-mono font-bold text-primary">
                      {item.code}
                    </TableCell>
                    <TableCell className="py-2 font-semibold text-foreground">
                      {item.name}
                    </TableCell>
                    <TableCell className="num py-2 text-right font-mono">
                      {item.denier ? fmt(item.denier, 0) : "—"}
                    </TableCell>
                    <TableCell className="num py-2 text-right font-mono font-bold text-foreground">
                      ₹{fmt(item.rate_per_kg || 0, 2)}
                    </TableCell>
                    <TableCell className="py-2 text-muted-foreground max-w-[200px] truncate">
                      {item.remarks || "—"}
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge
                        variant={item.active ? "default" : "secondary"}
                        className={`text-[0.625rem] capitalize ${
                          item.active
                            ? "bg-teal-600 hover:bg-teal-700 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {item.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-foreground"
                          title="Edit Yarn"
                          onClick={() => handleOpenEdit(item)}
                        >
                          <Edit className="size-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className={`size-7 ${
                            item.active
                              ? "text-muted-foreground hover:text-amber-600"
                              : "text-teal-600 hover:text-teal-700"
                          }`}
                          title={item.active ? "Deactivate" : "Activate"}
                          onClick={() => setStatusTarget(item)}
                        >
                          <Power className="size-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          title="Delete Yarn"
                          onClick={() => handleDeleteClick(item)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {!filteredAndSortedRows.length && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      <Layers className="mx-auto size-8 text-muted-foreground/30 mb-2" />
                      <p className="text-xs font-semibold">No Yarn records found.</p>
                      <p className="text-[0.6875rem] text-muted-foreground mt-0.5">
                        Click "+ New Yarn" to add an entry.
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* New / Edit Yarn Modal Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md p-6 text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              {editingYarn ? `Edit Yarn — ${editingYarn.code}` : "New Yarn"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            {/* Yarn Code (Read-Only) */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Yarn Code (Auto)</Label>
              <Input
                readOnly
                disabled
                className="h-8 text-xs font-mono font-bold bg-muted/50 cursor-not-allowed"
                value={editingYarn ? form.code : nextCodeLoading ? "Generating…" : (nextCode ?? "")}
              />
              <p className="text-[0.6875rem] text-muted-foreground">
                {editingYarn
                  ? "The Yarn Code does not change when editing."
                  : "Sequential Yarn Code is generated automatically when you save. The value shown is a preview and may change if another yarn is saved first."}
              </p>
            </div>

            {/* Yarn Name */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Name *</Label>
              <Input
                className={`h-8 text-xs font-semibold ${
                  errors.name ? "border-destructive focus-visible:ring-destructive" : ""
                }`}
                placeholder="e.g. 140 NYLON, 150 LICHI DYED"
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  if (errors.name) {
                    const { name, ...rest } = errors;
                    setErrors(rest);
                  }
                }}
              />
              {errors.name && (
                <p className="text-[0.6875rem] font-medium text-destructive">{errors.name}</p>
              )}
            </div>

            {/* Denier & Rate / kg */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Denier</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  className={`num h-8 text-xs font-mono ${
                    errors.denier ? "border-destructive" : ""
                  }`}
                  placeholder="e.g. 145"
                  value={form.denier}
                  onChange={(e) => {
                    setForm({ ...form, denier: e.target.value });
                    if (errors.denier) {
                      const { denier, ...rest } = errors;
                      setErrors(rest);
                    }
                  }}
                />
                {errors.denier && (
                  <p className="text-[0.6875rem] font-medium text-destructive">{errors.denier}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Rate / kg (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  className={`num h-8 text-xs font-mono ${
                    errors.rate_per_kg ? "border-destructive" : ""
                  }`}
                  placeholder="e.g. 210.00"
                  value={form.rate_per_kg}
                  onChange={(e) => {
                    setForm({ ...form, rate_per_kg: e.target.value });
                    if (errors.rate_per_kg) {
                      const { rate_per_kg, ...rest } = errors;
                      setErrors(rest);
                    }
                  }}
                />
                {errors.rate_per_kg && (
                  <p className="text-[0.6875rem] font-medium text-destructive">
                    {errors.rate_per_kg}
                  </p>
                )}
              </div>
            </div>

            {/* Remark */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Remark</Label>
              <Textarea
                className="text-xs min-h-[60px] resize-none"
                placeholder="Preferred supplier, special quality specs..."
                value={form.remark}
                onChange={(e) => setForm({ ...form, remark: e.target.value })}
              />
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active" className="text-xs">
                    Active
                  </SelectItem>
                  <SelectItem value="Inactive" className="text-xs">
                    Inactive
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-border pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFormOpen(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSubmitting}
              className="h-8 text-xs font-semibold"
            >
              {isSubmitting ? "Saving..." : "Save Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Status Toggle (Activate / Deactivate) */}
      <AlertDialog
        open={Boolean(statusTarget)}
        onOpenChange={(open) => !open && setStatusTarget(null)}
      >
        <AlertDialogContent className="max-w-sm text-xs">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold flex items-center gap-2">
              <Power className="size-4 text-amber-500" />
              {statusTarget?.active
                ? `Deactivate Yarn ${statusTarget?.code}?`
                : `Activate Yarn ${statusTarget?.code}?`}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground mt-1">
              {statusTarget?.active
                ? `Are you sure you want to deactivate Yarn ${statusTarget?.code} (${statusTarget?.name})? It will remain stored for history but hidden from default selections.`
                : `Are you sure you want to activate Yarn ${statusTarget?.code} (${statusTarget?.name})?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-4">
            <AlertDialogCancel className="h-8 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmStatusToggle}
              className={`h-8 text-xs font-semibold ${
                statusTarget?.active
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-teal-600 hover:bg-teal-700 text-white"
              }`}
            >
              {statusTarget?.active ? "Deactivate" : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation & Referential Integrity Alert Dialog for Delete */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteBlockedMsg(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md text-xs">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-4" />
              {deleteBlockedMsg
                ? `Cannot Delete ${deleteTarget?.code}`
                : `Delete Yarn ${deleteTarget?.code}?`}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground mt-2 font-normal">
              {deleteBlockedMsg ? (
                <span className="block p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/20 font-medium">
                  {deleteBlockedMsg}
                </span>
              ) : (
                <>
                  Are you sure you want to permanently delete{" "}
                  <strong>
                    {deleteTarget?.code} — {deleteTarget?.name}
                  </strong>
                  ? <br />
                  <span className="text-destructive font-semibold">
                    This action cannot be undone.
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="gap-2 mt-4">
            <AlertDialogCancel className="h-8 text-xs">
              {deleteBlockedMsg ? "Close" : "Cancel"}
            </AlertDialogCancel>
            {!deleteBlockedMsg && (
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="h-8 text-xs font-semibold bg-destructive hover:bg-destructive/90 text-white"
              >
                Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
