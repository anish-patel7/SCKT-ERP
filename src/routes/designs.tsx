import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import {
  Search,
  Plus,
  LayoutGrid,
  Table as TableIcon,
  Eye,
  Edit,
  Copy,
  Trash2,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";

import type { DesignWithDetails, DesignFilter } from "@/types/design";
import {
  getErrorMessage,
  useSearchDesigns,
  useArchiveDesign,
  useCloneDesign,
} from "@/hooks/useDesigns";
import { DesignEntry } from "@/components/design-entry";

export const Route = createFileRoute("/designs")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Designs — SCKT ERP" },
      {
        name: "description",
        content:
          "Design repository & technical specification in SCKT ERP, the textile fabric costing and manufacturing ERP platform.",
      },
      { property: "og:title", content: "Designs — SCKT ERP" },
      {
        property: "og:description",
        content: "Design repository & technical specification for textile weaving operations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DesignsPage,
});

function DesignsPage() {
  // Navigation & View Mode State
  const [viewMode, setViewMode] = useState<"gallery" | "table">("gallery");
  const [activeScreen, setActiveScreen] = useState<"list" | "entry">("list");
  const [selectedDesign, setSelectedDesign] = useState<DesignWithDetails | null>(null);
  const [isCloneMode, setIsCloneMode] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [workFilter, setWorkFilter] = useState("all");
  const [sortBy, setSortBy] = useState<
    "designNumber" | "designName" | "updatedAt" | "reed" | "pick"
  >("designNumber");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // Modals state
  const [viewModalDesign, setViewModalDesign] = useState<DesignWithDetails | null>(null);
  const [cloneModalTarget, setCloneModalTarget] = useState<DesignWithDetails | null>(null);
  const [newCloneNumber, setNewCloneNumber] = useState("");
  const [newCloneName, setNewCloneName] = useState("");
  const [deleteModalTarget, setDeleteModalTarget] = useState<DesignWithDetails | null>(null);

  // Debounce search query input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch filtered designs from Supabase
  const filterParams: DesignFilter = {
    query: debouncedQuery,
    work: workFilter,
    sortBy,
    sortOrder,
    page,
    pageSize,
  };

  const { data: searchResult, isLoading, error } = useSearchDesigns(filterParams);
  const designs = searchResult?.items || [];
  const total = searchResult?.total || 0;
  const totalPages = searchResult?.totalPages || 1;

  // Calculate total counts
  const totalBeamColours = designs.reduce((sum, d) => sum + d.beamColours.length, 0);
  const totalFeeders = designs.reduce(
    (sum, d) => sum + d.beamColours.reduce((bSum, bc) => bSum + bc.feeders.length, 0),
    0,
  );

  // Trigger New Design Entry
  const handleOpenNew = () => {
    setSelectedDesign(null);
    setIsCloneMode(false);
    setActiveScreen("entry");
  };

  // Trigger Edit Design Entry
  const handleOpenEdit = (design: DesignWithDetails) => {
    setSelectedDesign(design);
    setIsCloneMode(false);
    setActiveScreen("entry");
  };

  const handleOpenCloneModal = (design: DesignWithDetails) => {
    setCloneModalTarget(design);
    // Suggest next number e.g. D-016 if D-015
    const match = design.designNumber.match(/^([A-Za-z]+-?)(\d+)$/);
    if (match && match[1] && match[2]) {
      const prefix = match[1];
      const digits = match[2];
      const num = parseInt(digits, 10) + 1;
      const paddedNum = String(num).padStart(digits.length, "0");
      setNewCloneNumber(`${prefix}${paddedNum}`);
    } else {
      setNewCloneNumber(`${design.designNumber}-COPY`);
    }
    setNewCloneName(`${design.designName} (Copy)`);
  };

  // Clone and Delete mutations
  const { mutate: executeClone, isPending: isCloning } = useCloneDesign();
  const { mutate: executeArchive, isPending: isArchiving } = useArchiveDesign();

  // Execute Clone
  const handleExecuteClone = () => {
    if (!cloneModalTarget) return;
    if (!newCloneNumber.trim()) {
      toast.error("Please provide a new Design Number for the clone.");
      return;
    }

    executeClone(
      {
        originalId: cloneModalTarget.id,
        newDesignNumber: newCloneNumber.trim(),
        newDesignName: newCloneName.trim() || undefined,
      },
      {
        onSuccess: (cloned) => {
          setCloneModalTarget(null);
          toast.success(`Design ${cloned.designNumber} cloned successfully!`);
          setSelectedDesign(cloned);
          setIsCloneMode(false);
          setActiveScreen("entry");
        },
        onError: (err) => {
          toast.error(`Unable to clone design: ${getErrorMessage(err)}`);
        },
      },
    );
  };

  // Execute Delete (Archive)
  const handleExecuteDelete = () => {
    if (!deleteModalTarget) return;
    executeArchive(deleteModalTarget.id, {
      onSuccess: () => {
        setDeleteModalTarget(null);
        toast.success(`Design ${deleteModalTarget.designNumber} archived.`);
      },
      onError: (err) => {
        toast.error(`Unable to archive design: ${getErrorMessage(err)}`);
      },
    });
  };

  // Render Design Entry Screen if active
  if (activeScreen === "entry") {
    return (
      <AppShell title="Designs" breadcrumb={[{ label: "Design" }, { label: "Designs" }]}>
        <DesignEntry
          initialDesign={selectedDesign}
          isClone={isCloneMode}
          onBack={() => setActiveScreen("list")}
          onSaveSuccess={() => setActiveScreen("list")}
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Designs"
      breadcrumb={[{ label: "Design" }, { label: "Designs" }]}
      actions={
        <Button size="sm" onClick={handleOpenNew} className="gap-1">
          <Plus className="size-4" /> New Design
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Top Control Bar: Search & View Switch */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
          {/* Debounced Search Input */}
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search designs, sheets, yarn..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter by Work */}
            <Select
              value={workFilter}
              onValueChange={(val) => {
                setWorkFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SlidersHorizontal className="mr-1 size-3.5" />
                <SelectValue placeholder="Filter Work" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Work Types</SelectItem>
                <SelectItem value="Jacquard Pashmina">Jacquard Pashmina</SelectItem>
                <SelectItem value="Brocade Work">Brocade Work</SelectItem>
                <SelectItem value="Floral Motif">Floral Motif</SelectItem>
                <SelectItem value="Embroidery & Jacquard">Embroidery & Jacquard</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Order */}
            <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="designNumber">Design Number</SelectItem>
                <SelectItem value="designName">Design Name</SelectItem>
                <SelectItem value="reed">Reed</SelectItem>
                <SelectItem value="pick">Pick</SelectItem>
                <SelectItem value="updatedAt">Last Updated</SelectItem>
              </SelectContent>
            </Select>

            {/* View Switcher Toggle */}
            <div className="flex items-center rounded-md border border-border bg-muted p-0.5">
              <Button
                variant={viewMode === "gallery" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 gap-1 px-2.5 text-xs font-medium"
                onClick={() => setViewMode("gallery")}
              >
                <LayoutGrid className="size-3.5" /> Gallery
              </Button>
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 gap-1 px-2.5 text-xs font-medium"
                onClick={() => setViewMode("table")}
              >
                <TableIcon className="size-3.5" /> Table
              </Button>
            </div>
          </div>
        </div>

        {/* Results Metadata Summary */}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <p>
            Showing <span className="font-semibold text-foreground">{designs.length}</span> of{" "}
            <span className="font-semibold text-foreground">{total}</span> designs
          </p>
          <p className="hidden sm:block">
            Active: {totalBeamColours} Beam Colours / {totalFeeders} Feeders
          </p>
        </div>

        {/* LOADING STATE */}
        {isLoading && (
          <div className="flex items-center justify-center rounded-lg border border-dashed py-12">
            <div className="text-center text-sm text-muted-foreground">
              <p>Loading designs...</p>
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {error && !isLoading && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">
              Failed to load designs. Please try refreshing the page.
            </p>
          </div>
        )}

        {/* GALLERY VIEW */}
        {!isLoading && !error && viewMode === "gallery" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {designs.length === 0 ? (
              <div className="col-span-full flex items-center justify-center rounded-lg border border-dashed py-8">
                <p className="text-sm text-muted-foreground">No designs found</p>
              </div>
            ) : (
              designs.map((design) => {
              const feederCount = design.beamColours.reduce(
                (sum, bc) => sum + bc.feeders.length,
                0,
              );

              return (
                <Card
                  key={design.id}
                  className="group overflow-hidden transition-all hover:border-primary/50 hover:shadow-md"
                >
                  {/* Card Image Header */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                    {design.image ? (
                      <img
                        src={design.image}
                        alt={design.designName}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-muted to-accent/40 text-muted-foreground">
                        <ImageIcon className="size-8 opacity-40" />
                        <span className="mt-1 text-[0.6875rem]">No Swatch Image</span>
                      </div>
                    )}
                    <div className="absolute left-2 top-2">
                      <Badge className="bg-background/90 font-mono text-xs font-bold text-foreground shadow-sm backdrop-blur-sm">
                        {design.designNumber}
                      </Badge>
                    </div>
                    {design.work && (
                      <div className="absolute right-2 top-2">
                        <Badge variant="secondary" className="text-[0.625rem]">
                          {design.work}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Card Content Body */}
                  <CardContent className="space-y-3 p-4">
                    <div>
                      <h3 className="font-semibold tracking-tight text-foreground line-clamp-1">
                        {design.designName}
                      </h3>
                      {design.dn && (
                        <p className="text-[0.6875rem] text-muted-foreground font-mono">
                          {design.dn} {design.dnCode ? `· ${design.dnCode}` : ""}
                        </p>
                      )}
                    </div>

                    {/* Specs Row */}
                    <div className="grid grid-cols-3 gap-1 rounded-md bg-muted/50 p-2 text-center text-[0.6875rem]">
                      <div>
                        <span className="block text-muted-foreground">Reed</span>
                        <span className="font-mono font-medium">{design.reed ?? "—"}</span>
                      </div>
                      <div>
                        <span className="block text-muted-foreground">Pick</span>
                        <span className="font-mono font-medium">{design.pick ?? "—"}</span>
                      </div>
                      <div>
                        <span className="block text-muted-foreground">Cards</span>
                        <span className="font-mono font-medium">{design.cards ?? "—"}</span>
                      </div>
                    </div>

                    {/* Beam Colours & Feeders Count */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/60">
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Layers className="size-3.5 text-primary" /> {design.beamColours.length}{" "}
                        Beam Colours
                      </span>
                      <span className="font-mono text-[0.6875rem]">{feederCount} Feeders</span>
                    </div>

                    {/* Card Action Buttons */}
                    <div className="flex items-center justify-between gap-1 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 flex-1 text-xs"
                        onClick={() => setViewModalDesign(design)}
                      >
                        <Eye className="mr-1 size-3" /> View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 flex-1 text-xs"
                        onClick={() => handleOpenEdit(design)}
                      >
                        <Edit className="mr-1 size-3" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleOpenCloneModal(design)}
                        title="Clone Design"
                      >
                        <Copy className="size-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
            )}
          </div>
        )}

        {/* TABLE VIEW */}
        {!isLoading && !error && viewMode === "table" && (
          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 text-xs">
                  <TableHead className="font-semibold">Design Number</TableHead>
                  <TableHead className="font-semibold">Design Name</TableHead>
                  <TableHead className="font-semibold">DN</TableHead>
                  <TableHead className="font-semibold">Reed</TableHead>
                  <TableHead className="font-semibold">Pick</TableHead>
                  <TableHead className="font-semibold">Cards</TableHead>
                  <TableHead className="font-semibold">Work</TableHead>
                  <TableHead className="font-semibold">Beam Colours</TableHead>
                  <TableHead className="font-semibold">Feeders</TableHead>
                  <TableHead className="font-semibold">Updated</TableHead>
                  <TableHead className="text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {designs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      No designs found
                    </TableCell>
                  </TableRow>
                ) : (
                  designs.map((design) => {
                  const feederCount = design.beamColours.reduce(
                    (sum, bc) => sum + bc.feeders.length,
                    0,
                  );
                  return (
                    <TableRow key={design.id} className="hover:bg-muted/40">
                      <TableCell className="font-mono font-bold text-primary">
                        {design.designNumber}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          {design.image && (
                            <img
                              src={design.image}
                              alt=""
                              className="size-6 rounded object-cover border border-border"
                            />
                          )}
                          <span>{design.designName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {design.dn || "—"}
                      </TableCell>
                      <TableCell className="font-mono">{design.reed ?? "—"}</TableCell>
                      <TableCell className="font-mono">{design.pick ?? "—"}</TableCell>
                      <TableCell className="font-mono">{design.cards ?? "—"}</TableCell>
                      <TableCell>{design.work || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[0.6875rem]">
                          {design.beamColours.length} Colours
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">{feederCount}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(design.updatedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setViewModalDesign(design)}
                            title="View"
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground"
                            onClick={() => handleOpenEdit(design)}
                            title="Edit"
                          >
                            <Edit className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground"
                            onClick={() => handleOpenCloneModal(design)}
                            title="Clone Design"
                          >
                            <Copy className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteModalTarget(design)}
                            title="Delete"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Empty State */}
        {designs.length === 0 && (
          <div className="flex min-h-60 flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center bg-card">
            <Sparkles className="size-10 text-muted-foreground/40 mb-2" />
            <h3 className="text-sm font-semibold text-foreground">No designs found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              No design matching "{searchQuery}". Try clearing search filters or create a new
              design.
            </p>
            <Button size="sm" className="mt-4 gap-1" onClick={handleOpenNew}>
              <Plus className="size-4" /> Create New Design
            </Button>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border pt-4 text-xs">
            <p className="text-muted-foreground">
              Page <span className="font-semibold text-foreground">{page}</span> of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="size-3.5" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* VIEW DESIGN DETAIL MODAL */}
      <Dialog
        open={Boolean(viewModalDesign)}
        onOpenChange={(open) => !open && setViewModalDesign(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {viewModalDesign && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <span className="font-mono text-primary">{viewModalDesign.designNumber}</span> —{" "}
                  {viewModalDesign.designName}
                </DialogTitle>
                <DialogDescription>
                  Technical design specifications and Beam Colour & Feeder hierarchy.
                </DialogDescription>
              </DialogHeader>

              {viewModalDesign.image && (
                <div className="overflow-hidden rounded-md border border-border">
                  <img
                    src={viewModalDesign.image}
                    alt={viewModalDesign.designName}
                    className="max-h-56 w-full object-cover"
                  />
                </div>
              )}

              {/* Specifications Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg bg-muted/40 p-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">DN</span>
                  <span className="font-mono font-medium">{viewModalDesign.dn || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Reed</span>
                  <span className="font-mono font-medium">{viewModalDesign.reed ?? "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Pick</span>
                  <span className="font-mono font-medium">{viewModalDesign.pick ?? "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Cards</span>
                  <span className="font-mono font-medium">{viewModalDesign.cards ?? "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Patti</span>
                  <span className="font-mono font-medium">{viewModalDesign.patti ?? "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Total D.C.</span>
                  <span className="font-mono font-medium">{viewModalDesign.totalDC ?? "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Total Cut</span>
                  <span className="font-mono font-medium">{viewModalDesign.totalCut ?? "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Work</span>
                  <span className="font-medium">{viewModalDesign.work || "—"}</span>
                </div>
              </div>

              {/* Description / Remarks */}
              {viewModalDesign.description && (
                <div className="text-xs">
                  <span className="font-semibold text-foreground">Description:</span>
                  <p className="mt-0.5 text-muted-foreground">{viewModalDesign.description}</p>
                </div>
              )}

              {/* Beam Colours & Feeder Hierarchy */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  BEAM COLOUR & FEEDER PROGRAM HIERARCHY
                </h4>
                {viewModalDesign.beamColours.map((bc, idx) => (
                  <div
                    key={bc.id}
                    className="rounded-md border border-border bg-card p-3 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-primary font-mono">
                        BEAM COLOUR #{idx + 1}: {bc.beamColour}
                      </span>
                      <span className="text-muted-foreground text-[0.6875rem]">
                        {bc.feeders.length} Feeders
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded border border-border bg-muted/10">
                      <table className="w-full min-w-max border-collapse text-center text-xs">
                        <thead>
                          <tr className="bg-muted/60 border-b border-border font-mono font-bold text-primary">
                            {bc.feeders.map((f) => (
                              <th
                                key={f.id}
                                className="border-r border-border px-3 py-1.5 min-w-[130px]"
                              >
                                {f.feederNumber}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="font-semibold text-foreground">
                            {bc.feeders.map((f) => (
                              <td key={f.id} className="border-r border-border px-3 py-2 font-sans">
                                {f.colorName}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const target = viewModalDesign;
                    setViewModalDesign(null);
                    handleOpenEdit(target);
                  }}
                >
                  <Edit className="mr-1 size-3.5" /> Edit Design
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const target = viewModalDesign;
                    setViewModalDesign(null);
                    handleOpenCloneModal(target);
                  }}
                >
                  <Copy className="mr-1 size-3.5" /> Clone Design
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CLONE DESIGN CONFIRMATION MODAL */}
      <Dialog
        open={Boolean(cloneModalTarget)}
        onOpenChange={(open) => !open && setCloneModalTarget(null)}
      >
        <DialogContent className="max-w-md">
          {cloneModalTarget && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle>Clone Design</DialogTitle>
                <DialogDescription>
                  Create an independent copy of design{" "}
                  <strong className="text-foreground">
                    {cloneModalTarget.designNumber} — {cloneModalTarget.designName}
                  </strong>
                  .
                </DialogDescription>
              </DialogHeader>

              {/* Items to copy summary */}
              <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1 text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">The following will be copied:</p>
                <p className="flex items-center gap-1.5">
                  <span className="text-emerald-500 font-bold">✓</span> Technical specifications
                  (Reed, Pick, Cards, Patti, etc.)
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="text-emerald-500 font-bold">✓</span> Design image
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="text-emerald-500 font-bold">✓</span> Beam Colours (
                  {cloneModalTarget.beamColours.length}) and sequence order
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="text-emerald-500 font-bold">✓</span> Feeder programs and old
                  numbers
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="text-emerald-500 font-bold">✓</span> Description and remarks
                </p>
                <p className="mt-2 pt-2 border-t border-border text-[0.6875rem] text-primary">
                  The original design will not be modified.
                </p>
              </div>

              {/* New Clone Credentials Inputs */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cloneNum">
                    New Design Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cloneNum"
                    placeholder="e.g. D-016"
                    value={newCloneNumber}
                    onChange={(e) => setNewCloneNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cloneName">New Design Name</Label>
                  <Input
                    id="cloneName"
                    placeholder="e.g. Kashmiri Pashmina Blue"
                    value={newCloneName}
                    onChange={(e) => setNewCloneName(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCloneModalTarget(null)}
                  disabled={isCloning}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleExecuteClone}
                  disabled={isCloning}
                  className="gap-1"
                >
                  {isCloning ? "Cloning..." : <><Copy className="size-3.5" /> Clone Design</>}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ARCHIVE CONFIRMATION MODAL */}
      <Dialog
        open={Boolean(deleteModalTarget)}
        onOpenChange={(open) => !open && setDeleteModalTarget(null)}
      >
        <DialogContent className="max-w-sm">
          {deleteModalTarget && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle>Archive Design?</DialogTitle>
                <DialogDescription>
                  Archive <strong className="text-foreground">{deleteModalTarget.designNumber}</strong>?
                  The design will be hidden from the active list but can be restored later if needed.
                </DialogDescription>
              </DialogHeader>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteModalTarget(null)}
                  disabled={isArchiving}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleExecuteDelete}
                  disabled={isArchiving}
                >
                  {isArchiving ? "Archiving..." : "Archive Design"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
