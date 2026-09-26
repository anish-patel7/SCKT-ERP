// @ts-nocheck
import { useState, useMemo } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Power,
  Building2,
  MapPin,
  PhoneCall,
  AlertTriangle,
  Check,
  X,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useWarehouses,
  useCreateWarehouse,
  useUpdateWarehouse,
  useSetWarehouseStatus,
  useNextWarehouseCode,
} from "@/hooks/useWarehouses";
import { formatServiceError } from "@/lib/master-codes";
import { warehouseFormToPayload } from "@/components/master-form-payloads";
import { WAREHOUSE_TYPES } from "@/services/warehouses";

type SortField = "warehouse_code" | "warehouse_name" | "warehouse_type" | "city" | "status";
type SortOrder = "asc" | "desc";

export function WarehouseMasterView() {
  // State declarations
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("warehouse_code");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWh, setEditingWh] = useState<any | null>(null);
  const [formData, setFormData] = useState<Partial<any>>({});
  const [statusToggleTarget, setStatusToggleTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteBlockedMsg, setDeleteBlockedMsg] = useState<string | null>(null);
  const [locationsWh, setLocationsWh] = useState<any | null>(null);
  const [newLocName, setNewLocName] = useState("");
  const [newLocDesc, setNewLocDesc] = useState("");
  const [editingLocId, setEditingLocId] = useState<string | null>(null);

  // Query hooks
  const { data: allWarehouses = [], isLoading: warehousesLoading } = useWarehouses(true);

  // Mutation hooks - using dummy IDs for now
  const createMutation = useCreateWarehouse();
  const updateMutation = useUpdateWarehouse(editingWh?.id || "dummy");
  const setStatusMutation = useSetWarehouseStatus(statusToggleTarget?.id || "dummy");
  const { data: nextCode, isFetching: nextCodeLoading } = useNextWarehouseCode(
    isModalOpen && !editingWh,
  );

  // Handle Open Create
  const handleOpenCreate = () => {
    setEditingWh(null);
    setFormData({
      warehouse_code: "",
      warehouse_name: "",
      warehouse_type: "General",
      warehouse_type_other: "",
      address_line1: "",
      address_line2: "",
      area: "",
      city: "Surat",
      district: "Surat",
      state: "Gujarat",
      pincode: "",
      country: "India",
      contact_person: "",
      mobile: "",
      phone: "",
      email: "",
      remarks: "",
      status: "Active",
    });
    setIsModalOpen(true);
  };

  // Handle Open Edit
  const handleOpenEdit = (wh: any) => {
    setEditingWh(wh);
    setFormData({ ...wh, pincode: wh.pin_code ?? "" });
    setIsModalOpen(true);
  };

  // Handle Form Submit
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.warehouse_name?.trim()) {
      toast.error("Warehouse Name is required");
      return;
    }
    if (!formData.warehouse_type) {
      toast.error("Warehouse Type is required");
      return;
    }

    // On create no code is sent: the service assigns the next sequential code at save time.
    const payload = warehouseFormToPayload(formData, Boolean(editingWh));

    if (editingWh?.id) {
      updateMutation.mutate(payload, {
        onSuccess: (saved) => {
          setIsModalOpen(false);
          toast.success(`Warehouse ${saved.warehouse_code} updated successfully!`);
        },
        onError: (error) => {
          toast.error(`Unable to update Warehouse: ${formatServiceError(error)}`);
        },
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: (saved) => {
          setIsModalOpen(false);
          toast.success(`Warehouse ${saved.warehouse_code} created successfully!`);
        },
        onError: (error) => {
          toast.error(`Unable to create Warehouse: ${formatServiceError(error)}`);
        },
      });
    }
  };

  // Handle Status Toggle
  const handleConfirmStatusToggle = () => {
    if (!statusToggleTarget || !setStatusMutation) return;

    const newStatus = statusToggleTarget.status === "Active" ? "Inactive" : "Active";
    setStatusMutation.mutate(newStatus, {
      onSuccess: () => {
        toast.success(`Warehouse ${statusToggleTarget.warehouse_code} is now ${newStatus}`);
        setStatusToggleTarget(null);
      },
      onError: (error) => {
        toast.error(`Unable to change Warehouse status: ${formatServiceError(error)}`);
      },
    });
  };

  // Handle Delete Click
  const handleDeleteClick = (wh: any) => {
    setDeleteTarget(wh);
    // TODO: Check if warehouse is referenced in inventory
    setDeleteBlockedMsg(null);
  };

  // Handle Confirm Delete
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    toast.info("Delete functionality to be implemented via service layer");
    setDeleteTarget(null);
  };

  // Handle Sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Filtered & Sorted Warehouses
  const processedWarehouses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = allWarehouses.filter((wh: any) => {
      if (statusFilter !== "all" && wh.status !== statusFilter) return false;
      if (typeFilter !== "all" && wh.warehouse_type !== typeFilter) return false;

      if (!q) return true;

      return (
        wh.warehouse_code?.toLowerCase().includes(q) ||
        wh.warehouse_name?.toLowerCase().includes(q) ||
        wh.warehouse_type?.toLowerCase().includes(q) ||
        wh.city?.toLowerCase().includes(q) ||
        wh.state?.toLowerCase().includes(q) ||
        wh.contact_person?.toLowerCase().includes(q)
      );
    });

    return filtered.sort((a: any, b: any) => {
      let valA: any = a[sortField] || "";
      let valB: any = b[sortField] || "";

      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [allWarehouses, searchQuery, statusFilter, typeFilter, sortField, sortOrder]);

  if (warehousesLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Loading warehouses...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Action Bar & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search Warehouse by code, name, type, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1 rounded-md border border-border bg-muted/40 p-1">
            {(["all", "Active", "Inactive"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                  statusFilter === st
                    ? "bg-background text-primary shadow-sm border border-border/60"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {st === "all" ? "All" : st}
                <Badge
                  variant={statusFilter === st ? "default" : "secondary"}
                  className="ml-1.5 px-1 py-0 text-[0.625rem]"
                >
                  {st === "all"
                    ? allWarehouses.length
                    : allWarehouses.filter((w: any) => w.status === st).length}
                </Badge>
              </button>
            ))}
          </div>

          {/* Type Dropdown Filter */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px] h-8 text-xs font-medium bg-background">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {WAREHOUSE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button size="sm" onClick={handleOpenCreate} className="h-8 gap-1 text-xs font-semibold">
          <Plus className="size-3.5" /> New Warehouse
        </Button>
      </div>

      {/* Warehouses Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 text-xs hover:bg-muted/60">
              <TableHead
                className="cursor-pointer font-bold text-foreground hover:text-primary"
                onClick={() => handleSort("warehouse_code")}
              >
                <div className="flex items-center gap-1">
                  Code
                  {sortField === "warehouse_code" && (
                    <span className="text-primary">{sortOrder === "asc" ? "↑" : "↓"}</span>
                  )}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer font-bold text-foreground hover:text-primary"
                onClick={() => handleSort("warehouse_name")}
              >
                <div className="flex items-center gap-1">
                  Warehouse Name
                  {sortField === "warehouse_name" && (
                    <span className="text-primary">{sortOrder === "asc" ? "↑" : "↓"}</span>
                  )}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer font-bold text-foreground hover:text-primary"
                onClick={() => handleSort("warehouse_type")}
              >
                <div className="flex items-center gap-1">
                  Type
                  {sortField === "warehouse_type" && (
                    <span className="text-primary">{sortOrder === "asc" ? "↑" : "↓"}</span>
                  )}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer font-bold text-foreground hover:text-primary"
                onClick={() => handleSort("city")}
              >
                <div className="flex items-center gap-1">
                  City
                  {sortField === "city" && (
                    <span className="text-primary">{sortOrder === "asc" ? "↑" : "↓"}</span>
                  )}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer text-center font-bold text-foreground hover:text-primary"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center justify-center gap-1">
                  Status
                  {sortField === "status" && (
                    <span className="text-primary">{sortOrder === "asc" ? "↑" : "↓"}</span>
                  )}
                </div>
              </TableHead>
              <TableHead className="text-right font-bold text-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-xs">
            {processedWarehouses.map((wh: any) => (
              <TableRow key={wh.id} className="hover:bg-muted/40 transition-colors">
                <TableCell className="font-mono font-bold text-primary">
                  <Badge
                    variant="outline"
                    className="font-mono font-bold text-xs bg-primary/10 text-primary border-primary/30"
                  >
                    {wh.warehouse_code}
                  </Badge>
                </TableCell>

                <TableCell className="font-semibold text-foreground">
                  <div>
                    <p className="font-semibold text-foreground">{wh.warehouse_name}</p>
                    {wh.address_line1 && (
                      <p className="text-[0.6875rem] text-muted-foreground font-normal truncate max-w-xs">
                        {wh.address_line1} {wh.area ? `· ${wh.area}` : ""}
                      </p>
                    )}
                  </div>
                </TableCell>

                <TableCell>
                  <Badge variant="outline" className="text-[0.6875rem] font-sans">
                    {wh.warehouse_type}
                  </Badge>
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {wh.city || "—"}
                  {wh.state ? `, ${wh.state}` : ""}
                </TableCell>

                <TableCell className="text-center">
                  <Badge
                    variant="outline"
                    className={`text-[0.6875rem] font-semibold ${
                      wh.status === "Active"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {wh.status}
                  </Badge>
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-primary"
                      onClick={() => handleOpenEdit(wh)}
                      title="Edit Warehouse"
                    >
                      <Edit className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`size-7 ${
                        wh.status === "Active"
                          ? "text-muted-foreground hover:text-amber-600"
                          : "text-muted-foreground hover:text-emerald-600"
                      }`}
                      onClick={() => setStatusToggleTarget(wh)}
                      title={wh.status === "Active" ? "Deactivate Warehouse" : "Activate Warehouse"}
                    >
                      <Power className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteClick(wh)}
                      title="Delete Warehouse"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {!processedWarehouses.length && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  <p className="text-xs font-semibold">
                    No Warehouse records found matching criteria.
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Warehouse Form Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl text-xs max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              {editingWh ? `Edit Warehouse — ${formData.warehouse_code}` : "New Warehouse"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-4 pt-2">
            {/* Basic Information */}
            <div className="space-y-3 rounded-lg border border-border bg-card p-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                1. Basic Information
              </h4>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Warehouse Code (Auto)</Label>
                  <Input
                    value={
                      editingWh
                        ? formData.warehouse_code || ""
                        : nextCodeLoading
                          ? "Generating…"
                          : (nextCode ?? "")
                    }
                    readOnly
                    className="h-8 text-xs font-mono font-bold bg-muted text-primary cursor-not-allowed"
                  />
                  {!editingWh && (
                    <p className="text-[0.6875rem] text-muted-foreground">
                      Preview; the final code is assigned when you save.
                    </p>
                  )}
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-medium">Warehouse Name *</Label>
                  <Input
                    placeholder="e.g. Main Factory Warehouse"
                    value={formData.warehouse_name || ""}
                    onChange={(e) => setFormData({ ...formData, warehouse_name: e.target.value })}
                    className="h-8 text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Warehouse Type *</Label>
                  <Select
                    value={formData.warehouse_type || ""}
                    onValueChange={(v) => setFormData({ ...formData, warehouse_type: v })}
                  >
                    <SelectTrigger className="h-8 text-xs font-medium">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {WAREHOUSE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Status *</Label>
                  <Select
                    value={formData.status || ""}
                    onValueChange={(v) => setFormData({ ...formData, status: v })}
                  >
                    <SelectTrigger className="h-8 text-xs font-medium">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Address Details */}
            <div className="space-y-3 rounded-lg border border-border bg-card p-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="size-3.5 text-primary" /> 2. Address & Location Details
              </h4>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Address Line 1</Label>
                  <Input
                    placeholder="Street / Estate / Plot No."
                    value={formData.address_line1 || ""}
                    onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Address Line 2</Label>
                  <Input
                    placeholder="Building / Landmark"
                    value={formData.address_line2 || ""}
                    onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">City</Label>
                  <Input
                    placeholder="e.g. Surat"
                    value={formData.city || ""}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">State</Label>
                  <Input
                    placeholder="e.g. Gujarat"
                    value={formData.state || ""}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Pincode</Label>
                  <Input
                    placeholder="e.g. 395006"
                    value={formData.pincode || ""}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Contact Details */}
            <div className="space-y-3 rounded-lg border border-border bg-card p-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <PhoneCall className="size-3.5 text-primary" /> 3. Contact Details
              </h4>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Contact Person</Label>
                  <Input
                    placeholder="e.g. Store Manager"
                    value={formData.contact_person || ""}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Mobile</Label>
                  <Input
                    placeholder="e.g. 9825000000"
                    value={formData.mobile || ""}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Phone</Label>
                  <Input
                    placeholder="e.g. 0261-2345678"
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Email</Label>
                  <Input
                    type="email"
                    placeholder="e.g. warehouse@company.com"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Remarks</Label>
              <Textarea
                rows={2}
                placeholder="Additional notes for this warehouse..."
                value={formData.remarks || ""}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="text-xs"
              />
            </div>

            <DialogFooter className="gap-2 pt-2 border-t border-border mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="h-8 text-xs font-semibold gap-1"
              >
                <Check className="size-3.5" />
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : editingWh
                    ? "Save Warehouse"
                    : "Create Warehouse"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Status Toggle Confirmation */}
      <AlertDialog
        open={Boolean(statusToggleTarget)}
        onOpenChange={(open) => !open && setStatusToggleTarget(null)}
      >
        {statusToggleTarget && (
          <AlertDialogContent className="max-w-md text-xs">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-sm font-bold flex items-center gap-2">
                <Power className="size-4 text-primary" />
                {statusToggleTarget.status === "Active"
                  ? `Deactivate Warehouse ${statusToggleTarget.warehouse_code}?`
                  : `Activate Warehouse ${statusToggleTarget.warehouse_code}?`}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground mt-2">
                {statusToggleTarget.status === "Active"
                  ? "The Warehouse will no longer be available for new transactions."
                  : "The Warehouse will become available for new transactions."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 mt-4">
              <AlertDialogCancel className="h-8 text-xs">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmStatusToggle}
                className={`h-8 text-xs font-semibold ${
                  statusToggleTarget.status === "Active"
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
              >
                {statusToggleTarget.status === "Active" ? "Deactivate" : "Activate"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteBlockedMsg(null);
          }
        }}
      >
        {deleteTarget && (
          <AlertDialogContent className="max-w-md text-xs">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-sm font-bold flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-4" />
                {deleteBlockedMsg
                  ? `Cannot Delete Warehouse ${deleteTarget.warehouse_code}`
                  : `Delete Warehouse ${deleteTarget.warehouse_code}?`}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground mt-2">
                {deleteBlockedMsg ? (
                  <span className="block p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/20 font-medium">
                    {deleteBlockedMsg}
                  </span>
                ) : (
                  <>
                    Are you sure you want to permanently delete{" "}
                    <strong>
                      {deleteTarget.warehouse_code} — {deleteTarget.warehouse_name}
                    </strong>
                    ?
                    <br />
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
        )}
      </AlertDialog>
    </div>
  );
}
